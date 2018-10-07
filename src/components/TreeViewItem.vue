<template>
  <div class='tree-view-item'>
    <div v-if='!data.isLeaf()' class='tree-view-item-leaf'>
      <div class='tree-view-item-node' @click.stop='toggleOpen()' >
        <span :class='{opened: isOpen()}' class='tree-view-item-key tree-view-item-key-with-chevron'> <a @click.stop="$emit('nodeClicked', data)">{{data.label}} </a></span>
        <span class='tree-view-item-hint' v-show='!isOpen()'>{{data.size}} item(s)</span>
      </div>
      <template v-for="(v, k) in data.children" >
        <keep-alive :key='k'>
            <tree-view-item :key='k' :max-depth='maxDepth' :current-depth='currentDepth+1' v-if='isOpen()' :data='v' @nodeClicked='nodeClicked' />
        </keep-alive>
      </template>
    </div>
    <div v-else>
      <span class='tree-view-item-key'>{{data.key}}: </span>
      <span class='tree-view-item-value' >{{ data.obj }}</span>
    </div>
  </div>
</template>

<script>
import _ from 'lodash';

export default {
  name: 'tree-view-item',
  props: ['data', 'max-depth', 'current-depth', 'modifiable'],
  data() {
    return { open: this.currentDepth < this.maxDepth };
  },
  methods: {
    isOpen() { return this.open; },
    toggleOpen() { this.open = !this.open; },
    isObject(value) { return value.type === 'object'; },
    isArray(value) { return value.type === 'array'; },
    isValue(value) { return value.type === 'value'; },
    getKey(value) { return _.isInteger(value.key) ? `${value.key}:` : `'${value.key}':`; },
    isRootObject(value = this.data) { return value.isRoot; },
    nodeClicked(data) { this.$emit('nodeClicked', data); },
  },
};
</script>

<style scoped>

.tree-view-item {
  font-family: monaco, monospace;
  font-size: 14px;
  margin-left: 18px;
}

.tree-view-item-node {
  cursor: pointer;
  position: relative;
  white-space: nowrap;
}

.tree-view-item-leaf {
  white-space: nowrap;
}

.tree-view-item-key {
  font-weight: bold;
}

.tree-view-item-key-with-chevron {
  padding-left: 14px;
}


.tree-view-item-key-with-chevron.opened::before {
    top:4px;
    transform: rotate(90deg);
    -webkit-transform: rotate(90deg);
}

.tree-view-item-key-with-chevron::before {
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

.tree-view-item-hint {
  color: #ccc
}
</style>
