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

export interface FieldQuery {
  query: string
  isRegex: boolean
  isNegate: boolean
  isArray: boolean
  isPattern: boolean
  isDisabled: boolean
  patternFields: string[]
  valueColors?: Record<string, ValueColor>
  patternExtract?: string
  patternFilter?: boolean
  extendedFields?: string
  jsExpression?: string
}

export interface Query {
  limit: number
  offset: number
  sortField: string
  sortDir: 'asc' | 'desc' | ''
  jsQuery: string
  extendedFields: string
  fieldQueries: Record<string, FieldQuery>
}

export interface Column {
  field: string
  title?: string
  visible?: boolean
  sortable?: boolean
  width?: string
}

export interface ChartState {
  showChart?: boolean
  timeColumn?: string
  valueColumn?: string
  groupColumn?: string
  bucketSize?: string
  hiddenGroups?: string[]
}

export interface TableNodeState {
  query: Query
  expandedLevel: number
  columns: Column[]
  isColumnExpanded: boolean
  chartState?: ChartState
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
 * A named preset for table query settings
 */
export interface QueryPreset {
  id: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  // Settings to save
  columns: { field: string; visible: boolean }[]
  extendedFields: string
  fieldQueries: Record<string, FieldQuery>
  jsQuery: string
  expandLevel?: number
}

export function createDefaultQuery(): Query {
  return {
    limit: 100,
    offset: 0,
    sortField: '',
    sortDir: '',
    jsQuery: '$',
    extendedFields: '',
    fieldQueries: {},
  }
}

export function createDefaultFieldQuery(): FieldQuery {
  return {
    query: '',
    isRegex: false,
    isNegate: false,
    isArray: false,
    isPattern: false,
    isDisabled: false,
    patternFields: [],
  }
}
