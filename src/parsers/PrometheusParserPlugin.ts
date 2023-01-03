import { ParserPlugin, ParseResult } from '../models/TDVOption';
import { CSVOption, TDNode, TDObjectCoder } from 'treedoc';
import PrometheusParser from './PrometheusParser';

export class PrometheusParserOption {
}

export default class PrometheusParserPlugin implements ParserPlugin<PrometheusParserOption> {
  syntax = 'csv';
  option: PrometheusParserOption = {};

  constructor(public name = 'Prometheus', public fieldSep = ',') {}

  looksLike(str: string): boolean {
    return str.indexOf('\n# HELP ') >= 0 && str.indexOf('\n# TYPE ') >= 0
  }

  get csvOption(): CSVOption {
    return new CSVOption().setFieldSep(this.fieldSep);
  }

  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      result.result = TDObjectCoder.get().encode(new PrometheusParser().parse(str));
      result.message = 'PrometheusParser.parse()';
      return result;
    } catch (e2) {
      result.message = `Error:${(e2 as any).message}`;
      console.error(e2);
      return result;
    }
  }

  stringify(obj: TDNode): string {
    return obj.toJSON();
  }
}
