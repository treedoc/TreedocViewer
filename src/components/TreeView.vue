<template>
  <div class='wrapper'>
    <tree-view-item class='item-root' :data='tree.root' :max-depth='allOptions.maxDepth' :current-depth='0' @nodeClicked='nodeClicked'></tree-view-item>
  </div>
</template>

<script>
import _ from 'lodash';
import TreeViewItem from './TreeViewItem.vue';
import Tree from '../models/Tree';

export default {
  components: {
    TreeViewItem,
  },
  name: 'tree-view',
  props: {
    data: [String, Object],
    jsonTree: Tree,
    options: Object,
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
.wrapper {
  overflow: auto;
}

.item-root {
  margin-left: 0!important;
}
</style>
