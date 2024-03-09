import { TDNode, TreeDoc, Bookmark, TDObjectCoder, TDNodeType, JSONPointer } from 'treedoc';
import History from './History';
import { ParserPlugin, ParseStatus } from './TDVOption';
import JSONParserPlugin from '../parsers/JSONParserPlugin';
import { Query, Column, DataTableOptions, JS_QUERY_DEFAULT } from '@/components/Vue2DataTable';
import { TreeState } from '@/lib';
import Lazy from './Lazy';
import { ExpandState } from '@/components/ExpandControl.vue';
import DataFilter from '@/components/DataFilter';
import stopWatch from '@/util/stopWatch';
import _, { get } from 'lodash';
import { TableUtil } from './TableUtil';

const COL_VALUE = '@value';
const COL_NO = '#';
const COL_KEY = '@key';


// State associated with particular node and need to be cached during navigation
export class TableNodeState {
  constructor(
    public query: Query = { limit: 100, offset: 0, fields: {} },
    public expandedLevel: number = 0,
    public columns: Column[] = [],
    public isColumnExpanded: boolean | null = null) { }

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
    query: { limit: 100, offset: 0, fields:{}},
    xprops: { tstate: null, columnStatistic: {} },
    columnStatistic: {},
  };

  getDataTableOption(path?: string|null): DataTableOptions {
    if (path === null || path === undefined)
      return {...this.defTableOpt};
    for (const r of this.tableOptionRules) {
      if (r.pattern instanceof RegExp) {
        if (r.pattern.test(path))
          return {...this.defTableOpt, ...r.opt};
      } else if (path === r.pattern)
        return {...this.defTableOpt, ...r.opt};
    }
    return {...this.defTableOpt};
  }
}

export default class TableState extends TableNodeState {
  dataTableOption: DataTableOptions;
  expandState: ExpandState = new ExpandState();

  private currentNode?: TDNode | null = null;
  rawData: any[] | null = null;
  filteredData: any[] | null = null; // the data after filtering
  pagedData: any[] | null = null;   // the data after paging
  hasTree = false;  // If there's tree widget in the cells

  constructor(
    public treeState: TreeState,
    public tableOpt: TDVTableOption = new TDVTableOption()) {
    super()
    this.dataTableOption = {...tableOpt.defTableOpt}
  }

  setCurrentNode(val: TDNode) {
    if (val === this.currentNode)
      return;
    this.currentNode = val;
    this.dataTableOption = this.tableOpt.getDataTableOption(val.pathAsString);
    const cachedState = this.treeState.tableStateCache.get(this.treeState.selectedPath || '');
    if (cachedState) {
      this.dataTableOption.query = cachedState.query;
      this.dataTableOption.columns = cachedState.columns;
      this.isColumnExpanded = cachedState.isColumnExpanded;
    }
    this.resetRawData();
  }

  resetRawData() {
    this.rawData = null;
    this.resetFilteredData();
  }

  resetFilteredData() {
    this.filteredData = null;
    this.resetPagedData();
  }

  resetPagedData() {
    this.pagedData = null;
  }

  onColumnChanged() {
    this.pagedData = null;
  }

  onQueryChange(oldQuery: Query, newQuery: Query) {
    if (oldQuery.extendedFields !== newQuery.extendedFields) {
      this.resetRawData();
    } else if (oldQuery.fields !== newQuery.fields || oldQuery.jsQuery !== newQuery.jsQuery || oldQuery.sort !== newQuery.sort || oldQuery.order !== newQuery.order) {
      this.resetFilteredData();
    } else if (oldQuery.sort !== newQuery.sort || oldQuery.order !== newQuery.order) {
      this.resetFilteredData();
    } else if (oldQuery.offset !== newQuery.offset || oldQuery.limit !== newQuery.limit) {
      this.pagedData = null;
    }
  }

