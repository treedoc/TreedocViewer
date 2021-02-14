import { ParserPlugin, ParseResult } from '../models/TDVOption';
import { CSVParser, CSVOption, CSVWriter, TDNode } from 'treedoc';
import Util from '@/util/Util';

export class CSVParserOption {
}

export default class CSVParserPlugin implements ParserPlugin<CSVParserOption> {
  syntax = 'csv';
  option: CSVParserOption = {};

  constructor(public name = 'CSV', public fieldSep = ',') {}

  looksLike(str: string): boolean {
    const topLines = Util.topLines(str, 5000);
    if (topLines.numLines <= 1)
      return false;  // Single line 
    try {  
      const node = CSVParser.get().parse(str.substr(0, topLines.length));
      const columnSize = node.children![0].getChildrenSize();
      if (columnSize < 2)
        return false;
      for (let row = 1; row < node.getChildrenSize(); row++) {
        if (node.children![row].getChildrenSize() !== columnSize)
          return false;
      }
      return true;
    } catch (e) {
      return false;
    }
    return false;
  }

  get csvOption(): CSVOption {
    return new CSVOption().setFieldSep(this.fieldSep);
  }

  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      result.result = CSVParser.get().parse(str, this.csvOption);
      result.message = 'CSVParser.parser()';
      return result;
    } catch (e2) {
      result.message = `Error:${e2.message}`;
      console.error(e2);
      return result;
    }
  }

  stringify(obj: TDNode): string {
    return CSVWriter.get().writeAsString(obj, this.csvOption);
  }
}
