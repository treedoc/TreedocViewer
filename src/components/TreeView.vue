<template>
  <div class='wrapper'>
    <tree-view-item class='item-root' :data='tree.root' :max-depth='allOptions.maxDepth' :current-depth='0' @nodeClicked='nodeClicked'></tree-view-item>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import _ from 'lodash';
import TreeViewItem from './TreeViewItem.vue';
import Tree, { TreeNode } from '../models/Tree';

@Component({
  components: { TreeViewItem },
})
export default class JsonPath extends Vue {
  @Prop() data!: string | object;
  @Prop() jsonTree!: Tree;
  @Prop() options!: object;

  nodeClicked(data: TreeNode) { this.$emit('nodeClicked', data); }

  get allOptions() {
    return _.extend({}, {
      rootObjectKey: 'root',
      maxDepth: 4,
      modifiable: false,
    }, (this.options || {}));
  }

  get tree() {
    return this.jsonTree != null ? this.jsonTree : new Tree(this.data, this.allOptions.rootObjectKey);
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
