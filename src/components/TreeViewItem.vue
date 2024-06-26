<template>
  <div class='item'>
    <div v-if='!isSimpleType' class='leaf'>
      <div class='node' @click.stop='toggleOpen()'>
        <span :class='{opened: open, selected: selected}' class='key key-with-chevron'>
          <!-- VUETIP: in the event, don't emit object, serialization will take long time if object is big -->
          <a href="#" tabindex="0" @keydown="onKeyDown" @click.stop="$emit('node-clicked', ['', ...tnode.path])" @mouseenter="mouseEnter" @mouseleave="mouseLeave">
          <!-- <a href="#/" @click.stop="tstate.select(tnode)"> -->
            {{tnode.key}}
          </a>
        </span>
        <span class='tdv-hint'>{{label}}</span>
      </div>
      <template v-for="cn in tnode.children ? tnode.children.slice(0, limit) : []" >
        <keep-alive :key='cn.key'>
          <!-- 
            VUEBUG: If use TreeViewItem which will cause brokage only in prod mode, this inconsistency cause me
            many days to troubleshoot.
          -->
          <tree-view-item :key='cn.key' 
              v-if='open'
              :ref="'children'"
              :currentLevel='currentLevel+1'
              :expandState='expandState'
              :tnode='cn'
              @node-clicked='bubbleEvent($event, "node-clicked")' />
        </keep-alive>
      </template>
      <a class='item' href="#" style="font-size: smaller; color: green;" v-if="open && (tnode.getChildrenSize() > limit)" @click="limit = limit + pageSize">... Load next {{ pageSize }} items</a>
    </div>
    <div v-else>
      <span class='key'>{{tnode.key}}</span>:
      <simple-value :tnode='tnode' @node-clicked='bubbleEvent($event, "node-clicked")' />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { TDNode, TDNodeType } from 'treedoc';
import { ExpandState } from './ExpandControl.vue';
import SimpleValue from './SimpleValue.vue';
import TreeUtil from '../models/TreeUtil';
import Util from '../util/Util';

const PAGE_SIZE = 2000;
export class NodeMouseEnterEvent {
  constructor(
    public nodePath: string,
    public source: Element,
  ) {}
}

// @Component({
//   components: {
//     // VUEBUG: if don't specify components explicitly here, the $refs.children will be DOM objects
//     // instead of Vue component when compiled in production mode. Dev mode has no problem.
//     // This only happens is I use <TreeViewItem> instead of <tree-view-item>
//     TreeViewItem,
//   },
// })
@Component({
  components: {
    SimpleValue,
  },
})
export default class TreeViewItem extends Vue {
  // @Prop() tstate!: TreeState;
  @Prop() tnode!: TDNode;
  @Prop() currentLevel!: number;
  @Prop() modifiable!: boolean;
  @Prop({default: () => new ExpandState()}) expandState!: ExpandState;
  open = false;
  selected = false;
  mouseOver = false;
  pageSize = PAGE_SIZE;
  limit = PAGE_SIZE;

  toggleOpen() { this.open = !this.open; }
  // VUELIMIT: Vue $emit won't buble up the event to grand parent, so we have explicitly
  // propagate it.
  // nodeClicked(tnode: TreeNode) { this.$emit('node-clicked', tnode); }

  get isSimpleType() { return this.tnode.type === TDNodeType.SIMPLE; }
  get label() { return TreeUtil.getTypeSizeLabel(this.tnode, !this.open && this.expandState.showChildrenSummary); }

  @Watch('selected')
  watchSelected(v: boolean) {
    if (v)
      this.$el.scrollIntoView({block: 'nearest'});
  }

  selectNode(path: string[], start: number, action: (node: TreeViewItem) => void) {
    if (start === path.length) {
      action(this);
      return;
    }

    this.open = true;
    this.$nextTick(() => {
      for (const item of this.$refs.children as TreeViewItem[]) {
        // VUEBUG: in production mode, item.tnode is not avaible. instead the tnode will be stored in item.$attrs.tnode
        // const node = item.tnode ? item.tnode : (item.$attrs.tnode as unknown as TreeNode);
        // This only happen if I use <TreeViewItem> instead of <tree-view-item>
        if (item.tnode.key === path[start])
          item.selectNode(path, start + 1, action);
      }
    });
  }

  // VUEBUG: deep watch will cause stack overflow due to cyclic reference if expandState contains TreeNode
  // cause error: vue.runtime.esm.js:620 [Vue warn]: Error in nextTick: "RangeError: Maximum call stack size exceeded"
  @Watch('expandState', { immediate: true, deep: true})
  private watchExpandState() {
    // console.log(`watchExpandState: key=${this.tnode.key}`);
    if (this.tnode.isLeaf())
      return;

    const state = this.expandState;
    this.open = state.fullyExpand || this.currentLevel < state.expandLevel;

    if (state.fullyExpand) {
      if (this.currentLevel + 1 > state.expandLevel)
        state.expandLevel = this.currentLevel + 1;
    } else if (!state.moreLevel) {
      // VUEBUG: Have to check two levels, otherwise, as "v-if" and "keep-alive" cause the watchExpendLevel won't be triggered
      if (/*this.currentLevel > state.expandLevel - 2 && this.tnode.hasGrandChildren() ||*/
          this.currentLevel > state.expandLevel - 1)
        state.moreLevel = true;
    }
    // console.log(`expandLevelChange: key=${this.tnode.key}, currentLevel=${this.currentLevel},
    //     state=${JSON.stringify(state)}, hasGrandChildren=${this.tnode.hasGrandChildren()}`);
  }

  // Seems there's no way to get event name by default, so we have to pass it as parameter
  bubbleEvent(data: any, evtName: string) {
    this.$emit(evtName, data);
  }

  mouseEnter(e: MouseEvent) {
    this.mouseOver = true;
    // setTimeout(() => this.$emit('node-mouse-enter', new MouseEnterEvent(this.tnode.pathAsString,  this.$refs.key as Element)), 500);
    setTimeout(() => Util.doIf(this.mouseOver, () => this.$el.dispatchEvent(
      new CustomEvent('node-mouse-enter', { 
        detail: new NodeMouseEnterEvent(this.tnode.pathAsString,  e.target as Element),
        bubbles: true,
        composed: true }))), 500);
  }

  mouseLeave(e: MouseEvent) {
    this.mouseOver = false;
    setTimeout(() => this.$el.dispatchEvent(
      new CustomEvent('node-mouse-leave', { 
        detail: new NodeMouseEnterEvent(this.tnode.pathAsString,  e.target as Element),
        bubbles: true,
        composed: true })), 500);
  }

  onKeyDown(e: KeyboardEvent) {
    console.log(`onKeyPress: key=${e.key}`);
    switch (e.key) {
      case 'ArrowRight': this.toggleOpen(); e.preventDefault(); break;
      case 'ArrowDown': this.toggleOpen(); e.preventDefault(); break;
    }
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
  /* font-weight: bold; */
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
</style>
