import BootstrapVue from 'bootstrap-vue';
import Datatable from 'vue2-datatable-component';
import 'bootstrap-vue/dist/bootstrap-vue.css';
import JsonTreeTable from './components/JsonTreeTable.vue';
import JsonTable from './components/JsonTable.vue';
import TreeState from './models/TreeState';
import Tree from './models/Tree';


export default {
  install(vue) {
    vue.use(BootstrapVue);
    vue.use(Datatable);
    vue.component('json-tree-table', JsonTreeTable);
    vue.component('json-table', JsonTable);
  },
};

export {
  TreeState,
  Tree,
};
