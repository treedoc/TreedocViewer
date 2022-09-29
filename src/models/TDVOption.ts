import { Component } from 'vue';
import { TDNode } from 'treedoc';
import { DataTableOptions } from '../components/Vue2DataTable';

export enum ParseStatus {
  SUCCESS,
  WARN,
  ERROR,
}

export class ParseResult {
  result?: TDNode;
  status = ParseStatus.SUCCESS;
  message = '';
}

export interface ParserPlugin<TOpt> {
  name: string;
  syntax: string;
  option: TOpt;

  looksLike(str: string): boolean;
  parse(str: string): ParseResult;
  stringify(obj: TDNode): string;
  configComp?: Component;
}

export default class TDVOptions {
  maxPane?: string;
  textWrap?: boolean;
  showTable?: boolean;
  showSource?: boolean;
  showTree?: boolean;

  parsers?: ParserPlugin<any>[];

  // If pattern is string, it will use wildcard matching
  tableOptRules?: {pattern: RegExp | string, opt: DataTableOptions};
  defaultTableOpt?: DataTableOptions = {
    // fixHeaderAndSetBodyMaxHeight: 200,
    // tblStyle: 'table-layout: fixed', // must
    tblClass: 'table-bordered',
    pageSizeOptions: [5, 20, 50, 100, 200, 500],
    columns: [],
    data: [],
    filteredData: [],
    rawData: [],
    total: 0,
    query: { limit: 100, offset: 0 },
    xprops: { tstate: null },
  };

  setParsers(parsers?: ParserPlugin<any>[]) {
    this.parsers = parsers;
    return this;
  }
}
