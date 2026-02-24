import { TD, TDJSONParser } from 'treedoc';
import { TableConfig } from './components/Vue2DataTable';
import { TDVOption } from './lib';
import TableParam from './models/TableParam';

export default class UrlParam {
  data: string | null;
  dataUrl: string | null;
  embeddedId: string | null;
  title: string;
  initialPath?: string | null;
  tableConfig?: TableConfig;
  option?: TDVOption;

  constructor() {
    const url = new URL(window.location.href);
    this.dataUrl = url.searchParams.get('dataUrl');
    this.data = url.searchParams.get('data');
    this.embeddedId = url.searchParams.get('embeddedId');
    this.initialPath = url.searchParams.get('initialPath');
    this.title = url.searchParams.get('title') || 'Treedoc Viewer';

    const tableConfigStr = url.searchParams.get('tableConfig');
    if (tableConfigStr)
      this.tableConfig = TD.parse(tableConfigStr);

    const optStr = url.searchParams.get('option');
    if (optStr)
      this.option = TD.parse(optStr);
  
  }
}
