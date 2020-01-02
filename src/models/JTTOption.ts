import { Component } from 'vue';
import { TDNode } from 'jsonex-treedoc';

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

export default class JTTOptions {
  parsers?: Array<ParserPlugin<any>>;
}