  rebuildTable(val: TDNode | null) {
    this.buildTableAndQuery(val);
    this.treeState.hasTreeInTable = false;
    // console.log('clear hasTreeInTable');
    this.dataTableOption.xprops.tstate = this.treeState;
    this.expandState = new ExpandState(cachedState ? cachedState.expandedLevel : 0, 0, this.expandState.showChildrenSummary);
    this.dataTableOption.xprops.expandState = this.expandState;
  }

  get applyCustomOpts() {
    return this.treeState.isInitialNodeSelected() && this.isColumnExpanded && this.dataTableOption.columns.length > 0;
  }

  buildTableAndQuery() {
    this.getRawData();
    this.queryData();
  }

  getRawData(): any[] {
    if (this.rawData)
      return this.rawData;

    this.currentNode = this.treeState.selected;
    this.rawData = [];
    if (!this.currentNode)
     return this.rawData;
    
     const n = this.currentNode;
    let extFunc = null;
    if (this.query.extendedFields) {
      const exp = `
        with($) {   // With doesn't work with Proxy (not sure why)
          // console.log(JSON.stringify($));
          return {${this.query.extendedFields}}
        }
      `;
      try { 
        extFunc = new Function('$', exp);
      } catch(e) {
        console.error(`Error parsing extend fields: ${exp}`);
        console.error(e);
      }
    }

    const ia = n.type === TDNodeType.ARRAY;
    const keyCol = ia ? COL_NO : COL_KEY;
    this.addColumn(keyCol, 0);
    if (n.children) {
      for (const v of n.children) {
        const row = {
          [keyCol]: ia ? Number(v.key) : v.key,
          [COL_VALUE]: v,
        };
        this.rawData.push(row);
        if (this.isColumnExpanded && v && v.children) {
          for (const cv of v.children) {
            this.addColumn(cv.key!);
            row[cv.key!] = cv;
          }
        } else {
          this.addColumn(COL_VALUE, 1);
        }
        if (extFunc) {
          try {
            const ext = extFunc(v.toObject(true, true));
            for (const k in ext)
              // if(!k.startsWith('$$'))   // internal fields (e.g. $$tdNode)
                this.addExtObject(k, ext[k], row);
          } catch(e) {
            console.error(`Error evaluate ext fields: ${this.query.extendedFields}`);
            console.error(e);
          }
        }
      }
    }
    return this.rawData;
  }

