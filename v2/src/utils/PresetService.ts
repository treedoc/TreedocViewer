/**
 * Service for managing query presets in localStorage
 */

import type { QueryPreset, Column } from '@/models/types'
import { cleanColumnForSave } from '@/models/types'
import { TD } from 'treedoc'

const STORAGE_KEY = 'tdv-query-presets'

/**
 * Generate a unique ID for a preset
 */
function generateId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Get all saved presets.
 * Handles migration from the old format (fieldQueries/extendedFields) to the new unified Column format.
 */
export function getAllPresets(): QueryPreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    const presets = JSON.parse(data) as any[]
    // Sort by most recently updated
    return presets.map(migratePreset).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (e) {
    console.error('Error loading presets:', e)
    return []
  }
}

/**
 * Migrate a preset from the old format to the new unified Column format.
 * Old format had: columns[], fieldQueries{}, extendedFields string.
 * New format has: columns[] (with filter state embedded), jsQuery.
 */
function migratePreset(raw: any): QueryPreset {
  if (!raw.fieldQueries && !raw.extendedFields) {
    // Already in new format (or no migration needed)
    return raw as QueryPreset
  }

  // Merge old fieldQueries into columns
  const colMap: Record<string, Column> = {}
  for (const col of (raw.columns || [])) {
    colMap[col.field] = { ...col }
  }
  for (const [field, fq] of Object.entries(raw.fieldQueries || {})) {
    colMap[field] = { ...colMap[field], ...(fq as Column), field }
  }

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    columns: Object.values(colMap),
    jsQuery: raw.jsQuery,
    expandLevel: raw.expandLevel,
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
 * Get a preset by name (case-insensitive)
 */
export function getPresetByName(name: string): QueryPreset | null {
  const presets = getAllPresets()
  const lowerName = name.toLowerCase().trim()
  return presets.find(p => p.name.toLowerCase().trim() === lowerName) || null
}

/**
 * Save a new preset. Columns are cleaned to remove default values (compact JSON).
 */
export function savePreset(preset: Omit<QueryPreset, 'id' | 'createdAt' | 'updatedAt'>): QueryPreset {
  const presets = getAllPresets()
  const now = Date.now()

  const newPreset: QueryPreset = {
    ...preset,
    columns: preset.columns.map(cleanColumnForSave) as Column[],
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }

  presets.push(newPreset)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))

  return newPreset
}

/**
 * Update an existing preset. Columns are cleaned to remove default values.
 */
export function updatePreset(id: string, updates: Partial<Omit<QueryPreset, 'id' | 'createdAt'>>): QueryPreset | null {
  const presets = getAllPresets()
  const index = presets.findIndex(p => p.id === id)

  if (index === -1) return null

  const cleanUpdates = { ...updates }
  if (cleanUpdates.columns) {
    cleanUpdates.columns = cleanUpdates.columns.map(cleanColumnForSave) as Column[]
  }

  const updated: QueryPreset = {
    ...presets[index],
    ...cleanUpdates,
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
 * Export a preset as compact JSON string (no default values)
 */
export function exportPreset(preset: QueryPreset): string {
  const clean: QueryPreset = {
    ...preset,
    columns: preset.columns.map(cleanColumnForSave) as Column[],
  }
  // Remove id and timestamps for a cleaner export/share
  const toExport = JSON.parse(JSON.stringify(clean))
  delete toExport.id
  delete toExport.createdAt
  delete toExport.updatedAt

  return TD.stringify(toExport, {
    jsonOption: {
      alwaysQuoteKey: false,
      alwaysQuoteValue: false,
      indentFactor: 2
    }
  })
}

/**
 * Import a preset from JSON string.
 * Accepts both old (fieldQueries/extendedFields) and new (unified columns) format.
 */
export function importPreset(json: string): QueryPreset | null {
  try {
    const data = JSON.parse(json)

    // Validate required fields
    if (!data.name || !data.columns) {
      console.error('Invalid preset format: missing required fields')
      return null
    }

    // Migrate if needed, then save
    const migrated = migratePreset(data)

    const preset = savePreset({
      name: migrated.name,
      description: migrated.description,
      columns: migrated.columns,
      jsQuery: migrated.jsQuery,
      expandLevel: migrated.expandLevel,
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
    jsQuery: original.jsQuery,
    expandLevel: original.expandLevel,
  })
}
