<template>
  <div class='tree-view-wrapper'>
    <tree-view-item class='tree-view-item-root' :data='tree.root' :max-depth='allOptions.maxDepth' :current-depth='0' @nodeClicked='nodeClicked'></tree-view-item>
  </div>
</template>

<script>
import _ from 'lodash';
import TreeViewItem from './TreeViewItem.vue';
import { Tree } from './Tree';

export default {
  components: {
    TreeViewItem,
  },
  name: 'tree-view',
  props: {
    data: Object,
    jsonTree: Tree,
    optionss: Object,
  },
  methods: {
    nodeClicked(data) { this.$emit('nodeClicked', data); },
  },
  computed: {
    allOptions() {
      return _.extend({}, {
        rootObjectKey: 'root',
        maxDepth: 4,
        modifiable: false,
      }, (this.options || {}));
    },
    tree() {
      return this.jsonTree != null ? this.jsonTree : new Tree(this.data, this.allOptions.rootObjectKey);
    },
  },
};
</script>

<style scoped>
.tree-view-wrapper {
  overflow: auto;
}

/* Find the first nested node and override the indentation */
.tree-view-item-root > .tree-view-item-leaf > .tree-view-item {
  margin-left: 0!important;
}

/* Root node should not be indented */
.tree-view-item-root {
  margin-left: 0!important;
}
</style>
