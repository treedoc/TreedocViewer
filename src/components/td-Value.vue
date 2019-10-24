<template>
  <div>
    <div v-if="html" v-html="html"/>
    <div v-else-if="strVal === null">
      <tree-view-item class='tree-view-item-root' :data='value' :max-depth='0' :current-depth='0' style="margin-left: 0!important;" v-on:nodeClicked='nodeClicked'></tree-view-item>
    </div>
    <div v-else>
      {{strVal}}
    </div>
  </div>
</template>
<script lang='js'>
// For some reason, DataTable doesn't support typescript class based dynamic component or Vue.extend({}) component
import _ from 'lodash';
import TreeViewItem from './TreeViewItem.vue';
import { TreeNode } from '../models/Tree';

export default {
  components: {
    TreeViewItem,
  },
  props: ['field', 'value', 'row', 'xprops', 'columns'],
  methods: {
    nodeClicked(data) { this.xprops.tstate.select(data); },
  },
  computed: {
    strVal() {
      if (!this.value)
        return '';
      if (!this.value.isObject())
        return this.value.obj;
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
