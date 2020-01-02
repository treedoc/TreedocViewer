<template>
  <div class="td-value">
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
import { TDNodeType } from 'jsonex-treedoc';
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
      const col = _.find(this.columns, { field: this.field });
      return col && col.html && col.html(this.value, this.row);
    },
    isSimpleType() { return this.value.type === TDNodeType.SIMPLE; },
  },
};
</script>
<style>
.td-value {
  overflow-x: auto;
  max-width: 1000px;
}

</style>>
