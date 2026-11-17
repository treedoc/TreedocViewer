// TreeDoc Viewer v2 - Library exports
import type { App } from 'vue'

// Components
import JsonTreeTable from './components/JsonTreeTable.vue'
import TreeView from './components/TreeView.vue'
import TableView from './components/TableView.vue'
import SourceView from './components/SourceView.vue'
import SimpleValue from './components/SimpleValue.vue'
import ExpandControl from './components/ExpandControl.vue'
import JsonPath from './components/JsonPath.vue'

// Store
import { useTreeStore } from './stores/treeStore'

// Types
import type { 
  ParserPlugin, 
  ParseResult, 
  TDVOptions,
  Selection,
  TableNodeState,
  ChartState,
  Column,
  Query,
  FieldQuery
} from './models/types'
import { ParseStatus, createDefaultQuery, createDefaultFieldQuery } from './models/types'

// Parsers
import JSONParserPlugin, { JSONParserType } from './parsers/JSONParserPlugin'
import YAMLParserPlugin from './parsers/YAMLParserPlugin'
import XMLParserPlugin from './parsers/XMLParserPlugin'
import CSVParserPlugin from './parsers/CSVParserPlugin'

// Plugin installation
function install(app: App) {
  app.component('JsonTreeTable', JsonTreeTable)
  app.component('TreeView', TreeView)
  app.component('TableView', TableView)
  app.component('SourceView', SourceView)
}

export default {
  install,
}

export {
  // Components
  JsonTreeTable,
  TreeView,
  TableView,
  SourceView,
  SimpleValue,
  ExpandControl,
  JsonPath,
  
  // Store
  useTreeStore,
  
  // Types
  ParseStatus,
  createDefaultQuery,
  createDefaultFieldQuery,
  
  // Parsers
  JSONParserPlugin,
  JSONParserType,
  YAMLParserPlugin,
  XMLParserPlugin,
  CSVParserPlugin,
}

export type {
  ParserPlugin,
  ParseResult,
  TDVOptions,
  Selection,
  TableNodeState,
  ChartState,
  Column,
  Query,
  FieldQuery,
}
