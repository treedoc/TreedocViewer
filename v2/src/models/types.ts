import type { TDNode } from 'treedoc'

export enum ParseStatus {
  SUCCESS = 'SUCCESS',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface ParseResult {
  result?: TDNode
  status: ParseStatus
  message: string
}

export type ParserSyntax = 'json' | 'xml' | 'yaml' | 'text' | 'csv' | 'prometheus'

export interface ParserPlugin<TOpt = unknown> {
  name: string
  syntax: ParserSyntax
  option: TOpt

  looksLike(str: string): boolean
  parse(str: string): ParseResult
  stringify(obj: TDNode): string
}

export interface Selection {
  start?: { line: number; col: number; pos: number }
  end?: { line: number; col: number; pos: number }
}

export interface ValueColor {
  bg: string
  text: string
}

/**
 * Unified Column definition that includes both display properties and
 * filter/query state (formerly separated as FieldQuery).
 */
export interface Column {
  field: string
  title?: string
  visible?: boolean
  sortable?: boolean
  width?: string
  // --- filter / query state (formerly FieldQuery) ---
  query?: string
  isRegex?: boolean
  isNegate?: boolean
  isArray?: boolean
  isPattern?: boolean
  isDisabled?: boolean
  patternFields?: string[]
  valueColors?: Record<string, ValueColor>
  patternExtract?: string
  patternFilter?: boolean
  extendedFields?: string
  jsExpression?: string
  linkExpression?: string  // JS expression returning URL, can use $ for cell value, $$ for row
}

/**
 * FieldQuery is now a type alias for Column for backward compatibility.
 * All field-query related fields are optional in Column.
 */
export type FieldQuery = Column

/**
 * Convert a Column array to the legacy fieldQueries map format,
 * for use with utilities that still expect Record<string, FieldQuery>.
 */
export function columnsToFieldQueries(columns: Column[]): Record<string, FieldQuery> {
  const result: Record<string, FieldQuery> = {}
  for (const col of columns) {
    if (col.field) {
      result[col.field] = col
    }
  }
  return result
}

export interface Query {
  limit: number
  offset: number
  sortField: string
  sortDir: 'asc' | 'desc' | ''
  jsQuery: string
  columns: Column[]
}

export interface ChartState {
  showChart?: boolean
  timeColumn?: string
  valueColumn?: string
  groupColumn?: string
  bucketSize?: string
  hiddenGroups?: string[]
  timeSelectionStart?: number | null
  timeSelectionEnd?: number | null
  timeSelectionColumn?: string
}

export interface TableNodeState {
  query: Query
  expandedLevel: number
  isColumnExpanded: boolean
  chartState?: ChartState
  showExtendedFields?: boolean
  showAdvancedQuery?: boolean
  selectedPresetName?: string | null
}

export interface TDVOptions {
  maxPane?: string
  textWrap?: boolean
  showTable?: boolean
  showSource?: boolean
  showTree?: boolean
  parsers?: ParserPlugin[]
}

/**
 * A path-specific configuration rule within a preset.
 * Applied when the selected node's path matches the pattern.
 */
export interface PathRule {
  pathPattern: string  // Glob pattern (e.g., "/logs/*", "**.errors")
  columns: Column[]
  jsQuery?: string
  expandLevel?: number
}

/**
 * A named preset for table query settings.
 * Uses path-based rules for different configurations based on selected node path.
 * If no path rule matches, the preset does not apply any configuration.
 */
export interface QueryPreset {
  name: string  // Name is the unique identifier
  description?: string
  createdAt: number
  updatedAt: number
  // Path-specific rules (checked in order, first match wins)
  // Use pattern "**" as a catch-all rule that matches any path
  pathRules: PathRule[]
}

/**
 * Match a path against a glob-like pattern.
 * Supports: * (single segment), ** (multiple segments), ? (single char)
 */
export function matchPathPattern(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars except * and ?
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')    // Temporarily replace **
    .replace(/\*/g, '[^/]*')                // * matches single segment
    .replace(/{{DOUBLE_STAR}}/g, '.*')      // ** matches multiple segments
    .replace(/\?/g, '.')                    // ? matches single char
  
  // Anchor the pattern
  if (!regexStr.startsWith('^')) regexStr = '^' + regexStr
  if (!regexStr.endsWith('$')) regexStr = regexStr + '$'
  
  try {
    const regex = new RegExp(regexStr)
    return regex.test(path)
  } catch {
    return false
  }
}

/**
 * Find the matching path rule for a given path.
 * Returns the first matching rule, or undefined if no rule matches.
 */
export function findMatchingPathRule(preset: QueryPreset, path: string): PathRule | undefined {
  if (preset.pathRules.length === 0) return undefined
  
  for (const rule of preset.pathRules) {
    if (matchPathPattern(path, rule.pathPattern)) {
      return rule
    }
  }
  
  return undefined
}

/**
 * Get the effective configuration from a preset for a given path.
 * Returns the matching path rule's config, or null if no rule matches.
 */
export function getPresetConfigForPath(preset: QueryPreset, path: string): {
  columns: Column[]
  jsQuery?: string
  expandLevel?: number
} | null {
  const matchingRule = findMatchingPathRule(preset, path)
  
  if (matchingRule) {
    return {
      columns: matchingRule.columns,
      jsQuery: matchingRule.jsQuery,
      expandLevel: matchingRule.expandLevel,
    }
  }
  
  return null
}

/**
 * Strip default (falsy/empty) values from a column before saving to JSON.
 * This keeps saved presets compact.
 */
export function cleanColumnForSave(col: Column): Partial<Column> {
  const result: Partial<Column> = { field: col.field }
  if (col.title) result.title = col.title
  if (col.visible !== undefined && col.visible !== true) result.visible = col.visible
  if (col.sortable !== undefined && col.sortable !== true) result.sortable = col.sortable
  if (col.width) result.width = col.width
  if (col.query) result.query = col.query
  if (col.isRegex) result.isRegex = col.isRegex
  if (col.isNegate) result.isNegate = col.isNegate
  if (col.isArray) result.isArray = col.isArray
  if (col.isPattern) result.isPattern = col.isPattern
  if (col.isDisabled) result.isDisabled = col.isDisabled
  // patternFields is derived, not saved
  // if (col.patternFields && col.patternFields.length > 0) result.patternFields = col.patternFields
  if (col.valueColors && Object.keys(col.valueColors).length > 0) result.valueColors = col.valueColors
  if (col.patternExtract) result.patternExtract = col.patternExtract
  if (col.patternFilter) result.patternFilter = col.patternFilter
  if (col.extendedFields) result.extendedFields = col.extendedFields
  if (col.jsExpression) result.jsExpression = col.jsExpression
  if (col.linkExpression) result.linkExpression = col.linkExpression
  return result
}

export function createDefaultQuery(): Query {
  return {
    limit: 100,
    offset: 0,
    sortField: '',
    sortDir: '',
    jsQuery: '$',
    columns: [],
  }
}

export function createDefaultColumn(field: string): Column {
  return { field }
}

/** @deprecated Use createDefaultColumn() instead */
export function createDefaultFieldQuery(): FieldQuery {
  return {
    field: '',
    query: '',
    isRegex: false,
    isNegate: false,
    isArray: false,
    isPattern: false,
    isDisabled: false,
    patternFields: [],
  }
}
