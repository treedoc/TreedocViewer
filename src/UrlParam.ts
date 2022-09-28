import { TD, TDJSONParser } from 'treedoc';
import { TableConfig } from './components/Vue2DataTable';
import TableParam from './models/TableParam';

export default class UrlParam {
  data: string | null;
  dataUrl: string | null;
  embeddedId: string | null;
  title: string;
  initialPath?: string | null;
  tableConfig?: TableConfig;

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
  }
}
