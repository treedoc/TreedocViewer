import type { ParserPlugin, ParseResult, ParserSyntax } from '../models/types'
import { ParseStatus } from '../models/types'
import type { TDNode } from 'treedoc'
import { TDObjectCoder, TDJSONWriter, TDJSONWriterOption } from 'treedoc'

export interface CSVParserOption {
  delimiter?: string
  hasHeader?: boolean
}

export default class CSVParserPlugin implements ParserPlugin<CSVParserOption> {
  syntax: ParserSyntax = 'csv'
  option: CSVParserOption = {}

  constructor(
    public name = 'CSV',
    public delimiter = ',',
    public hasHeader = true
  ) {
    this.option = { delimiter, hasHeader }
  }

  looksLike(str: string): boolean {
    const lines = str.trim().split('\n')
    if (lines.length < 2) return false
    
    // Check if first line looks like a header with consistent delimiters
    const delimCount = (lines[0].match(new RegExp(this.escapeRegExp(this.delimiter), 'g')) || []).length
    if (delimCount === 0) return false
    
    // Check consistency with second line
    const secondDelimCount = (lines[1].match(new RegExp(this.escapeRegExp(this.delimiter), 'g')) || []).length
    return Math.abs(delimCount - secondDelimCount) <= 1
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  parse(str: string): ParseResult {
    const result: ParseResult = {
      status: ParseStatus.SUCCESS,
      message: '',
    }
    
    try {
      const rows = this.parseCSV(str)
      
      if (rows.length === 0) {
        result.message = 'Empty CSV'
        result.status = ParseStatus.WARN
        result.result = TDObjectCoder.get().encode([])
        return result
      }
      
      let data: Record<string, string>[]
      
      if (this.hasHeader && rows.length > 1) {
        const headers = rows[0]
        data = rows.slice(1).map(row => {
          const obj: Record<string, string> = {}
          headers.forEach((header, i) => {
            obj[header] = row[i] || ''
          })
          return obj
        })
      } else {
        data = rows.map(row => {
          const obj: Record<string, string> = {}
          row.forEach((cell, i) => {
            obj[`col${i + 1}`] = cell
          })
          return obj
        })
      }
      
      result.result = TDObjectCoder.get().encode(data)
      result.message = `Parsed ${data.length} rows`
      return result
    } catch (e) {
      result.message = `Error: ${(e as Error).message}`
      result.status = ParseStatus.ERROR
      console.error(e)
      return result
    }
  }

  private parseCSV(str: string): string[][] {
    const rows: string[][] = []
    const lines = str.trim().split('\n')
    
    for (const line of lines) {
      const row: string[] = []
      let cell = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const nextChar = line[i + 1]
        
        if (inQuotes) {
          if (char === '"') {
            if (nextChar === '"') {
              cell += '"'
              i++
            } else {
              inQuotes = false
            }
          } else {
            cell += char
          }
        } else {
          if (char === '"') {
            inQuotes = true
          } else if (char === this.delimiter) {
            row.push(cell.trim())
            cell = ''
          } else {
            cell += char
          }
        }
      }
      
      row.push(cell.trim())
      rows.push(row)
    }
    
    return rows
  }

  stringify(obj: TDNode): string {
    return TDJSONWriter.get().writeAsString(obj, new TDJSONWriterOption().setIndentFactor(2))
  }
}