  addExtObject(key: string, val: any, row: any) {
    if (key.endsWith('_') && val) {  // spread the children
      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          this.addColumn(key + i);
          row[key+i] = val[i]?.$$tdNode || val[i];
        }
        return;
      } else if (typeof val === 'object') {
        for (const k of Object.keys(val)) {
          if(k.startsWith('$$')) continue;
          this.addColumn(key + k);
          row[key+k] = val[k]?.$$tdNode || val[k];
        }
        return;
      }
    }
    this.addColumn(key);
    row[key] = val?.$$tdNode || val;
  }

  addColumn(field: string, idx = this.dataTableOption.columns.length) {
    const isKeyCol = idx === 0;
    const cols = this.dataTableOption.columns;
    let col = cols.find(c => c.field === field);
    if (!col) {
      col = {
        field,
        visible: isKeyCol || !(this.applyCustomOpts && this.tableOpt.getDataTableOption()!.columns),
      };
      cols.splice(idx, 0, col);
    }
    if (col.processed)
      return;
    
    col.processed = true;
    col.title = col.title || field;
    col.sortable = true;
    col.isKeyCol = isKeyCol;
    // TODO: support custom component in the Vue component
    // col.thComp = col.thComp || thFilter;
    // col.tdComp = col.tdComp || (isKeyCol ? tdKey : tdValue);
    // VUETIP: we have to use Vue.$set, otherwise, once it's assigned with array syntax. this field will no longer
    // be reactive
    // TODO: do this operation in the Vue component to make it reactive
    // this.tableOpt.query[field] = '';
    // this.$set(this.tableOpt.query, field, undefined);

    col.thClass = 'tdv-th';
    col.tdClass = 'tdv-td';
    if (isKeyCol) {
      col.thClass += ' tdv-min tdv-td';
      col.tdClass = 'tdv-min tdv-td';
    }
  }

  getFilteredData() {
    if (this.filteredData)
      return this.filteredData;

    stopWatch.logWithReset('filter start');
    let res = [...this.getRawData()];
    const opt = this.dataTableOption;
    opt.columns.forEach((c) => {
      const f = c.field;
      const fq = opt.query.fields[c.field];
      if (!fq)
        return;
      if (_.isArray(fq))
        res = res.filter(row => fq.includes(row[f]));
      else if (_.isString(fq))
        res  = res.filter(row => row[f] && (`${row[f]}`).toLowerCase().includes(fq.toLowerCase()));
      else {
        console.log(`Unknown query: ${JSON.stringify(fq)}`);
      }

      // TODO move to sortedData
      // if (!c.visible)
      //   opt.filteredData.forEach(r => delete r[c.field]);
    });
    
    if (opt.query.jsQuery && opt.query.jsQuery !== JS_QUERY_DEFAULT) {
      const func = `$=> ${opt.query.jsQuery}`;
      try {
        const filterFunc = eval(func)
        res = res.filter(r => filterFunc(TableUtil.rowToMapWithAllFields(r, opt)));
      } catch(e) {
        // When run in chrome extension, eval is not allowed
        console.error(`Error evaluate JSQuery:${func}`);
        console.error(e)
      }
    }

    if (opt.query.sort) {
      const getFieldValue = (row: any) => {
        const v = row[q.sort!];
        return v instanceof TDNode && v.value !== undefined ? v.value : v;
      };

      res  = _.orderBy(res , getFieldValue, opt.query.order);
    }

    return this.filteredData = res;
  }

  getPagedData() {
    if (this.pagedData != null)
      return this.pagedData;

    const filtedData = this.getFilteredData();
    const q = this.dataTableOption.query;
    this.dataTableOption.total = filtedData.length;
    if (q.offset >= this.dataTableOption.total)
      q.offset = Math.max(0, this.dataTableOption.total - q.limit);
 
    const end = (q.offset === undefined || !q.limit) ? undefined : q.offset + q.limit;
    let res = this.getFilteredData().slice(q.offset, end);

    for (let i = 0; i < res.length; i++){
      const r = {...res[i]};
      this.dataTableOption.columns.forEach((c) => {
        const f = c.field;
        if (!c.visible)
          delete r[f];
        else if (r[f] instanceof TDNode)
          this.hasTree = true;
      });
    }    
    return this.pagedData = res;
  }


  // buildDataTableOption() {
  // }

  // private get rawData() {
  //   return this._rawData.get(() => {
  //     return [];
  //   };
  // }

  defaultExpand(val: TDNode) {
    if (!val)
      return false;
    const cols = new Set<string>();
    let cellCnt = 0;
    if (!val.children || val.children.length === 0)
      return false;

    for (const v of val.children) {
      if (v && v.children) {
        for (const child of v.children) {
          cols.add(child.key!);
          cellCnt++;
        }
      }
    }
    // k: threshold (blank cell / Total possible blank cells)
    // k = (r * c - cellCnt) / (r * c - c) => cellCnt = r * c - k * r * c + k * c = c (r - r * k + k) = c (r - (r-1)k)
    //     When row = 2:   2c(1-k) + ck = 2c - kc = (2-k)c <= cellcnt
    //     When row = 3:   3c(1-k) + ck = 3c - 2ck = (3-2k)c
    const k = 0.8;
    const r = val.children.length;
    const c = cols.size - 1;  // ignore the first column, as the key column is always there
    cellCnt -= r;
    // Limited number of cols due to performance reason
    return cols.size < 100 && cellCnt >= c * (r - (r - 1) * k);
  }  
}
