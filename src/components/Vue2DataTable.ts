export declare interface Column {
  field: string;
  visible?: boolean;
  html?: ((value: any, row: any) => string) | string;  //
  [key: string]: any;
}

export declare interface Query {
  sort?: string;
  order?: boolean | 'asc' | 'desc';
  offset: number;
  limit: number;
  jsQuery?: string;
  [key: string]: any;
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
  filteredData: any[];
}
