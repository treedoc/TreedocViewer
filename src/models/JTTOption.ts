import { Component } from 'vue';

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

  parse(str: string): ParseResult;
  stringify(obj: any): string;
  configComp?: Component;
}

export default class JTTOptions {
  parsers?: Array<ParserPlugin<any>>;
}
