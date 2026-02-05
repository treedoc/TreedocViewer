import type { ParserPlugin, ParseResult, ParserSyntax } from '../models/types'
import { ParseStatus } from '../models/types'
import type { TDNode } from 'treedoc'
import { TDObjectCoder, TDJSONWriter, TDJSONWriterOption, TreeDoc } from 'treedoc'
import YAML from 'yaml'

export interface YAMLParserOption {
  multiDocument?: boolean
}

export default class YAMLParserPlugin implements ParserPlugin<YAMLParserOption> {
  syntax: ParserSyntax = 'yaml'
  option: YAMLParserOption = {}

  constructor(public name = 'YAML') {}

  looksLike(str: string): boolean {
    const trimmed = str.trim()
    // YAML typically starts with --- or has key: value patterns without braces
    if (trimmed.startsWith('---')) return true
    if (trimmed.startsWith('-') && !trimmed.startsWith('-{')) return true
    
    // Check if it has YAML-like structure (key: value without braces)
    const lines = trimmed.split('\n').slice(0, 5)
    const hasYamlPattern = lines.some(line => {
      const match = line.match(/^\s*[\w-]+:\s*/)
      return match && !line.includes('{') && !line.includes('[')
    })
    
    return hasYamlPattern
  }

  parse(str: string): ParseResult {
    const result: ParseResult = {
      status: ParseStatus.SUCCESS,
      message: '',
    }
    
    try {
      // Check for multi-document YAML
      if (str.includes('\n---')) {
        const docs = YAML.parseAllDocuments(str)
        const nodes = docs.map(doc => TDObjectCoder.get().encode(doc.toJSON()))
        result.result = nodes.length === 1 ? nodes[0] : TreeDoc.merge(nodes).root
        result.message = 'YAML.parseAllDocuments()'
      } else {
        const parsed = YAML.parse(str)
        result.result = TDObjectCoder.get().encode(parsed)
        result.message = 'YAML.parse()'
      }
      return result
    } catch (e) {
      result.message = `Error: ${(e as Error).message}`
      result.status = ParseStatus.ERROR
      console.error(e)
      return result
    }
  }

  stringify(obj: TDNode): string {
    return TDJSONWriter.get().writeAsString(obj, new TDJSONWriterOption().setIndentFactor(2))
  }
}
