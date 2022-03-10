<template>
  <div class="td-value" :class="{'td-value-max-width' : !isLastCol}">
    <div v-if='!value'></div>
    <div v-else-if="html" v-html="html"/>
    <div v-else-if="!isSimpleType">
      <tree-view-item class='tree-view-item-root'
          @node-clicked='nodeClicked'
          :tnode='value'
          :expandState='xprops.expandState'
          :currentLevel='0'
          style="margin-left: 0!important;" />
    </div>
    <div v-else>
      <simple-value @node-clicked='nodeClicked' :tnode='value' :isInTable='true' />
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
      const html = this.col && col.html;
      if (typeof(html) === 'function')
        return html(this.value, this.row);
      else {  // string
        return ((value, row) => {
          /*eslint no-eval: "ignore"*/
          return eval(html);
        })(this.value, this.row);
      }
    },
    col() { return _.find(this.columns, { field: this.field }); },
    isLastCol() { return this.col === this.columns[this.columns.length - 1]; },
    isSimpleType() { return this.value.type === TDNodeType.SIMPLE; },
  },
  methods: {
    nodeClicked(data) {
      this.xprops.tstate.select(data);
    },
  },
  watch: {
    value: {
      immediate: true,
      handler(val) {
        // console.log(val && !this.html && !this.isSimpleType);
        if (val && !this.html && !this.isSimpleType) {
          // console.log('this.xprops.tstate.hasTreeInTable');
          this.xprops.tstate.hasTreeInTable = true;
        }
      },
    },
  },
};
</script>
<style>
.td-value {
  overflow-x: auto;
  
}
.td-value-max-width {
  max-width: 1500px;
}
</style>>
