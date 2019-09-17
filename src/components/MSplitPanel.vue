<template>
  <div class="parent">
    params: {{params}}
    <resize-observer style="width:100%;  z-index: -1;" @notify="onWindowResize" />
    <div class="sp-container" @mousemove="resizing" @mouseup="stopResize">
      <template v-for="(p, i) in paneSet.panes">
        <div :key="'sp_' + i">
          <div class="sp-panel" :style="panelStyle(i)" >
            show:{{vnodes[i].data.attrs}}
            <slot :name="p.name" />
          </div>
          <div v-if="i<paneSet.panes.length-1" class="sp-handle" :style="handleStyle(i)" @mousedown.prevent="startResize(i, $event)"/>
        </div>
      </template>
    </div>
  </div>
</template>
<script>
// @ts-check
import 'vue-resize/dist/vue-resize.css';
import { ResizeObserver } from 'vue-resize';
import _ from 'lodash';
/* eslint-disable no-unused-vars */
import PaneSet, { Pane, PaneStatus } from './PaneSet';

const emit = (vnode, name, data) => {
  const handlers = vnode.data.on;

  if (handlers && handlers.hasOwnProperty(name)) {
    const handler = handlers[name];
    const fn = handler.fns || handler.fn;
    if (typeof fn === 'function') {
      fn(data);
    }
  }
};

export default {
  components: {
    ResizeObserver,
  },
  props: {
    params: Boolean,
  },
  data() {
    return {
      resizeIndex: -1,
      startPos: -1,
      startHandlePos: -1,
      paneSet: new PaneSet(),
      vnodes: [],
    };
  },
  methods: {
    /**
     * @param {String} name
     * @param {PaneStatus} status 0 - Normal, 1 - Minimized, 2 - Maximized
     */
    setPaneStatus(name, status) {
      this.paneSet.setPaneStatus(name, status);
    },
    startResize(i, e) {
      this.resizeIndex = i;
      // this.vnodes[i].context.$emit("update:test", 2)
      emit(this.vnodes[i], 'update:test', 2);
      this.startPos = e.clientX;
      this.startHandlePos = this.paneSet.getHandlePos(i);
      console.log(`startResize: resizingIndex=${this.resizeIndex}, startPos=${this.startPos}, startHandlePos=${this.startHandlePos}`);
    },
    resizing(e) {
      if (this.resizeIndex < 0)
        return;
      // _.debounce(() => {
      /* eslint-disable no-mixed-operators */
      console.log(`Moving: clientX=${e.clientX}`);
      this.paneSet.moveHandle(this.resizeIndex, this.startHandlePos + e.clientX - this.startPos);
      // }, 100)();
      this.$forceUpdate();
    },
    stopResize() {
      this.resizeIndex = -1;
    },
    onWindowResize() {
      console.log(`resized:width=${this.$el.clientWidth}`);
      this.$emit('resize');
      // TODO: fix debounce, this is not the righ way
      _.debounce(() => {
        this.paneSet.totalSize = this.$el.clientWidth;
        this.paneSet.calculateSize();
        console.log(`paneSet:${this.paneSet}`);
      }, 1000)();
    },
  },
  computed: {
    panelStyle() {
      return i => ({ width: `${this.paneSet.panes[i].getDisplaySize()}px` });
    },

    handleStyle() {
      return i => ({
        width: '5px',
        height: '100%',
        top: '0',
        left: `${this.paneSet.getHandlePos(i)}px`,
        'border-left': '1px solid grey',
        cursor: 'col-resize',
      });
    },
  },
  mounted() {
    let i = 0;
    for (const skey in this.$slots) {  //eslint-disable-line
      const vnode = this.$slots[skey][0];
      const { attrs, slot } = vnode.data;
      console.log(`test:${attrs.test}`);
      attrs.test = 2;
      vnode.context.$emit('update:test', 2);
      this.vnodes[i++] = vnode;
      this.paneSet.addPane(new Pane(slot, parseInt(attrs.size), parseInt(attrs.min), parseInt(attrs.max), parseInt(attrs.grow))); //eslint-disable-line
    }
    this.paneSet.totalSize = this.$el.clientWidth;
    this.paneSet.calculateSize();
  },
};
</script>
<style scoped>
.parent {
  width:100%;
  border: 1px solid red;
  background-color: rgba(255, 0, 0, 0.315);
  height: 200px;
  display: block;
  z-index: -1;
  /* position: fixed; */
}
.sp-container {
  position: relative;
  /* box-sizing: border-box; */
  /* border-collapse: collapse; */
  /* width: 100%; */
  height: 100%;
  display: flex;
  border: 1px solid grey;
  float: left;
  overflow: hidden;
  z-index: 10;
}
.sp-panel {
  box-sizing: border-box;
  border-collapse: collapse;
  display: flex;
  overflow: auto;
  height: 100%;
}
.sp-handle {
  position: absolute;
}
</style>

