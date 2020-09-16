import { ParserPlugin, ParseResult } from '../models/JTTOption';
import { TDJSONParser, TDJSONParserOption, TDNodeType, TDNode, TDJSONWriter, TDJSONWriterOption } from 'treedoc';
import YAMLParserPlugin from './YAMLParserPlugin';
import Util from '../util/Util'

export class JSONParserOption {
}

export default class JSONParserPlugin implements ParserPlugin<JSONParserOption> {
  name = 'JSON/JSONEX';
  syntax = 'json';
  option: JSONParserOption = {};

  looksLike(str: string): boolean {
    if (new YAMLParserPlugin().looksLike(str))
      return false;
    return Util.nonBlankStartsWith(str, ['[', '{']) && Util.nonBlankEndsWith(str, ["]", "}"]);
  }

  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      result.result = TDJSONParser.get().parse(str, new TDJSONParserOption().setDefaultRootType(TDNodeType.MAP));
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
