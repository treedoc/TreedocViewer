import { Component } from 'vue';
import { TDNode } from 'treedoc';
import { DatatableOptions } from '@/components/Vue2DataTable';

export enum ParseStatus {
  SUCCESS,
  WARN,
  ERROR,
}

export class ParseResult {
  result?: any;
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
  parsers?: Array<ParserPlugin<any>>;

  // If pattern is string, it will use wildcard matching
  tableOptRules?: {pattern: RegExp | string, opt: DatatableOptions};
  defaultTableOpt?: DatatableOptions = {
    // fixHeaderAndSetBodyMaxHeight: 200,
    // tblStyle: 'table-layout: fixed', // must
    tblClass: 'table-bordered',
    pageSizeOptions: [5, 20, 50, 100, 200, 500],
    columns: [],
    data: [],
    rawData: [],
    total: 0,
    query: { limit: 100, offset: 0 },
    xprops: { tstate: null },
  };
}
