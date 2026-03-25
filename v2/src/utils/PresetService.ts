/**
 * Service for managing query presets in localStorage
 * Preset name is used as the unique identifier (case-insensitive)
 */

import type { QueryPreset, Column, PathRule } from '@/models/types'
import { cleanColumnForSave } from '@/models/types'

/**
 * Clean a PathRule for saving (compact JSON)
 */
function cleanPathRuleForSave(rule: PathRule): PathRule {
  return {
    pathPattern: rule.pathPattern,
    columns: rule.columns.map(cleanColumnForSave) as Column[],
    ...(rule.jsQuery ? { jsQuery: rule.jsQuery } : {}),
    ...(rule.expandLevel !== undefined ? { expandLevel: rule.expandLevel } : {}),
  }
}
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
 * Migrate a preset from old formats to the new path-rules-only format.
 * Old formats had: columns[], fieldQueries{}, extendedFields string, id field.
 * New format has: pathRules[] only (no default columns at root level).
 */
function migratePreset(raw: any): QueryPreset {
  // If already has pathRules, just return with cleaned structure
  if (raw.pathRules && Array.isArray(raw.pathRules) && raw.pathRules.length > 0) {
    return {
      name: raw.name,
      description: raw.description,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      pathRules: raw.pathRules,
    }
  }
  
  // Migrate old format: merge fieldQueries into columns
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

  // Convert old default config to a catch-all path rule
  const catchAllRule: PathRule = {
    pathPattern: '**',
    columns,
    ...(raw.jsQuery ? { jsQuery: raw.jsQuery } : {}),
    ...(raw.expandLevel !== undefined ? { expandLevel: raw.expandLevel } : {}),
  }
  
  return {
    name: raw.name,
    description: raw.description,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    pathRules: [catchAllRule],
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
 * Save a new preset. Path rules are cleaned to remove default values (compact JSON).
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
    name: preset.name,
    description: preset.description,
    createdAt: now,
    updatedAt: now,
    pathRules: preset.pathRules.map(cleanPathRuleForSave),
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
  if (cleanUpdates.pathRules) {
    cleanUpdates.pathRules = cleanUpdates.pathRules.map(cleanPathRuleForSave)
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
    name: preset.name,
    description: preset.description,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
    pathRules: preset.pathRules.map(cleanPathRuleForSave),
  }
  
  // Remove timestamps for a cleaner export/share
  const toExport = JSON.parse(JSON.stringify(clean))
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
 * Accepts both old (columns at root) and new (pathRules only) format.
 * If a preset with the same name exists, appends a number to make it unique.
 */
export function importPreset(json: string): QueryPreset | null {
  try {
    const data = TD.parse(json)
    
    // Validate required fields (either pathRules or old-style columns)
    if (!data || !data.name || (!data.pathRules && !data.columns)) {
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
      pathRules: migrated.pathRules,
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
    pathRules: [...original.pathRules],
  })
}
