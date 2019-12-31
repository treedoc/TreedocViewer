<template>
  <div>
    <div v-if="html" v-html="html"/>
    <div v-else-if="strVal === null">
      <tree-view-item class='tree-view-item-root'
          :tstate='xprops.tstate'
          :tnode='value'
          :expandState='xprops.expandState'
          :currentLevel='0'
          style="margin-left: 0!important;" />
    </div>
    <div v-else>
      <pre>{{strVal}}</pre>
    </div>
  </div>
</template>
<script lang='js'>
// For some reason, DataTable doesn't support typescript class based dynamic component or Vue.extend({}) component
import _ from 'lodash';
import TreeViewItem from './TreeViewItem.vue';
import { TDNodeType } from 'jsonex-treedoc';

export default {
  components: {
    TreeViewItem,
  },
  props: ['field', 'value', 'row', 'xprops', 'columns'],
  computed: {
    strVal() {
      if (!this.value)
        return '';
      if (this.value.type === TDNodeType.SIMPLE)
        return this.value.value;
      return null;
    },
    html() {
      const col = _.find(this.columns, { field: this.field });
      return col && col.html && col.html(this.value, this.row);
    },
  },
};
</script>
<style>

</style>
