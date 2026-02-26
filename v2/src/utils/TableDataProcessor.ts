/**
 * TableDataProcessor - Handles data transformation, filtering, and derived column extraction
 * 
 * This class is framework-agnostic and can be unit tested independently.
 */

import type { FieldQuery } from '@/models/types'
import { matchFieldQuery, matchPattern, createExtendedFieldsFunc } from './QueryUtil'

/**
 * Represents a row of table data
 */
export interface TableRow {
  [key: string]: any
  __node?: any // Original TDNode reference
}

/**
 * Result of processing data through field queries
 */
export interface ProcessingResult {
  data: TableRow[]
  derivedColumns: string[]
  derivedColumnSources: Map<string, string>
}

/**
 * Column definition
 */
export interface TableColumn {
  field: string
  header: string
  sortable: boolean
  filterable: boolean
  visible: boolean
  isDerived?: boolean
}

/**
 * Configuration for data processing
 */
export interface ProcessingConfig {
  fieldQueries: Record<string, FieldQuery>
  columnOrder: string[]
  jsQuery?: string
  valueToString?: (value: any) => string
}

/**
 * Convert a cell value to an object for extended field processing
 */
export function getCellObject(cellValue: any): any {
  if (cellValue && typeof cellValue === 'object' && 'type' in cellValue && 'children' in cellValue) {
    // It's a TDNode - convert to object
    return cellValue.toObject?.(true) ?? cellValue
  } else if (cellValue && typeof cellValue === 'object') {
    // Plain object - use directly
    return cellValue
  } else if (typeof cellValue === 'string') {
    // Try to parse as JSON if it looks like JSON
    const trimmed = cellValue.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * TDNodeType enum values from treedoc library
 */
const TDNodeTypeEnum = {
  MAP: 0,
  ARRAY: 1,
  SIMPLE: 2
} as const

/**
 * Default value to string converter
 */
export function defaultValueToString(value: any): string {
  if (value === undefined || value === null) return ''
  
  if (typeof value === 'object') {
    // Check for TDNode-like structure
    if ('type' in value && 'key' in value) {
      if (value.type === TDNodeTypeEnum.SIMPLE && 'value' in value) {
        return String(value.value ?? '')
      }
      // For complex nodes, try to stringify
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }
    // Plain object/array
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  
  return String(value)
}

/**
 * TableDataProcessor - Main class for data transformation and filtering
 */
export class TableDataProcessor {
  private valueToString: (value: any) => string
  
  constructor(valueToString?: (value: any) => string) {
    this.valueToString = valueToString ?? defaultValueToString
  }
  
  /**
   * Process data through all field queries with fixed-point iteration
   * to handle recursive dependencies between derived fields
   */
  processData(
    inputData: TableRow[],
    config: ProcessingConfig
  ): ProcessingResult {
    let data = [...inputData]
    
    const derivedColumns: string[] = []
    const derivedColumnsSet = new Set<string>()
    const derivedColumnSources = new Map<string, string>()
    
    // Collect fields to process in order
    const configuredFields = [...config.columnOrder]
    for (const field of Object.keys(config.fieldQueries)) {
      if (!configuredFields.includes(field)) {
        configuredFields.push(field)
      }
    }
    
    // Track which field+operation combinations have been processed
    const processedFields = new Set<string>()
    
    const MAX_ITERATIONS = 10
    let iteration = 0
    
    while (iteration < MAX_ITERATIONS) {
      iteration++
      const columnsBeforeIteration = derivedColumns.length
      
      for (const field of configuredFields) {
        const fq = config.fieldQueries[field]
        if (!fq || fq.isDisabled) continue
        
        // Check if field exists in data
        const fieldExistsInData = data.length > 0 && data.some(row => row[field] !== undefined)
        if (!fieldExistsInData) continue
        
        const extKey = `${field}:ext`
        const patternKey = `${field}:pattern`
        const queryKey = `${field}:query`
        
        // Apply extended fields
        if (fq.extendedFields && !processedFields.has(extKey)) {
          data = this.applyExtendedFields(
            data, field, fq.extendedFields,
            derivedColumnsSet, derivedColumns, derivedColumnSources
          )
          processedFields.add(extKey)
        }
        
        // Apply pattern extraction
        if (fq.patternExtract && !processedFields.has(patternKey)) {
          data = this.applyPatternExtract(
            data, field, fq.patternExtract, fq.patternFilter ?? false,
            derivedColumnsSet, derivedColumns, derivedColumnSources
          )
          processedFields.add(patternKey)
        }
        
        // Apply query filter
        // For derived columns, undefined values should be filtered out (not kept)
        if (fq.query && !processedFields.has(queryKey)) {
          const isDerivedColumn = derivedColumnsSet.has(field)
          data = this.applyQueryFilter(data, field, fq, isDerivedColumn)
          processedFields.add(queryKey)
        }
        
        // Apply JS expression filter
        const jsKey = `${field}:js`
        if (fq.jsExpression && !processedFields.has(jsKey)) {
          data = this.applyJsExpressionFilter(data, field, fq.jsExpression)
          processedFields.add(jsKey)
        }
      }
      
      // Check if any new columns were created
      if (derivedColumns.length === columnsBeforeIteration) {
        break
      }
      
      // Add new derived columns to configuredFields for next iteration
      for (const col of derivedColumns) {
        if (!configuredFields.includes(col) && config.fieldQueries[col]) {
          configuredFields.push(col)
        }
      }
    }
    
    // Apply JS query if specified
    if (config.jsQuery && config.jsQuery !== '$') {
      data = this.applyJsQuery(data, config.jsQuery)
    }
    
    return {
      data,
      derivedColumns,
      derivedColumnSources
    }
  }
  
  /**
   * Apply extended fields extraction to data
   */
  applyExtendedFields(
    data: TableRow[],
    field: string,
    extendedFieldsExpr: string,
    derivedColumnsSet: Set<string>,
    derivedColumns: string[],
    derivedColumnSources: Map<string, string>
  ): TableRow[] {
    const extFunc = createExtendedFieldsFunc(extendedFieldsExpr)
    if (!extFunc) return data
    
    return data.map(row => {
      const cellValue = row[field]
      if (cellValue === undefined) return row
      
      const obj = getCellObject(cellValue)
      if (!obj) return row
      
      try {
        const extracted = extFunc(obj)
        if (extracted && Object.keys(extracted).length > 0) {
          const newRow = { ...row }
          for (const [key, val] of Object.entries(extracted)) {
            // Convert objects/arrays to JSON string to avoid [object Object]
            if (val !== null && typeof val === 'object') {
              try {
                newRow[key] = JSON.stringify(val)
              } catch {
                newRow[key] = String(val)
              }
            } else {
              newRow[key] = val
            }
            if (!derivedColumnsSet.has(key)) {
              derivedColumnsSet.add(key)
              derivedColumns.push(key)
              derivedColumnSources.set(key, field)
            }
          }
          return newRow
        }
      } catch {
        // Ignore errors for individual rows
      }
      return row
    })
  }
  
  /**
   * Apply pattern extraction to data
   */
  applyPatternExtract(
    data: TableRow[],
    field: string,
    patternExpr: string,
    patternFilter: boolean,
    derivedColumnsSet: Set<string>,
    derivedColumns: string[],
    derivedColumnSources: Map<string, string>
  ): TableRow[] {
    const patterns = patternExpr.split('\n').map(p => p.trim()).filter(p => p)
    if (patterns.length === 0) return data
    
    const processedRows: TableRow[] = []
    
    for (const row of data) {
      const value = row[field]
      if (value === undefined) {
        if (!patternFilter) processedRows.push(row)
        continue
      }
      
      const strValue = this.valueToString(value)
      
      let matched = false
      for (const pattern of patterns) {
        const extracted = matchPattern(strValue, pattern)
        if (extracted !== null) {
          const newRow = { ...row }
          for (const [key, val] of Object.entries(extracted)) {
            newRow[key] = val
            if (!derivedColumnsSet.has(key)) {
              derivedColumnsSet.add(key)
              derivedColumns.push(key)
              derivedColumnSources.set(key, field)
            }
          }
          processedRows.push(newRow)
          matched = true
          break
        }
      }
      
      if (!matched && !patternFilter) {
        processedRows.push(row)
      }
    }
    
    return processedRows
  }
  
  /**
   * Apply query filter to data
   * @param isDerivedColumn - If true, undefined values are filtered out (derived columns should have values)
   */
  applyQueryFilter(data: TableRow[], field: string, fq: FieldQuery, isDerivedColumn = false): TableRow[] {
    if (!fq.query) return data
    
    return data.filter(row => {
      const value = row[field]
      
      // Handle undefined values:
      // - For base columns: keep rows where field doesn't exist (don't filter by missing fields)
      // - For derived columns: filter out rows where extraction didn't produce a value
      if (value === undefined) {
        return !isDerivedColumn
      }
      
      const strValue = this.valueToString(value)
      return matchFieldQuery(strValue, fq)
    })
  }
  
  /**
   * Apply JS expression filter for a specific field
   * $ references the field value
   */
  applyJsExpressionFilter(data: TableRow[], field: string, jsExpression: string): TableRow[] {
    try {
      const filterFn = new Function('$', `return ${jsExpression}`) as (value: any) => boolean
      return data.filter(row => {
        try {
          const value = row[field]
          // For TDNode values, convert to plain object
          const plainValue = value?.__node?.toObject?.(true) ?? 
                            (value?.toObject ? value.toObject(true) : value)
          return filterFn(plainValue)
        } catch {
          return true
        }
      })
    } catch (e) {
      console.warn('Invalid JS expression for field', field, ':', e)
      return data
    }
  }
  
  /**
   * Apply JS query filter
   */
  applyJsQuery(data: TableRow[], jsQuery: string): TableRow[] {
    try {
      const queryFn = new Function('$', `return ${jsQuery}`) as (obj: any) => boolean
      return data.filter(row => {
        try {
          const obj = row.__node?.toObject?.(true) ?? row
          return queryFn(obj)
        } catch {
          return true
        }
      })
    } catch (e) {
      console.warn('Invalid JS query:', e)
      return data
    }
  }
}

/**
 * Extract pattern variable names from a pattern string
 */
export function extractPatternFields(pattern: string): string[] {
  const fields: string[] = []
  
  // Match ${name} style
  const bracketMatches = pattern.matchAll(/\$\{(\w+)\}/g)
  for (const match of bracketMatches) {
    if (!fields.includes(match[1])) {
      fields.push(match[1])
    }
  }
  
  // Match $name style (not followed by {)
  const simpleMatches = pattern.matchAll(/\$(\w+)(?!\{)/g)
  for (const match of simpleMatches) {
    if (!fields.includes(match[1])) {
      fields.push(match[1])
    }
  }
  
  return fields
}
