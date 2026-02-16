/**
 * Service for managing value highlight colors per field
 * Colors are stored in localStorage and shared across components
 */

import { ref } from 'vue'
import type { ValueColor } from '@/models/types'

// Re-export ValueColor type for convenience
export type { ValueColor }

// Preset colors with good contrast (background, text)
export const PRESET_COLORS = [
  { name: 'None', bg: '', text: '' },
  { name: 'Yellow', bg: '#fef08a', text: '#713f12' },
  { name: 'Red', bg: '#fecaca', text: '#7f1d1d' },
  { name: 'Green', bg: '#bbf7d0', text: '#14532d' },
  { name: 'Blue', bg: '#bfdbfe', text: '#1e3a8a' },
  { name: 'Orange', bg: '#fed7aa', text: '#7c2d12' },
  { name: 'Purple', bg: '#e9d5ff', text: '#581c87' },
  { name: 'Gray', bg: '#e5e7eb', text: '#1f2937' },
]

const STORAGE_KEY = 'tdv-field-value-colors'

// Reactive state: field -> value -> color
// Structure: { "status": { "WARN": { bg: "#fef08a", text: "#713f12" } } }
const fieldValueColors = ref<Record<string, Record<string, ValueColor>>>({})

// Load from localStorage on module init
function loadFromStorage(): Record<string, Record<string, ValueColor>> {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

// Initialize
fieldValueColors.value = loadFromStorage()

// Save to localStorage
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fieldValueColors.value))
}

/**
 * Get the color for a value in a specific field
 */
export function getValueColor(field: string, value: string): ValueColor | null {
  return fieldValueColors.value[field]?.[value] || null
}

/**
 * Set the color for a value in a specific field
 */
export function setValueColor(field: string, value: string, color: ValueColor | null) {
  if (!fieldValueColors.value[field]) {
    fieldValueColors.value[field] = {}
  }
  
  if (color && color.bg) {
    fieldValueColors.value[field][value] = color
  } else {
    delete fieldValueColors.value[field][value]
    // Clean up empty field entries
    if (Object.keys(fieldValueColors.value[field]).length === 0) {
      delete fieldValueColors.value[field]
    }
  }
  saveToStorage()
}

/**
 * Get all value colors for a field (for saving to fieldQuery)
 */
export function getFieldValueColors(field: string): Record<string, ValueColor> | undefined {
  const colors = fieldValueColors.value[field]
  if (!colors || Object.keys(colors).length === 0) return undefined
  return { ...colors }
}

/**
 * Set all value colors for a field from a fieldQuery
 */
export function setFieldValueColors(field: string, colors: Record<string, ValueColor> | undefined) {
  if (colors && Object.keys(colors).length > 0) {
    fieldValueColors.value[field] = { ...colors }
  } else {
    delete fieldValueColors.value[field]
  }
  saveToStorage()
}

/**
 * Apply all value colors from field queries (when loading a preset)
 */
export function applyValueColorsFromFieldQueries(fieldQueries: Record<string, { valueColors?: Record<string, ValueColor> }>) {
  // Clear existing colors
  fieldValueColors.value = {}
  
  // Apply colors from each field query
  for (const [field, fq] of Object.entries(fieldQueries)) {
    if (fq.valueColors && Object.keys(fq.valueColors).length > 0) {
      fieldValueColors.value[field] = { ...fq.valueColors }
    }
  }
  saveToStorage()
}

/**
 * Get CSS style object for a value's color in a specific field
 */
export function getValueColorStyle(field: string, value: string): Record<string, string> | null {
  const color = getValueColor(field, String(value))
  if (!color) return null
  return {
    backgroundColor: color.bg,
    color: color.text,
  }
}
