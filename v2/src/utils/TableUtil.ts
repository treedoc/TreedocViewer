/**
 * Table-related utilities
 */

import type { TDNode } from 'treedoc'
import { TDNodeType, TDJSONWriter, TDJSONWriterOption, TD } from 'treedoc'
import { toRaw } from 'vue'
import { getTimestampHint } from './DateUtil'

export interface TableRow {
  [key: string]: TDNode | string | number | undefined
  __node?: TDNode
}

export interface TableColumn {
  field: string
  header: string
  sortable: boolean
  filterable: boolean
  visible: boolean
}

/**
 * Get the display value of a cell
 */
export function getCellValue(row: TableRow, field: string): string {
  const val = row[field]
  if (val === undefined || val === null) return ''
  if (typeof val === 'object' && 'value' in val) {
    return String((val as TDNode).value ?? '')
  }
  return String(val)
}

/**
 * Get the TDNode for a cell if it exists
 */
export function getCellNode(row: TableRow, field: string): TDNode | null {
  const val = row[field]
  if (val && typeof val === 'object' && 'type' in val) {
    return toRaw(val) as TDNode
  }
  return null
}

/**
 * Check if a cell contains a complex value (object/array)
 */
export function isComplexValue(row: TableRow, field: string): boolean {
  const node = getCellNode(row, field)
  return node !== null && node.type !== TDNodeType.SIMPLE
}

/**
 * Get timestamp hint for a cell value
 */
export function getCellTimestampHint(row: TableRow, field: string): string | null {
  const node = getCellNode(row, field)
  if (node) {
    return getTimestampHint(node.value)
  }
  return getTimestampHint(row[field])
}

/**
 * Generate a summary string for complex JSON values
 */
export function getComplexValueSummary(row: TableRow, field: string): string {
  const node = getCellNode(row, field) as TDNode
  return node.toStringInternal('', false, false, 100)
}

/**
 * Copy a cell value to clipboard
 * - Simple values: raw value without JSON quoting
 * - Complex values: formatted JSON
 */
export function copyCellValue(row: TableRow, field: string): void {
  const node = getCellNode(row, field)
  let text: string
  if (node) {
    if (node.type === TDNodeType.SIMPLE) {
      text = node.value === null ? 'null' : String(node.value)
    } else {
      text = TDJSONWriter.get().writeAsString(node, new TDJSONWriterOption().setIndentFactor(2))
    }
  } else {
    text = String(getCellValue(row, field))
  }
  navigator.clipboard.writeText(text)
}

/**
 * Copy table data as JSON to clipboard
 */
export function copyAsJSON(data: TableRow[]): void {
  const jsonData = data.map(row => {
    if (row.__node) {
      return row.__node.toObject(true)
    }
    return row
  })
  navigator.clipboard.writeText(TD.stringify(jsonData))
}

/**
 * Copy table data as CSV to clipboard
 */
export function copyAsCSV(data: TableRow[], columns: TableColumn[]): void {
  const header = columns.map(c => c.header).join(',')
  const csvRows = data.map(row => {
    return columns.map(col => {
      const val = row[col.field]
      if (val === undefined || val === null) return ''
      if (typeof val === 'object' && 'value' in val) {
        const v = (val as TDNode).value
        return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)
      }
      return String(val)
    }).join(',')
  })
  const csv = [header, ...csvRows].join('\n')
  navigator.clipboard.writeText(csv)
}

/**
 * Determine if columns should be auto-expanded based on data structure
 */
export function shouldExpandColumns(node: TDNode): boolean {
  if (!node.children || node.children.length === 0) return false
  
  const cols = new Set<string>()
  let cellCount = 0
  
  for (const child of node.children) {
    if (child.children) {
      for (const grandChild of child.children) {
        cols.add(grandChild.key!)
        cellCount++
      }
    }
  }
  
  const rowCount = node.children.length
  const colCount = cols.size
  if (colCount === 0 || colCount > 30) {
    return false
  }
  
  // Threshold: at least 50% fill rate
  const threshold = 0.5
  const maxCells = rowCount * colCount
  return cellCount >= maxCells * threshold
}
