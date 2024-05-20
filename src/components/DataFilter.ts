import _ from 'lodash';
import { Query, Column, DataTableOptions, JS_QUERY_DEFAULT, FieldQuery } from './Vue2DataTable';
import { TDNode } from 'treedoc';
import { TableUtil } from '../models/TableUtil';


export default {
  filter(opt: DataTableOptions) {
    opt.filteredData = opt.rawData.filter(r => opt.query.match(r));

    if (opt.query.jsQuery && opt.query.jsQuery !== JS_QUERY_DEFAULT) {
      const func = `$=> ${opt.query.jsQuery}`;
      try {
        const filterFunc = eval(func)
        opt.filteredData = opt.filteredData.filter(r => filterFunc(TableUtil.rowToMapWithAllFields(r)));
      } catch(e) {
        // When run in chrome extension, eval is not allowed
        console.error(`Error evaluate JSQuery:${func}`);
        console.error(e)
      }
    }

    const q = opt.query;
    opt.total = opt.filteredData.length;
    if (q.offset >= opt.total)
      q.offset = Math.max(0, opt.total - q.limit);
    if (opt.query.sort) {
      const getFieldValue = (row: any) => {
        let v = row[q.sort!];
        v = v instanceof TDNode && v.value !== undefined ? v.value : v;
        return v || '';
      };

      opt.filteredData  =  _.orderBy(opt.filteredData , getFieldValue, q.order);
    }
    const end = (q.offset === undefined || !q.limit) ? undefined : q.offset + q.limit;
    return opt.data = opt.filteredData.slice(q.offset, end);
  },
};
