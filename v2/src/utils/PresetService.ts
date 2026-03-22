/**
 * Service for managing query presets in localStorage
 * Preset name is used as the unique identifier (case-insensitive)
 */

import type { QueryPreset, Column } from '@/models/types'
import { cleanColumnForSave } from '@/models/types'
import { TD } from 'treedoc'

const STORAGE_KEY = 'tdv-query-presets'

/**
 * Normalize preset name for comparison (case-insensitive, trimmed)
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim()
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
 * Old format had: columns[], fieldQueries{}, extendedFields string, id field.
 * New format has: columns[] (with filter state embedded), jsQuery, name as key.
 */
function migratePreset(raw: any): QueryPreset {
  // Merge old fieldQueries into columns if present
  let columns = raw.columns || []
  if (raw.fieldQueries || raw.extendedFields) {
    const colMap: Record<string, Column> = {}
    for (const col of columns) {
      colMap[col.field] = { ...col }
    }
    for (const [field, fq] of Object.entries(raw.fieldQueries || {})) {
      colMap[field] = { ...colMap[field], ...(fq as Column), field }
    }
    columns = Object.values(colMap)
  }

  // Return without the old 'id' field
  return {
    name: raw.name,
    description: raw.description,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    columns,
    jsQuery: raw.jsQuery,
    expandLevel: raw.expandLevel,
  }
}

/**
 * Get a preset by name (case-insensitive)
 */
export function getPreset(name: string): QueryPreset | null {
  const presets = getAllPresets()
  const normalizedName = normalizeName(name)
  return presets.find(p => normalizeName(p.name) === normalizedName) || null
}

/**
 * Alias for getPreset (for backwards compatibility)
 */
export function getPresetByName(name: string): QueryPreset | null {
  return getPreset(name)
}

/**
 * Save a new preset. Columns are cleaned to remove default values (compact JSON).
 * Returns null if a preset with the same name already exists.
 */
export function savePreset(preset: Omit<QueryPreset, 'createdAt' | 'updatedAt'>): QueryPreset | null {
  const presets = getAllPresets()
  const normalizedName = normalizeName(preset.name)
  
  // Check for duplicate name
  if (presets.some(p => normalizeName(p.name) === normalizedName)) {
    console.error(`Preset with name "${preset.name}" already exists`)
    return null
  }
  
  const now = Date.now()

  const newPreset: QueryPreset = {
    ...preset,
    columns: preset.columns.map(cleanColumnForSave) as Column[],
    createdAt: now,
    updatedAt: now,
  }

  presets.push(newPreset)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))

  return newPreset
}

/**
 * Update an existing preset by name. Columns are cleaned to remove default values.
 * If renaming, checks that the new name doesn't conflict with another preset.
 */
export function updatePreset(name: string, updates: Partial<Omit<QueryPreset, 'createdAt'>>): QueryPreset | null {
  const presets = getAllPresets()
  const normalizedName = normalizeName(name)
  const index = presets.findIndex(p => normalizeName(p.name) === normalizedName)

  if (index === -1) return null

  // If renaming, check for conflicts
  if (updates.name && normalizeName(updates.name) !== normalizedName) {
    const newNormalizedName = normalizeName(updates.name)
    if (presets.some(p => normalizeName(p.name) === newNormalizedName)) {
      console.error(`Cannot rename: preset with name "${updates.name}" already exists`)
      return null
    }
  }

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
 * Delete a preset by name
 */
export function deletePreset(name: string): boolean {
  const presets = getAllPresets()
  const normalizedName = normalizeName(name)
  const filtered = presets.filter(p => normalizeName(p.name) !== normalizedName)

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
 * If a preset with the same name exists, appends a number to make it unique.
 */
export function importPreset(json: string): QueryPreset | null {
  try {
    const data = TD.parse(json)
    
    // Validate required fields
    if (!data || !data.name || !data.columns) {
      console.error('Invalid preset format: missing required fields')
      return null
    }

    // Migrate if needed
    const migrated = migratePreset(data)

    // Find a unique name if the original name already exists
    let finalName = migrated.name
    let suffix = 1
    while (getPreset(finalName)) {
      finalName = `${migrated.name} (${suffix})`
      suffix++
    }

    const preset = savePreset({
      name: finalName,
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
