<template>
  <div class="sp-container" @mousemove="resizing" @mouseup="stopResize" >
    <template v-for="(p, i) in splitPositions">
      <div :key="i">
        <div class="sp-panel" :style="panelStyle(i)">
          <slot :name="i" />
        </div>
        <div class="sp-handle" :style="handleStyle(i)" @mousedown.prevent="startResize(i, $event)"/>
      </div>
    </template>
    <div class="sp-panel" :style="panelStyle(splitPositions.length)">
      <slot :name="splitPositions.length" />
    </div>
  </div>
</template>
<script>

// @ts-check
class Pane {
  /**
   * @param {String} name
   * @param {Number} [size=0]  Assume the initial size should always between min and max
   * @param {Number} [min=10]
   * @param {Number} [max=Number.MAX_VALUE]
   * @param {Number} [grow=1] The propotion to fill the remain spaces
   */
  constructor(name, size, min, max, grow) {
    this.name = name;
    this.size = size;
    this.curSize = size;
    this.min = min | 10;
    this.max = max | Number.MAX_VALUE;
    this.grow = grow | 1;
    this.splitPos = size;
  }
}

class PaneSet {
  /** @param {Number} totalSize */
  constructor(totalSize) {
    this.totalSize = totalSize;
    /** @type {Pane[]} */
    this.panes = [];
  }

  /** @param {Pane} pane */
  addPane(pane) {
    this.panes.push(pane);
  }

  calculateSize() {
    /** @type {Set.<Pane>} */
    const remainPanes = new Set();
    const remain = {
      size: this.totalSize,
      grow: 0,
    };
    for (const p of this.panes) {
      if (p.size)
        remain.Size -= p.size
      else {
        remainPanes.add(p);
        remain.grow += p.grow;
      }
    }

    while(remainPanes.size > 0) {
      const outFitPanel = this.findOutFit(remainPanes, remain)
      if (!outFitPanel)
        break;
      remain.size -= outFitPanel.size;
      remain.grow -= outFitPanel.grow;
    }

    const perSize = remain.size / remain.grow;
    for (const p of remainPanes)
      p.size = perSize * p.grow;
  }

  /**
   * @param {Set<Pane>} panes
   * @param {Object} remain
   * @returns {Pane} return null, if no more outfit panels
   */
  findOutFit(panes, remain) {
    const perSize = remain.size / remain.grow;
    for (const p of panes) {
      const size = perSize * p.grow;
      if (size < p.min) {
        p.size = p.min;
        return p;
      }
      if (size > p.max) {
        p.size = p.max;
        return p;
      }
    }
    return null;
  }

  calculateSplitPos() {
    for (const p in this.panes) 
      ;
  }

  static expend(panes, oldSize, newSize) {
    
  }

  static shrink(panes, oldSize, newSize) {

  }
};

export default {
  props: {
    initPositions: Array,
  },
  data() {
    return {
      resizeIndex: -1,
      startPos: -1,
      panes: [],
      splitPositions: [],
      handlePositions: [],
      minSize: null,
    };
  },
  methods: {
    startResize(i, e) {
      console.log('startResize');
      this.resizeIndex = i;
      this.startPos = e.clientX;
    },
    resizing(e) {
      if (this.resizeIndex < 0)
        return;
      /* eslint-disable no-mixed-operators */
      const newPos = this.splitPositions[this.resizeIndex] + e.clientX - this.startPos;

      const min = this.resizeIndex === 0 ? 0 : this.splitPositions[this.resizeIndex - 1];
      const max = this.resizeIndex === this.splitPositions.length - 1 ? this.$el.clientWidth : this.splitPositions[this.resizeIndex + 1];
      console.log(`resizing: e.clientX = ${e.clientX}; min=${min}; max=${max}; newPos=${newPos}`);

      if (newPos < min + 5 || newPos > max - 5)
        return;

      this.handlePositions[this.resizeIndex] = newPos;
      this.$forceUpdate();
    },
    stopResize() {
      console.log('stopResize');
      if (this.resizeIndex < 0)
        return;
      this.splitPositions[this.resizeIndex] = this.handlePositions[this.resizeIndex];
      this.resizeIndex = -1;
      this.$forceUpdate();
    },
  },
  computed: {
    panelCount() { return this.initPositions.length + 1; },
    panelStyle() {
      return (i) => {
        const style = {};
        if (i === this.panelCount)
          style.width = '100%';
        else if (i === 0)
          style.width = `${this.splitPositions[0]}px`;
        else
          style.width = `${this.splitPositions[i] - this.splitPositions[i - 1]}px`;
        return style;
      };
    },
    handleStyle() {
      return (i) => {
        const pos =  this.handlePositions[i];
        return {
          width: '5px',
          height: '100%',
          top: '0',
          left: `${pos}px`,
          'border-left': '1px solid grey',
          cursor: 'col-resize',
        };
      };
    },
  },
  created() {
    console.log(this.$slots);

    for (const skey in this.$slots) {
      const vnode = this.$slot[skey][0];
      const {attr} = vnode;
      this.panes.push(new Pane(vnode.slot, attr.size, attr.min, attr.max, attr.grow));
    }

    Pane.calculateSize(this.panes, this.$el.clientWidth);    

    this.splitPositions = this.initPositions;
    this.handlePositions = [...this.splitPositions];
  },
};
</script>
<style scoped>
.sp-container {
  position: relative;
  box-sizing: border-box;
  border-collapse: collapse;
  width: 100%;
  height: 100%;
  display: flex;
  border: 1px solid grey;
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

