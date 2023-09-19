import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
import 'font-awesome/css/font-awesome.css';

import Vue from 'vue';
import BootstrapVue from 'bootstrap-vue';
import Datatable from 'vue2-datatable-component';
import msplit from 'msplit';
import { codemirror } from 'vue-codemirror-lite';


import JsonTreeTable from './components/JsonTreeTable.vue';
import JsonTable from './components/JsonTable.vue';

import TreeState from './models/TreeState';
import TreeViewItem from './components/TreeViewItem.vue';
import JSONParserPlugin, {JSONParserType, JSONParserOption} from './parsers/JSONParserPlugin';
import YAMLParserPlugin from './parsers/YAMLParserPlugin';
import XMLParserPlugin from './parsers/XMLParserPlugin';
import CSVParserPlugin from './parsers/CSVParserPlugin';
import TDVOption from './models/TDVOption';
import Util from './util/Util';


export default {
  install(vue: typeof Vue) {
    vue.use(BootstrapVue);
    vue.use(Datatable);
    Vue.use(msplit);
    Vue.component('codemirror', codemirror);
    vue.component('json-tree-table', JsonTreeTable);
    vue.component('json-table', JsonTable);
    Vue.component('tree-view-item', TreeViewItem);
    Vue.filter('textLimit', Util.textLimit);
    Vue.filter('toFixed', Util.toFixed);
  },
};

export {
  JsonTreeTable,
  TreeState,
  JSONParserPlugin,
  JSONParserOption,
  JSONParserType,
  YAMLParserPlugin,
  XMLParserPlugin,
  CSVParserPlugin,
  TDVOption,
};
