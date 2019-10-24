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
<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import _ from 'lodash';
import TreeViewItem from './TreeViewItem.vue';
import { TreeNode } from '../models/Tree';
import { Column } from './Vue2DataTable';

@Component({
  components: { TreeViewItem },
})
export default class TdValue extends Vue {
  @Prop() field!: string;
  @Prop() value!: any;
  @Prop() row!: object;
  @Prop() xprops!: any;
  @Prop() columns!: Column;

  nodeClicked(data: TreeNode) { this.xprops.tstate.select(data); }

  get strVal() {
    if (!this.value)
      return '';
    if (!this.value.isObject())
      return this.value.obj;
    return null;
  }

  get html() {
    const col = _.find(this.columns, { field: this.field });
    return col && col.html && col.html(this.value, this.row);
  }
}
</script>
<style>
</style>
