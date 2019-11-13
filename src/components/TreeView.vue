<template>
  <div class='wrapper'>
    <expand-control ref='expandControl' :state='expandState' class="jtt-toolbar" style=" float: right;"/>
    <tree-view-item class='item-root' :key='index'
        :data='tree.root'
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
import Tree, { TreeNode } from '../models/Tree';
import ExpandControl, { ExpandState } from './ExpandControl.vue';

@Component({
  components: {
    TreeViewItem,
    ExpandControl,
  },
})
export default class TreeView extends Vue {
  @Prop() data!: string | object;
  @Prop() jsonTree!: Tree;
  @Prop({required: false}) selected?: TreeNode;

  @Prop({default: 'root'})
  rootObjectKey!: string;

  @Prop({default: '4'})
  expandLevel!: number;

  expandState = new ExpandState(this.expandLevel);

  nodeClicked(data: TreeNode) {
    this.$emit('nodeClicked', data);
  }

  get tree() {
    return this.jsonTree != null ? this.jsonTree : new Tree(this.data, this.rootObjectKey);
  }

  @Watch('selected')
  watchselected(v: TreeNode | null, old: TreeNode | null) {
    // if (old != null)
    //   this.item.selectNode(old.getPath(), 0, (node) => node.selected = false);
    // if (v)
    //   this.item.selectNode(v.getPath(), 0, (node) => node.selected = true);
  }

  get item() {
    return this.$refs.item as TreeViewItem;
  }

  // For some reason, <keep-alive> will keep the legacy node in memory.
  // That will cause the shared expandState data get corrupted.
  // So we have to create a new instance whenever tree changes.
  @Watch('tree')
  watchTree() {
    this.expandState = new ExpandState(this.expandLevel);
  }
}
</script>

<style scoped>
.wrapper {
  overflow: auto;
}

.item-root {
  margin-left: 0!important;
}
</style>
