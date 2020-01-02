import YAML from 'yaml';
import { ParserPlugin, ParseResult } from '../models/JTTOption';
import { TDObjectCoder } from 'jsonex-treedoc';
import XMLParser from './XMLParser';

export class YMLParserOption {
}

export default class YAMLParser implements ParserPlugin<YMLParserOption> {
  name = 'YAML';
  syntax = 'yaml';
  option: YMLParserOption = {};

  looksLike(str: string): boolean {
    if (new XMLParser().looksLike(str))
      return false;

    // A line aligned partial YAML from begining is also a valid YAML file
    // JSON is not the case. That's how we guesss if the file is a YAML instead of JSON.
    let i = 0;
    let lastLine = 0;
    for (let lines = 0; i < 1000 && i < str.length; i++) {
      const c = str[i];
      if (c === '\r' || c === '\n') {
        lines ++;
        if (lines >= 10)
          break;
        lastLine = i;
      }
    }

    if (i === str.length || i === 1000)
      i = lastLine;

    if (i === 0)
      return false;  // a simple line mostly doesn't look like YAML.

    try {
      YAML.parse(str.substr(0, i));
      return true;
    } catch (e) {
      return false;
    }
  }
  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      const doc = YAML.parseAllDocuments(str);
      // doc[0].cstNode

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
