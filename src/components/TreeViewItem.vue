<template>
  <div class='item'>
    <div v-if='!data.isSimpleType()' class='leaf'>
      <div class='node' @click.stop='toggleOpen()' >
        <span :class='{opened: open, selected: selected}' class='key key-with-chevron'>
          <a href="#/" @click.stop="$emit('nodeClicked', data)">
            {{data.key}}
          </a>
        </span>
        <span class='hint'>{{data.typeSizeLabel}}</span>
      </div>
      <template v-for="(v, k) in data.children" >
        <keep-alive :key='k'>
          <TreeViewItem :key='k' 
              v-if='open'
              ref='children'
              :currentLevel='currentLevel+1'
              :expandState='expandState'
              :data='v'
              @nodeClicked='nodeClicked' />
        </keep-alive>
      </template>
    </div>
    <div v-else>
      <span class='key'>{{data.key}}</span>:
      <span class='value'>{{data.obj}}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { TreeNode } from '../models/Tree';
import { ExpandState } from './ExpandControl.vue';

@Component
export default class TreeViewItem extends Vue {
  @Prop() data!: TreeNode;
  @Prop() currentLevel!: number;
  @Prop() modifiable!: boolean;
  @Prop({default: () => new ExpandState()}) expandState!: ExpandState;
  open = false;
  selected = false;

  toggleOpen() { this.open = !this.open; }
  nodeClicked(data: TreeNode) { this.$emit('nodeClicked', data); }

  @Watch('selected')
  private watchSelected(v: boolean) {
    if (v)
      this.$el.scrollIntoView();
  }

  selectNode(path: string[], start: number, action: (node: TreeViewItem) => void) {
    if (start === path.length)
      action(this);

    this.open = true;
    this.$nextTick(() => {
      for (const item of this.$refs.children as TreeViewItem[]) {
        if (item.data.key === path[start])
          item.selectNode(path, start + 1, action);
      }
    });
  }

  // // deep watch will cause stack overflow due to cyclic reference if expandState contains TreeNode
  // // cause error: vue.runtime.esm.js:620 [Vue warn]: Error in nextTick: "RangeError: Maximum call stack size exceeded"
  @Watch('expandState', { immediate: true, deep: true})
  private watchExpandState() {
    // console.log(`watchExpandState: key=${this.data.key}`);
    if (this.data.isLeaf())
      return;

    const state = this.expandState;
    this.open = state.fullyExpand || this.currentLevel < state.expandLevel;

    if (state.fullyExpand) {
      if (this.currentLevel + 1 > state.expandLevel)
        state.expandLevel = this.currentLevel + 1;
    } else if (!state.moreLevel) {
      // Have to check two levels, otherwise, as "v-if" and "keep-alive" cause the watchExpendLevel won't be triggered
      if (/*this.currentLevel > state.expandLevel - 2 && this.data.hasGrandChildren() ||*/
          this.currentLevel > state.expandLevel - 1)
        state.moreLevel = true;
    }
    // console.log(`expandLevelChange: key=${this.data.key}, currentLevel=${this.currentLevel},
    //     state=${JSON.stringify(state)}, hasGrandChildren=${this.data.hasGrandChildren()}`);
  }
}
</script>
<style scoped>
.item {
  /* font-family: monaco, monospace; */
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

.selected {
  background-color:#ffc107;
}

.hint {
  color: #ccc;
}
</style>
