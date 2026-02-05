import type { ParserPlugin, ParseResult, ParserSyntax } from '../models/types'
import { ParseStatus } from '../models/types'
import { TDNode, TDObjectCoder } from 'treedoc'
import PrometheusParser from './PrometheusParser'

export interface PrometheusParserOption {}

export default class PrometheusParserPlugin implements ParserPlugin<PrometheusParserOption> {
  syntax: ParserSyntax = 'prometheus'
  option: PrometheusParserOption = {}

  constructor(public name = 'Prometheus') {}

  looksLike(str: string): boolean {
    return str.indexOf('\n# HELP ') >= 0 && str.indexOf('\n# TYPE ') >= 0
  }

  parse(str: string): ParseResult {
    const result: ParseResult = {
      status: ParseStatus.SUCCESS,
      message: '',
    }
    
    try {
      const parsed = new PrometheusParser().parse(str)
      result.result = TDObjectCoder.get().encode(parsed)
      result.message = 'PrometheusParser.parse()'
      return result
    } catch (e) {
      result.message = `Error: ${(e as Error).message}`
      result.status = ParseStatus.ERROR
      console.error(e)
      return result
    }
  }

  stringify(obj: TDNode): string {
    return obj.toJSON()
  }
}
