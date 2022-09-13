import YAML from 'yaml';
import { ParserPlugin, ParseResult } from '../models/TDVOption';
import { TDObjectCoder } from 'treedoc';
import XMLParserPlugin from './XMLParserPlugin';
import Util from '@/util/Util';

export class YMLParserOption {
}

export default class YAMLParserPlugin implements ParserPlugin<YMLParserOption> {
  name = 'YAML';
  syntax = 'yaml';
  option: YMLParserOption = {};

  looksLike(str: string): boolean {
    if (new XMLParserPlugin().looksLike(str))
      return false;

    if (Util.nonBlankStartsWith(str, ['{', '[']))  // Don't accept JSON
      return false;

    // A line aligned partial YAML from beginning is also a valid YAML file
    // JSON is not the case. That's how we guess if the file is a YAML instead of JSON.
    const topLines = Util.topLines(str, 5000);
    if (topLines.numLines <= 1)
      return false;  // Single line 

    try {
      this.parseYaml(str.substring(0, topLines.length));
      return true;
    } catch (e) {
      return false;
    }
  }

  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      // Not sure why some string accepted by parse(), but can't accepted by parseAllDocuments()
      // const doc = YAML.parseAllDocuments(str);
      // doc[0].cstNode

      result.result = TDObjectCoder.get().encode(this.parseYaml(str));
      result.message = 'YAML.parse()';
      return result;
    } catch (e) {
      result.message = `Error:${e.message}`;
      console.error(e);
      return result;
    }
  }

  /** Try parse and parseAllDocuments */
  parseYaml(str: string): any {
    try {
      return YAML.parse(str);
    } catch (e) {
      return YAML.parseAllDocuments(str);
    }
  }

  stringify(obj: any): string {
    return YAML.stringify(obj);
  }
}
