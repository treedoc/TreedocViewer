<template>
  <div class='wrapper'>
    <expand-control ref='expandControl' :state='expandState' class="jtt-toolbar" style=" float: right;"/>
    <tree-view-item class='item-root'
        :tnode='tstate.tree.root'
        :currentLevel='0'
        :expandState='expandState'
        @nodeClicked='nodeClicked'
        ref='item' />
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import _ from 'lodash';
import TreeViewItem from './TreeViewItem.vue';
import ExpandControl, { ExpandState } from './ExpandControl.vue';
import TreeState from '../models/TreeState';
import { TDNode } from 'treedoc';

@Component({
  components: {
    TreeViewItem,
    ExpandControl,
  },
})
export default class TreeView extends Vue {
  @Prop() tstate!: TreeState;
  @Prop({default: 'root'}) rootObjectKey!: string;
  @Prop({default: '4'}) expandLevel!: number;
  expandState = new ExpandState(this.expandLevel);

  @Watch('tstate.selected')
  watchselected(v: TDNode | null, old: TDNode | null) {
    if (old != null)
      this.item.selectNode(old.path, 0, (node) => node.selected = false);
    if (v)
      this.item.selectNode(v.path, 0, (node) => node.selected = true);
  }

  get item() {
    return this.$refs.item as TreeViewItem;
  }

  // VUELMIT: For some reason, <keep-alive> will keep the legacy node in memory.
  // That will cause the shared expandState data get corrupted.
  // So we have to create a new instance whenever tree changes.
  @Watch('tstate')
  watchTree() {
    this.expandState = new ExpandState(this.expandState.expandLevel);
  }

  nodeClicked(data: string[]) {
    this.tstate.select(data);
  }
}
</script>

<style scoped>
.wrapper {
  overflow: auto;
  height: 100%;
}

.item-root {
  margin-left: 0!important;
}
</style>
