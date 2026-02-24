import { ColumnStatistic } from '@/models/TableUtil';
import { TD, TDNodeType } from 'treedoc';

export declare interface Column {
  field: string;
  visible?: boolean;
  html?: ((value: any, row: any) => string) | string;  //
  [key: string]: any;
}

export class FieldQuery {
  query: string = '';
  compiledQuery: string = '';
  isRegex: boolean = false;
  // If it's array, the query string will be parsed with JSONex Parser as array of string
  // For example: "abc,def" will be parsed as ["abc", "def"], '"ab\"c", "def"' will be parsed as ['ab"c', 'def']
  isArray: boolean = false;
  isNegate: boolean = false;
  
  queryCompiled?: (string | RegExp)[];

  compile() {
    // Avoid recompile if query is not changes which will cause infinite update loop from vue
    if (this.query === this.compiledQuery)
      return;
    this.compiledQuery = this.query;

    if (!this.query) {
      this.queryCompiled = [];
      return;
    }
    const values: string[] = this.isArray ? TD.parse(this.query, {defaultRootType: TDNodeType.ARRAY}) : [this.query];
    // console.log('compile', this.query, values);
    this.queryCompiled = values.map(q => {
      // console.log('compile', q)
      return this.isRegex ? new RegExp(q, 'i') : q.toString().toLowerCase();
    });
  }

  match(value: string): boolean {
    if (!this.query)
      return true;
    let result = false;
    for (const q of this.queryCompiled!) {
      if (q instanceof RegExp) {
        if (q.test(value)) {
          result = true;
          break;
        }
      } else {
        if (value.toLocaleLowerCase().indexOf(q) >= 0) {
          result = true;
          break;
        }
      }
    }
    return this.isNegate !== result;
  }
}

export const JS_QUERY_DEFAULT = '$';
export class Query {
  sort?: string;
  order?: boolean | 'asc' | 'desc';
  offset: number = 0;
  limit: number = 100;
  jsQuery? = JS_QUERY_DEFAULT;
  // In Javascript map syntax: e.g.  "{createdDate: $.created.date, nameUpper: $.name.toUpperCase()}"
  extendedFields?: string; 
  fieldQueries: {[key:string]: FieldQuery} = {};
  // [key: string]: any;

  constructor() {
    this.fieldQueries = {};
  }

  match(row: any): boolean {
    Object.values(this.fieldQueries).forEach(fq => fq.compile());
    for (const f of Object.keys(this.fieldQueries)) {
      const fq = this.fieldQueries[f];
      if (!fq.match(`${row[f]}`))
        return false;
    }
    return true;
  }
}

export declare interface TableConfig {
  Pagination?: boolean;
  fixHeaderAndSetBodyMaxHeight?: string | number;
  tblStyle?: string;
  tblClass?: string;
  pageSizeOptions?: number[];
  columns: Column[];
}

// https://onewaytech.github.io/vue2-datatable/doc/#/en/details/datatable-props
export declare interface DataTableOptions extends TableConfig {
  data: any[];
  total: number;
  query: Query;
  xprops: { [key: string]: any };
  rawData: any[];
  selection?: any[];
  filteredData: any[];
  // filteredDataAsObjectArray: any[]; 
  // columnStatistic: {[key: string]: ColumnStatistcs};
}
