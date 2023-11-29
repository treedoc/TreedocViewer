import { TDNode, TreeDoc, Bookmark, TDObjectCoder, TDNodeType, JSONPointer } from 'treedoc';
import History from './History';
import { ParserPlugin, ParseStatus } from './TDVOption';
import JSONParserPlugin from '../parsers/JSONParserPlugin';
import { Query, Column, DataTableOptions } from '@/components/Vue2DataTable';
import { TreeState } from '@/lib';
import Lazy from './Lazy';

// State associated with particular node and need to be cached during navigation
export class TableNodeState {
  constructor(
    public query: Query = { limit: 100, offset: 0 },
    public expandedLevel: number = 0,
    public columns: Column[] = [],
    public isColumnExpanded: boolean = false) { }

  public copyOf(): TableNodeState {
    return new TableNodeState(
      { ...this.query },
      this.expandedLevel,
      this.columns,
      this.isColumnExpanded);
  }
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
    filteredData: [],
    filteredDataAsObjectArray: [],
    rawData: [],
    total: 0,
    query: { limit: 100, offset: 0 },
    xprops: { tstate: null, columnStatistic: {} },
    columnStatistic: {},
  };
}

export default class TableState extends TableNodeState {
  // _rawData = new Lazy<any[]>();  // the full dataset related to current node
  filteredData: any[] | null = null; // the data after filtering
  sortedData: any[] | null = null;  // the sorted data
  hasTree = false;  // If there's tree widget in the cells

  constructor(
    public treeState: TreeState,
    public tableOpt: TDVTableOption = new TDVTableOption()) {
      super()
    }

  // buildDataTableOption() {
  // }

  // private get rawData() {
  //   return this._rawData.get(() => {
  //     return [];
  //   };
  // }
}
