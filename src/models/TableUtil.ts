import { CSVWriter, identity, ListUtil, TDNode, TDNodeType, TDObjectCoder } from 'treedoc';
import { DataTableOptions, Column, Query } from '../components/Vue2DataTable';

export class TableUtil {
  static rowsToObject(rows: any[], tableOpt: DataTableOptions) {
    const result: any = {};
    rows.forEach(row => result[row['@key']] = this.rowToObject(row, tableOpt));
    return result;
  }
    
  static rowToObject(row: any, tableOpt: DataTableOptions) {
    if (row['@value'])
      return this.valToObject(row['@value']);
    
    const result: any = {};
    for (const col of tableOpt.columns) {
      if (col.field === '@key' || col.field === '#' || !col.visible)
        continue;
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
