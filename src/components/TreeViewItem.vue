<template>
  <div class='item'>
    <div v-if='!data.isSimpleType()' class='leaf'>
      <div class='node' @click.stop='toggleOpen()' >
        <span :class='{opened: isOpen()}' class='key key-with-chevron'> <a href="#" @click.stop="$emit('nodeClicked', data)">{{data.key}}</a></span>
        <span class='hint'>{{data.typeSizeLabel}}</span>
      </div>
      <template v-for="(v, k) in data.children" >
        <keep-alive :key='k'>
            <tree-view-item :key='k' :max-depth='maxDepth' :current-depth='currentDepth+1' v-if='isOpen()' :data='v' @nodeClicked='nodeClicked' />
        </keep-alive>
      </template>
    </div>
    <div v-else>
      <span class='key'>{{data.key}}: </span>
      <span class='value' >{{ data.obj }}</span>
    </div>
  </div>
</template>

<script>
import { TreeNode } from '../models/Tree';

export default {
  name: 'tree-view-item',
  props: {
    data: TreeNode,
    maxDepth: Number,
    currentDepth: Number,
    modifiable: Boolean,
  },
  data() {
    return { open: this.currentDepth < this.maxDepth };
  },
  methods: {
    isOpen() { return this.open; },
    toggleOpen() { this.open = !this.open; },
    nodeClicked(data) { this.$emit('nodeClicked', data); },
  },
};
</script>

<style scoped>

.item {
  font-family: monaco, monospace;
  font-size: 14px;
  margin-left: 18px;
}

.node {
  cursor: pointer;
  position: relative;
  white-space: nowrap;
}

.leaf {
  white-space: nowrap;
}

.key {
  font-weight: bold;
}

.key-with-chevron {
  padding-left: 14px;
}

.key-with-chevron.opened::before {
    top:4px;
    transform: rotate(90deg);
    -webkit-transform: rotate(90deg);
}

.key-with-chevron::before {
    color: #444;
    content: '\25b6';
    font-size: 10px;
    left: 1px;
    position: absolute;
    top: 3px;
    transition: -webkit-transform .1s ease;
    transition: transform .1s ease;
    transition: transform .1s ease, -webkit-transform .1s ease;
    -webkit-transition: -webkit-transform .1s ease;
}

.hint {
  color: #ccc
}
</style>
