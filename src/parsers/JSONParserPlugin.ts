import { ParserPlugin, ParseResult, ParseStatus } from '../models/TDVOption';
import { TDJSONParser, TDJSONParserOption, TDNodeType, TDNode, TDJSONWriter, TDJSONWriterOption, StringCharSource, TreeDoc } from 'treedoc';
import YAMLParserPlugin from './YAMLParserPlugin';
import Util from '../util/Util';

export class JSONParserOption {
}

export enum JSONParserType {
  NORMAL,
  JAVA_MAP_TO_STRING,
  LOMBOK_TO_STRING,
}

export default class JSONParserPlugin implements ParserPlugin<JSONParserOption> {
  syntax = 'json';
  option: JSONParserOption = {};

  constructor(
    public name = 'JSON/JSONEX', 
    public type = JSONParserType.NORMAL)  {
  }

  looksLike(str: string): boolean {
    if (new YAMLParserPlugin().looksLike(str))
      return false;
    if (str.length < 1000000 && this.parse(str).status !== ParseStatus.SUCCESS)
      return false;
    const opt = this.getTDJSONParserOption(this.type);
    if (!(Util.nonBlankEndsWith(str, [opt.deliminatorObjectEnd, opt.deliminatorArrayEnd])))
      return false;
    let pColon = str.indexOf(':');
    let pEqual = str.indexOf('=');
    pColon = pColon < 0 ? Number.MAX_SAFE_INTEGER : pColon;
    pEqual = pEqual < 0 ? Number.MAX_SAFE_INTEGER : pEqual;
    if (pColon > pEqual) 
      return this.type === JSONParserType.JAVA_MAP_TO_STRING || this.type === JSONParserType.LOMBOK_TO_STRING;
    return true;
  }

  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      const src = new StringCharSource(str);
      const nodes: TDNode[] = [];
      const opt = this.getTDJSONParserOption(this.type);
      opt.setDefaultRootType(TDNodeType.MAP);
      while (src.skipSpacesAndReturnsAndCommas()) 
        nodes.push(TDJSONParser.get().parse(src, opt));
      result.result = nodes.length === 1 ? nodes[0] : TreeDoc.merge(nodes).root;
      result.message = 'TDJSONParser.parse()';
      return result;
    } catch (e2) {
      result.message = `Error:${(e2 as any).message}`;
      result.status = ParseStatus.ERROR;
      console.error(e2);
      return result;
    }
  }

  private getTDJSONParserOption(type: JSONParserType) {
    switch(type) {
      case JSONParserType.JAVA_MAP_TO_STRING: return TDJSONParserOption.ofMapToString();
      case JSONParserType.LOMBOK_TO_STRING: return new TDJSONParserOption().setDeliminatorKey('=').setDeliminatorObject('(', ')');
      default: return new TDJSONParserOption();
    }
  }
  

  stringify(obj: TDNode): string {
    return TDJSONWriter.get().writeAsString(obj, new TDJSONWriterOption().setIndentFactor(2));
  }
}
