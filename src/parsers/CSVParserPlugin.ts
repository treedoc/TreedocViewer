import { ParserPlugin, ParseResult } from '../models/TDVOption';
import { CSVParser, CSVOption, CSVWriter, TDNode } from 'treedoc';

export class CSVParserOption {
}

export default class CSVParserPlugin implements ParserPlugin<CSVParserOption> {
  syntax = 'csv';
  option: CSVParserOption = {};

  constructor(public name = 'CSV', public fieldSep = ',') {}

  looksLike(str: string): boolean {
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
