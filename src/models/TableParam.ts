import { TableConfig, DataTableOptions } from '@/components/Vue2DataTable';

/**
 * TableParam is a JSON object that passed through URL or event to provide all the information to construct
 * an JsonTable component
 */
export default interface TableParam {
  title?: string;
  jsonData: any | string;
  initialPath?: string;
  options?: TableConfig;
}
