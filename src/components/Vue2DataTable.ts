export declare interface Column {
  field: string;
  visible?: boolean;
  [key: string]: any;
}

export declare interface Query {
  sort?: string;
  order?: boolean | 'asc' | 'desc';
  offset: number;
  limit: number;
  [key: string]: any;
}

// https://onewaytech.github.io/vue2-datatable/doc/#/en/details/datatable-props
export declare interface DatatableOptions {
  fixHeaderAndSetBodyMaxHeight?: string | number;
  tblStyle?: string;
  tblClass?: string;
  pageSizeOptions?: number[];
  columns: Column[];
  data: any[];
  total: number;
  query: Query;
  xprops: { [key: string]: any };
  rawData: any[];
}
