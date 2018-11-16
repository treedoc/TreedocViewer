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
export default {
  props: {
    initPositions: Array,
  },
  data() {
    return {
      resizeIndex: -1,
      startPos: -1,
      splitPositions: [],
      handlePositions: [],
    }
  },
  methods: {
    startResize(i, e) {
      console.log(`startResize`);
      this.resizeIndex = i;
      this.startPos = e.clientX;
    },
    resizing(e) {
      if (this.resizeIndex < 0)
        return;
      
      const newPos = this.splitPositions[this.resizeIndex] + e.clientX - this.startPos;

      const min = this.resizeIndex === 0 ? 0 : this.splitPositions[this.resizeIndex - 1];
      const max = this.resizeIndex === this.splitPositions.length - 1 ? this.$el.clientWidth : this.splitPositions[this.resizeIndex + 1];
      console.log(`resizing: e.clientX = ${e.clientX}; min=${min}; max=${max}; newPos=${newPos}`)

      if (newPos < min + 5 || newPos > max - 5)
        return;

      this.handlePositions[this.resizeIndex] = newPos;
      this.$forceUpdate();
    },
    stopResize () {
      console.log(`stopResize`);
      if (this.resizeIndex < 0)
        return;
      this.splitPositions[this.resizeIndex] = this.handlePositions[this.resizeIndex];
      this.resizeIndex = -1;
      this.$forceUpdate();
    }
  },
  computed: {
    panelCount() { return this.initPositions.length + 1; },
    panelStyle() {
      return i => {
        const style = {};
        if (i == this.panelCount)
          style.width = '100%';
        else if (i == 0)
          style.width = `${this.splitPositions[0]}px`;
        else
          style.width = `${this.splitPositions[i] - this.splitPositions[i-1]}px`;
        return style;
      }
    },
    handleStyle() {
      return i => {
        const pos =  this.handlePositions[i];
        return {
          width: '5px',
          height: '100%',
          top: '0',
          left: pos + 'px',
          'border-left': '1px solid grey',
          cursor: 'col-resize'
        };
        
      }
    },
  },
  created() {
    this.splitPositions = this.initPositions;
    this.handlePositions = [...this.splitPositions];
  },
}
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


