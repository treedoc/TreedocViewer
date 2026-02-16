/**
 * Service for managing query presets in localStorage
 */

import type { QueryPreset, FieldQuery } from '@/models/types'

const STORAGE_KEY = 'tdv-query-presets'

/**
 * Generate a unique ID for a preset
 */
function generateId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Get all saved presets
 */
export function getAllPresets(): QueryPreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    const presets = JSON.parse(data) as QueryPreset[]
    // Sort by most recently updated
    return presets.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (e) {
    console.error('Error loading presets:', e)
    return []
  }
}

/**
 * Get a preset by ID
 */
export function getPreset(id: string): QueryPreset | null {
  const presets = getAllPresets()
  return presets.find(p => p.id === id) || null
}

/**
 * Save a new preset
 */
export function savePreset(preset: Omit<QueryPreset, 'id' | 'createdAt' | 'updatedAt'>): QueryPreset {
  const presets = getAllPresets()
  const now = Date.now()
  
  const newPreset: QueryPreset = {
    ...preset,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }
  
  presets.push(newPreset)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  
  return newPreset
}

/**
 * Update an existing preset
 */
export function updatePreset(id: string, updates: Partial<Omit<QueryPreset, 'id' | 'createdAt'>>): QueryPreset | null {
  const presets = getAllPresets()
  const index = presets.findIndex(p => p.id === id)
  
  if (index === -1) return null
  
  const updated: QueryPreset = {
    ...presets[index],
    ...updates,
    updatedAt: Date.now(),
  }
  
  presets[index] = updated
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  
  return updated
}

/**
 * Delete a preset
 */
export function deletePreset(id: string): boolean {
  const presets = getAllPresets()
  const filtered = presets.filter(p => p.id !== id)
  
  if (filtered.length === presets.length) {
    return false
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  return true
}

/**
 * Export a preset as JSON string
 */
export function exportPreset(preset: QueryPreset): string {
  return JSON.stringify(preset, null, 2)
}

/**
 * Import a preset from JSON string
 */
export function importPreset(json: string): QueryPreset | null {
  try {
    const data = JSON.parse(json)
    
    // Validate required fields
    if (!data.name || !data.columns) {
      console.error('Invalid preset format: missing required fields')
      return null
    }
    
    // Create a new preset with the imported data
    const preset = savePreset({
      name: data.name,
      description: data.description,
      columns: data.columns,
      extendedFields: data.extendedFields || '',
      fieldQueries: data.fieldQueries || {},
      jsQuery: data.jsQuery || '$',
      expandLevel: data.expandLevel,
    })
    
    return preset
  } catch (e) {
    console.error('Error importing preset:', e)
    return null
  }
}

/**
 * Duplicate a preset with a new name
 */
export function duplicatePreset(id: string, newName: string): QueryPreset | null {
  const original = getPreset(id)
  if (!original) return null
  
  return savePreset({
    name: newName,
    description: original.description,
    columns: [...original.columns],
    extendedFields: original.extendedFields,
    fieldQueries: { ...original.fieldQueries },
    jsQuery: original.jsQuery,
    expandLevel: original.expandLevel,
  })
}
