import type { ParserPlugin, ParseResult, ParserSyntax } from '../models/types'
import { ParseStatus } from '../models/types'
import { topLines } from '../utils/Util'
import { CSVOption, CSVWriter, TDNode } from 'treedoc'
import { TDObjectCoder, TDJSONWriter, TDJSONWriterOption, CSVParser } from 'treedoc'

export interface CSVParserOption {
  delimiter?: string
  hasHeader?: boolean
}

export default class CSVParserPlugin implements ParserPlugin<CSVParserOption> {
  syntax: ParserSyntax = 'csv'
  option: CSVParserOption = {}

  constructor(
    public name = 'CSV',
    public delimiter = ',',
    public hasHeader = true
  ) {
    this.option = { delimiter, hasHeader }
  }

  looksLike(str: string): boolean {
    const tps = topLines(str, 5000);
    if (tps.numLines <= 1)
      return false;  // Single line 
    try {
      const node = CSVParser.get().parse(str.substr(0, tps.length), this.csvOption);
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


  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  get csvOption(): CSVOption {
    return new CSVOption().setFieldSep(this.delimiter).setIncludeHeader(this.hasHeader);
  }

  parse(str: string): ParseResult {
    const result: ParseResult = {
      status: ParseStatus.SUCCESS,
      message: '',
    }

    try {
      result.result = CSVParser.get().parse(str, this.csvOption);
      result.message = 'CSVParser.parse()';
      return result;
    } catch (e2) {
      result.message = `Error:${(e2 as any).message}`;
      console.error(e2);
      return result;
    }
  }

  stringify(obj: TDNode): string {
    return CSVWriter.get().writeAsString(obj, this.csvOption);
  }
}
