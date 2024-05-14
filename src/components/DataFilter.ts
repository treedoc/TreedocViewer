import _ from 'lodash';
import { Query, Column, DataTableOptions, JS_QUERY_DEFAULT } from './Vue2DataTable';
import { TDNode } from 'treedoc';
import { TableUtil } from '../models/TableUtil';

export default {
  filter(opt: DataTableOptions) {
    opt.filteredData = opt.rawData;
    opt.columns.forEach((c) => {
      const f = c.field;
      const fq = opt.query[c.field];
      if (!fq)
        return;
      if (_.isArray(fq))
        opt.filteredData = opt.filteredData.filter(row => fq.includes(row[f]));
      else if (_.isString(fq))
        opt.filteredData  = opt.filteredData.filter(row => row[f] && (`${row[f]}`).toLowerCase().includes(fq.toLowerCase()));
      else {
        console.log(`Unknown query: ${JSON.stringify(fq)}`);
      }

      if (!c.visible)
        opt.filteredData.forEach(r => delete r[c.field]);
    });
    
    if (opt.query.jsQuery && opt.query.jsQuery !== JS_QUERY_DEFAULT) {
      const func = `$=> ${opt.query.jsQuery}`;
      try {
        const filterFunc = eval(func)
        opt.filteredData = opt.filteredData.filter(r => filterFunc(TableUtil.rowToMapWithAllFields(r, opt)));
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
    opt.filteredDataAsObjectArray = opt.filteredData.map(r => TableUtil.rowToObject(r, opt, true, true));
    // opt.columnStatistic = TableUtil.collectColumnStatistics(opt.filteredDataAsObjectArray, opt.columns.filter(c => c.visible).map(c => c.field));
    const end = (q.offset === undefined || !q.limit) ? undefined : q.offset + q.limit;
    return opt.data = opt.filteredData.slice(q.offset, end);
  },
  
};
