/**
 * Table-related utilities
 */

import type { TDNode } from 'treedoc'
import { TDNodeType, TDJSONWriter, TDJSONWriterOption, TD } from 'treedoc'
import { toRaw } from 'vue'
import { getTimestampHint, tryDate } from './DateUtil'

export type TimeBucket = 'minute' | '5min' | '10min' | '30min' | 'hour' | 'day' | 'week' | 'month'

export interface TimeSeriesDataPoint {
  time: Date
  label: string
  count: number
  avgValue?: number
  groups?: Record<string, number>  // counts by group value
}

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
export function copyAsJSON(data: TableRow[], columns: TableColumn[]): void {
  const fields = columns.map(c => c.field)
  const jsonData = data.map(row => {
    const obj: any = {}
    for (const field of fields) {
      if (field === '__node') continue
      const val = row[field]
      if (val && typeof val === 'object' && 'value' in val) {
        const node = val as TDNode
        obj[field] = node.type === TDNodeType.SIMPLE ? node.value : node.toObject(true)
      } else {
        obj[field] = val
      }
    }
    return obj
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

/**
 * Get numeric value from a cell for aggregation
 */
function getNumericValue(row: TableRow, field: string): number | null {
  const node = getCellNode(row, field)
  if (node && node.type === TDNodeType.SIMPLE) {
    const val = Number(node.value)
    return isNaN(val) ? null : val
  }
  const val = row[field]
  if (typeof val === 'number') return val
  const num = Number(val)
  return isNaN(num) ? null : num
}

/**
 * Parse a timestamp value to Date, handling ms, seconds, and microseconds
 */
function parseTimestamp(val: number): Date | null {
  return tryDate(val) || tryDate(val * 1000) || tryDate(val / 1000_000)
}

/**
 * Detect columns that appear to contain timestamp values
 */
export function detectTimeColumns(data: TableRow[], columns: TableColumn[]): string[] {
  const timeColumns: string[] = []
  const sampleSize = Math.min(data.length, 20)
  
  for (const col of columns) {
    if (col.field === '__node') continue
    
    let validCount = 0
    let totalSampled = 0
    
    for (let i = 0; i < sampleSize && i < data.length; i++) {
      const num = getNumericValue(data[i], col.field)
      if (num !== null) {
        totalSampled++
        const date = parseTimestamp(num)
        if (date) validCount++
      }
    }
    
    // If at least 80% of sampled numeric values are valid timestamps
    if (totalSampled > 0 && validCount / totalSampled >= 0.8) {
      timeColumns.push(col.field)
    }
  }
  
  return timeColumns
}

/**
 * Detect columns that contain numeric values (for value axis)
 */
export function detectNumericColumns(data: TableRow[], columns: TableColumn[]): string[] {
  const numericColumns: string[] = []
  const sampleSize = Math.min(data.length, 20)
  
  for (const col of columns) {
    if (col.field === '__node') continue
    
    let numericCount = 0
    let totalSampled = 0
    
    for (let i = 0; i < sampleSize && i < data.length; i++) {
      const val = data[i][col.field]
      if (val !== undefined && val !== null && val !== '') {
        totalSampled++
        const num = getNumericValue(data[i], col.field)
        if (num !== null) numericCount++
      }
    }
    
    // If at least 80% of sampled values are numeric
    if (totalSampled > 0 && numericCount / totalSampled >= 0.8) {
      numericColumns.push(col.field)
    }
  }
  
  return numericColumns
}

/**
 * Detect columns suitable for grouping (with limited unique values)
 */
export function detectGroupableColumns(
  data: TableRow[], 
  columns: TableColumn[], 
  maxUniqueValues: number = 100
): string[] {
  const groupableColumns: string[] = []
  
  for (const col of columns) {
    if (col.field === '__node') continue
    
    const uniqueValues = new Set<string>()
    let exceededLimit = false
    
    for (const row of data) {
      const node = getCellNode(row, col.field)
      let val: string
      if (node && node.type === TDNodeType.SIMPLE) {
        val = String(node.value ?? '')
      } else {
        const rawVal = row[col.field]
        if (rawVal === undefined || rawVal === null) {
          val = ''
        } else {
          val = String(rawVal)
        }
      }
      
      uniqueValues.add(val)
      
      if (uniqueValues.size > maxUniqueValues) {
        exceededLimit = true
        break
      }
    }
    
    if (!exceededLimit) {
      groupableColumns.push(col.field)
    }
  }
  
  return groupableColumns
}

/**
 * Auto-detect appropriate time bucket size based on data range
 */
export function detectBucketSize(data: TableRow[], timeColumn: string): TimeBucket {
  let minTime = Infinity
  let maxTime = -Infinity
  
  for (const row of data) {
    const num = getNumericValue(row, timeColumn)
    if (num !== null) {
      const date = parseTimestamp(num)
      if (date) {
        const time = date.getTime()
        if (time < minTime) minTime = time
        if (time > maxTime) maxTime = time
      }
    }
  }
  
  if (minTime === Infinity || maxTime === -Infinity) {
    return 'day'
  }
  
  const rangeMs = maxTime - minTime
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs
  const weekMs = 7 * dayMs
  const monthMs = 30 * dayMs
  
  if (rangeMs < 30 * minuteMs) return 'minute'
  if (rangeMs < 2 * hourMs) return '5min'
  if (rangeMs < 6 * hourMs) return '10min'
  if (rangeMs < 12 * hourMs) return '30min'
  if (rangeMs < 2 * dayMs) return 'hour'
  if (rangeMs < 2 * weekMs) return 'day'
  if (rangeMs < 3 * monthMs) return 'week'
  return 'month'
}

/**
 * Get the bucket key for a given date and bucket size
 */
function getBucketKey(date: Date, bucket: TimeBucket): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = date.getMinutes()
  
  switch (bucket) {
    case 'minute':
      return `${year}-${month}-${day} ${hour}:${String(minute).padStart(2, '0')}`
    case '5min': {
      const bucket5 = Math.floor(minute / 5) * 5
      return `${year}-${month}-${day} ${hour}:${String(bucket5).padStart(2, '0')}`
    }
    case '10min': {
      const bucket10 = Math.floor(minute / 10) * 10
      return `${year}-${month}-${day} ${hour}:${String(bucket10).padStart(2, '0')}`
    }
    case '30min': {
      const bucket30 = Math.floor(minute / 30) * 30
      return `${year}-${month}-${day} ${hour}:${String(bucket30).padStart(2, '0')}`
    }
    case 'hour':
      return `${year}-${month}-${day} ${hour}:00`
    case 'day':
      return `${year}-${month}-${day}`
    case 'week': {
      // Get Monday of the week
      const d = new Date(date)
      const dayOfWeek = d.getDay()
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      d.setDate(diff)
      const wMonth = String(d.getMonth() + 1).padStart(2, '0')
      const wDay = String(d.getDate()).padStart(2, '0')
      return `${d.getFullYear()}-${wMonth}-${wDay}`
    }
    case 'month':
      return `${year}-${month}`
  }
}

/**
 * Get the start date for a bucket key
 */
function getBucketStartDate(key: string, bucket: TimeBucket): Date {
  switch (bucket) {
    case 'minute':
    case '5min':
    case '10min':
    case '30min': {
      const [datePart, timePart] = key.split(' ')
      const [year, month, day] = datePart.split('-').map(Number)
      const [hour, minute] = timePart.split(':').map(Number)
      return new Date(year, month - 1, day, hour, minute, 0)
    }
    case 'hour': {
      const [datePart, timePart] = key.split(' ')
      const [year, month, day] = datePart.split('-').map(Number)
      const hour = parseInt(timePart.split(':')[0])
      return new Date(year, month - 1, day, hour, 0, 0)
    }
    case 'day':
    case 'week': {
      const [year, month, day] = key.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    case 'month': {
      const [year, month] = key.split('-').map(Number)
      return new Date(year, month - 1, 1)
    }
  }
}

/**
 * Aggregate table data by time bucket
 */
/**
 * Get string value from a cell for grouping
 */
function getStringValue(row: TableRow, field: string): string {
  const node = getCellNode(row, field)
  if (node && node.type === TDNodeType.SIMPLE) {
    return String(node.value ?? '')
  }
  const val = row[field]
  if (val === undefined || val === null) return ''
  return String(val)
}

/**
 * Aggregate table data by time bucket with optional grouping
 */
export function aggregateByTime(
  data: TableRow[],
  timeColumn: string,
  bucket: TimeBucket,
  valueColumn?: string,
  groupColumn?: string
): TimeSeriesDataPoint[] {
  const buckets = new Map<string, { count: number; sum: number; valueCount: number; groups: Record<string, number> }>()
  
  for (const row of data) {
    const num = getNumericValue(row, timeColumn)
    if (num === null) continue
    
    const date = parseTimestamp(num)
    if (!date) continue
    
    const key = getBucketKey(date, bucket)
    
    if (!buckets.has(key)) {
      buckets.set(key, { count: 0, sum: 0, valueCount: 0, groups: {} })
    }
    
    const bucketData = buckets.get(key)!
    bucketData.count++
    
    // Track group counts
    if (groupColumn) {
      const groupValue = getStringValue(row, groupColumn) || '(empty)'
      bucketData.groups[groupValue] = (bucketData.groups[groupValue] || 0) + 1
    }
    
    if (valueColumn) {
      const val = getNumericValue(row, valueColumn)
      if (val !== null) {
        bucketData.sum += val
        bucketData.valueCount++
      }
    }
  }
  
  // Convert to array and sort by time
  const result: TimeSeriesDataPoint[] = []
  for (const [key, data] of buckets) {
    result.push({
      time: getBucketStartDate(key, bucket),
      label: key,
      count: data.count,
      avgValue: data.valueCount > 0 ? data.sum / data.valueCount : undefined,
      groups: groupColumn ? data.groups : undefined
    })
  }
  
  result.sort((a, b) => a.time.getTime() - b.time.getTime())
  return result
}
