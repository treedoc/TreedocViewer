<template>
  <div class="td-value" :class="{'td-value-max-width' : !isLastCol}">
    <div v-if='!value'></div>
    <div v-else-if="html" v-html="html"/>
    <div v-else-if="!isSimpleType">
      <tree-view-item class='tree-view-item-root'
          :tstate='xprops.tstate'
          :tnode='value'
          :expandState='xprops.expandState'
          :currentLevel='0'
          style="margin-left: 0!important;" />
    </div>
    <div v-else>
      <simple-value :tstate='xprops.tstate' :tnode='value' :isInTable='true' />
    </div>
  </div>
</template>
<script lang='js'>
// For some reason, DataTable doesn't support typescript class based dynamic component or Vue.extend({}) component
import _ from 'lodash';
import { TDNodeType } from 'treedoc';
import TreeViewItem from './TreeViewItem.vue';
import TreeUtil from '../models/TreeUtil.ts';
import SimpleValue from './SimpleValue.vue';

export default {
  components: {
    TreeViewItem,
    SimpleValue,
  },
  props: ['field', 'value', 'row', 'xprops', 'columns'],
  computed: {
    html() {
      const col = this.col;
      return col && col.html && col.html(this.value, this.row);
    },
    col() { return _.find(this.columns, { field: this.field }); },
    isLastCol() { return this.col === this.columns[this.columns.length - 1]; },
    isSimpleType() { return this.value.type === TDNodeType.SIMPLE; },
  },
};
</script>
<style>
.td-value {
  overflow-x: auto;
  
}
.td-value-max-width {
  max-width: 1000px;
}

</style>>
