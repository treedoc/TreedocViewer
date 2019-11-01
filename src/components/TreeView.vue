<template>
  <div class='wrapper'>
    <expand-control :state='expandState' />
    <tree-view-item class='item-root' 
        :data='tree.root' 
        :currentLevel='0'
        :expandState='expandState'
        @nodeClicked='nodeClicked' />
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
