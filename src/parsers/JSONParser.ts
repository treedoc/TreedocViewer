import { ParserPlugin, ParseResult } from '../models/JTTOption';
import { TDJSONParser, TDJSONParserOption, TDNodeType, TDNode, TDJSONWriter, TDJSONWriterOption } from 'treedoc';
import YAMLParser from './YAMLParser';

export class JSONParserOption {
}

export default class JSONParser implements ParserPlugin<JSONParserOption> {
  name = 'JSON/JSONEX';
  syntax = 'json';
  option: JSONParserOption = {};

  looksLike(str: string): boolean {
    if (new YAMLParser().looksLike(str))
      return false;

    for (let i = 0; i < 1000 && i < str.length; i++) {
      if (str[i] === '[' || str[i] === '{')
        return true;
    }
    return false;
  }

  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      result.result = TDJSONParser.get().parse(new TDJSONParserOption(str).setDefaultRootType(TDNodeType.MAP));
      result.message = 'TDJSONParser.parser()';
      return result;
    } catch (e2) {
      result.message = `Error:${e2.message}`;
      console.error(e2);
      return result;
    }
  }

  stringify(obj: TDNode): string {
    return TDJSONWriter.get().writeAsString(obj, new TDJSONWriterOption().setIndentFactor(2));
  }
}
