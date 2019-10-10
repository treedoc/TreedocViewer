import Vue from 'vue';
import Datatable from 'vue2-datatable-component';

import BootstrapVue from 'bootstrap-vue';
import msplit from 'msplit';
import 'msplit/dist/lib/lib.css';
import App from './App.vue';
import TreeViewItem from './components/TreeViewItem.vue';

Vue.config.productionTip = false;
Vue.use(Datatable);
Vue.use(BootstrapVue);
Vue.use(msplit);
Vue.component('tree-view-item', TreeViewItem);

Vue.config.performance = true;

new Vue({
  render: h => h(App),
}).$mount('#app');
