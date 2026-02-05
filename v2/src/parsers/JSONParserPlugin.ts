import type { ParserPlugin, ParseResult, ParserSyntax } from '../models/types'
import { ParseStatus } from '../models/types'
import { TDJSONParser, TDJSONParserOption, TDNodeType, TDNode, TDJSONWriter, TDJSONWriterOption, StringCharSource, TreeDoc } from 'treedoc'

export interface JSONParserOption {
  type?: JSONParserType
}

export enum JSONParserType {
  NORMAL = 'NORMAL',
  JAVA_MAP_TO_STRING = 'JAVA_MAP_TO_STRING',
  LOMBOK_TO_STRING = 'LOMBOK_TO_STRING',
}

function nonBlankEndsWith(str: string, endings: string[]): boolean {
  const trimmed = str.trimEnd()
  return endings.some(end => trimmed.endsWith(end))
}

export default class JSONParserPlugin implements ParserPlugin<JSONParserOption> {
  syntax: ParserSyntax = 'json'
  option: JSONParserOption = {}

  constructor(
    public name = 'JSON/JSONEX',
    public type = JSONParserType.NORMAL
  ) {}

  looksLike(str: string): boolean {
    // Check if it looks like YAML first
    const trimmed = str.trim()
    if (trimmed.startsWith('---') || (trimmed.startsWith('-') && !trimmed.startsWith('-{'))) {
      return false
    }
    
    if (str.length < 1000000 && this.parse(str).status !== ParseStatus.SUCCESS) {
      return false
    }
    
    const opt = this.getTDJSONParserOption(this.type)
    if (!nonBlankEndsWith(str, [opt.deliminatorObjectEnd as string, opt.deliminatorArrayEnd as string])) {
      return false
    }
    
    let pColon = str.indexOf(':')
    let pEqual = str.indexOf('=')
    pColon = pColon < 0 ? Number.MAX_SAFE_INTEGER : pColon
    pEqual = pEqual < 0 ? Number.MAX_SAFE_INTEGER : pEqual
    
    if (pColon > pEqual) {
      return this.type === JSONParserType.JAVA_MAP_TO_STRING || this.type === JSONParserType.LOMBOK_TO_STRING
    }
    
    return true
  }

  parse(str: string): ParseResult {
    const result: ParseResult = {
      status: ParseStatus.SUCCESS,
      message: '',
    }
    
    try {
      const src = new StringCharSource(str)
      const nodes: TDNode[] = []
      const opt = this.getTDJSONParserOption(this.type)
      opt.setDefaultRootType(TDNodeType.MAP)
      
      while (src.skipSpacesAndReturnsAndCommas()) {
        nodes.push(TDJSONParser.get().parse(src, opt))
      }
      
      result.result = nodes.length === 1 ? nodes[0] : TreeDoc.merge(nodes).root
      result.message = 'TDJSONParser.parse()'
      return result
    } catch (e) {
      result.message = `Error: ${(e as Error).message}`
      result.status = ParseStatus.ERROR
      console.error(e)
      return result
    }
  }

  private getTDJSONParserOption(type: JSONParserType): TDJSONParserOption {
    switch (type) {
      case JSONParserType.JAVA_MAP_TO_STRING:
        return TDJSONParserOption.ofMapToString()
      case JSONParserType.LOMBOK_TO_STRING:
        return new TDJSONParserOption().setDeliminatorKey('=').setDeliminatorObject('(', ')')
      default:
        return new TDJSONParserOption()
    }
  }

  stringify(obj: TDNode): string {
    return TDJSONWriter.get().writeAsString(obj, new TDJSONWriterOption().setIndentFactor(2))
  }
}
