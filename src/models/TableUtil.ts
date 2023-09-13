import { CSVWriter, identity, ListUtil, TDNode, TDNodeType, TDObjectCoder } from 'treedoc';
import { DataTableOptions, Column, Query } from '../components/Vue2DataTable';

export class ColumnStatistcs {
  total: number = 0;
  min: any;
  max: any;
  sum: number = 0;
  avg: number = 0;
  valueCounts: {[key: string]: number} = {}
  valueSortedByCounts: string[] = [];
}

export class TableUtil {
  static rowsToObject(rows: any[], tableOpt: DataTableOptions): {[key: string]: any} {
    const result: any = {};
    rows.forEach(row => result[row['@key']] = this.rowToObject(row, tableOpt));
    return result;
  }

  static collectColumnStatistics(rows: any[], columns: string[]): {[key: string]: ColumnStatistcs} {
    const result: {[key: string]: ColumnStatistcs} = {};
    for (const col of columns) {
      const stat = new ColumnStatistcs(); 
      for (const row of rows) { 
        stat.total++;
        let val = row[col];
        if (val === undefined)  // Skip undefined value   
          continue;
        if (typeof val !== 'string' && typeof val !== 'number') { 
          val = JSON.stringify(val);
        }
        if (stat.min === undefined || val < stat.min)
          stat.min = val;   
        if (stat.max === undefined || val > stat.max)
          stat.max = val;
        if (typeof val === 'number')
          stat.sum += val;
        const key = '' + val;
        stat.valueCounts[key] = (stat.valueCounts[key] || 0) + 1;
      } 
      stat.avg = stat.sum / rows.length;  
      stat.valueSortedByCounts = Object.keys(stat.valueCounts).sort((a, b) => stat.valueCounts[b] - stat.valueCounts[a]);
      result[col] = stat;

    } 
    return result;
  }
    
  static rowToObject(row: any, tableOpt: DataTableOptions, includeKey = false, includeValue = true) {
    if (row['@value'] && !includeValue)
      return this.valToObject(row['@value']);
    
    const result: any = {};
    for (const col of tableOpt.columns) {
      if (col.field === '#' || !col.visible) continue;
      if (col.field === '@key' && !includeKey) continue;
      result[col.field] = this.valToObject(row[col.field]);
    }
    return result;
  }

  static rowToMapWithAllFields(row: any, tableOpt: DataTableOptions) {
    return ListUtil.map(row, identity, this.valToObject);
  }

  static valToObject(val: any) {
    return val instanceof TDNode ? val.toObject(false, false) : val;
  }

  static toCSV(val: any) {
    const obj = TDObjectCoder.encode(val);
    return CSVWriter.instance.writeAsString(obj);
  }
}
