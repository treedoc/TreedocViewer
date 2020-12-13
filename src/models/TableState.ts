import { TDNode, TreeDoc, Bookmark, TDObjectCoder, TDNodeType, JSONPointer } from 'treedoc';
import History from './History';
import { ParserPlugin, ParseStatus } from './TDVOption';
import JSONParserPlugin from '../parsers/JSONParserPlugin';
import { Query, Column, DataTableOptions } from '@/components/Vue2DataTable';
import { TreeState } from '@/lib';
import Lazy from './Lazy';

// State associated with particular node
export class TableNodeState {
  constructor(
    public query: Query,
    public expandedLevel: number,
    public columns: Column[],
    public isColumnExpanded: boolean) { }
}

export class TableOptionRule {
  constructor(
    public pattern: RegExp | string,
    public opt: DataTableOptions) { }
}

export class TDVTableOption {
  tableOptionRules: TableOptionRule[] = [];
  defTableOpt: DataTableOptions = {
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

export default class TableState {
  // _rawData = new Lazy<any[]>();  // the full dataset related to current node
  filteredData: any[] | null = null; // the data after filtering
  sortedData: any[] | null = null;  // the sorted data
  hasTree = false;  // If there's tree widget in the cells

  constructor(
    public treeState: TreeState,
    public nodeState: TableNodeState,
    public tableOpt: TDVTableOption) {
    }

  // buildDataTableOption() {
  // }

  // private get rawData() {
  //   return this._rawData.get(() => {
  //     return [];
  //   };
  // }
}
