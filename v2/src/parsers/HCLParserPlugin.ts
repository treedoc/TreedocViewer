import type { ParserPlugin, ParseResult, ParserSyntax } from '../models/types'
import { ParseStatus } from '../models/types'
import { TDJSONParser, TDJSONWriter, TDJSONWriterOption, type TDNode } from 'treedoc'
import * as hcl from 'hcl2-parser'

/** HCL2 structure is converted to JSON; expressions are retained, not evaluated. */
export default class HCLParserPlugin implements ParserPlugin {
  syntax: ParserSyntax = 'hcl'
  option = {}

  constructor(public name = 'HCL') {}

  looksLike(str: string): boolean {
    // Only inspect the first declaration, skipping leading HCL comments. This
    // avoids stealing JSON/Java maps, YAML, CSV, and Prometheus inputs.
    const start = str.replace(/^(?:\s+|#[^\n]*(?:\n|$)|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '')
    if (/^[\w:]+\{[^\n}]*\}\s+(?:[-+]?\d|NaN|[-+]?Inf)/.test(start)) return false
    return /^[\p{L}_][\p{L}\p{N}_-]*\s*(?:=(?!=)|(?:"(?:[^"\\]|\\.)*"\s*|[\p{L}_][\p{L}\p{N}_-]*\s+)*\{)/u.test(start)
  }

  parse(str: string): ParseResult {
    try {
      // The Go wrapper returns [value, error], despite its declared return type.
      const [json, error] = hcl.parseToString(str) as unknown as [string, unknown]
      if (error != null) {
        // GopherJS exposes the Go error as an opaque object, without diagnostics.
        return { status: ParseStatus.ERROR, message: 'Error: Invalid HCL syntax. Check attributes, expressions, and matching delimiters.' }
      }
      return {
        status: ParseStatus.SUCCESS,
        message: 'HCL2.parse()',
        result: TDJSONParser.get().parse(json),
      }
    } catch (error) {
      return { status: ParseStatus.ERROR, message: `Error: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  stringify(obj: TDNode): string {
    return TDJSONWriter.get().writeAsString(obj, new TDJSONWriterOption().setIndentFactor(2))
  }
}
