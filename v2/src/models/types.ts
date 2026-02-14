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

export interface FieldQuery {
  query: string
  isRegex: boolean
  isNegate: boolean
  isArray: boolean
  isPattern: boolean
  patternFields: string[]
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

export interface TableNodeState {
  query: Query
  expandedLevel: number
  columns: Column[]
  isColumnExpanded: boolean
}

export interface TDVOptions {
  maxPane?: string
  textWrap?: boolean
  showTable?: boolean
  showSource?: boolean
  showTree?: boolean
  parsers?: ParserPlugin[]
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
    patternFields: [],
  }
}
