import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
import 'font-awesome/css/font-awesome.css';

import Vue from 'vue';
import BootstrapVue from 'bootstrap-vue';
import Datatable from 'vue2-datatable-component';
import msplit from 'msplit';

import JsonTreeTable from './components/JsonTreeTable.vue';
import JsonTable from './components/JsonTable.vue';
import TreeState from './models/TreeState';
import Tree from './models/Tree';

export default {
  install(vue: typeof Vue) {
    vue.use(BootstrapVue);
    vue.use(Datatable);
    Vue.use(msplit);
    vue.component('json-tree-table', JsonTreeTable);
    vue.component('json-table', JsonTable);
  },
};

export {
  TreeState,
  Tree,
};
