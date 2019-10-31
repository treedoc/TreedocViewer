import { ParserPlugin, ParseResult } from '../models/JTTOption';
import { TDJSONParser, TDJSONParserOption, TDNodeType } from 'jsonex-treedoc';

export class JSONParserOption {
}

export default class JSONParser implements  ParserPlugin<JSONParserOption> {
  name = 'JSON/JSONEX';
  option: JSONParserOption = {};

  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      result.result = JSON.parse(str);
      result.message = 'JSON.parse()';
      return result;
    } catch (e) {
      try {
        // tslint:disable-next-line: no-eval
        result.result = eval(`(${str})`);
        result.message = 'eval()';
        return result;
      } catch (e1) {
        try {
          result.result = TDJSONParser.get().parse(new TDJSONParserOption(str).setDefaultRootType(TDNodeType.MAP)).toObject();
          result.message = 'TDJSONParser.parser()';
          return result;
        } catch (e2) {
          result.message = `Error:${e2.message}`;
          console.error(e2);
          return result;
        }
      }
    }
  }

  stringify(obj: any): string {
    return JSON.stringify(obj, null, 2);
  }
}
