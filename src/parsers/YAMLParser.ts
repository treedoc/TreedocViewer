import YAML from 'yaml';
import { ParserPlugin, ParseResult } from '../models/JTTOption';
import { TDObjectCoder } from 'jsonex-treedoc';

export class YMLParserOption {
}

export default class YAMLParser implements ParserPlugin<YMLParserOption> {
  name = 'YAML';
  syntax = 'yaml';
  option: YMLParserOption = {};

  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      result.result = TDObjectCoder.get().encode(YAML.parse(str));
      result.message = 'YAML.parse()';
      return result;
    } catch (e) {
      result.message = `Error:${e.message}`;
      console.error(e);
      return result;
    }
  }

  stringify(obj: any): string {
    return YAML.stringify(obj);
  }
}
