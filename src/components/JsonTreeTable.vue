<template>
  <div>
    <div style="width:100%">
      <b-button-group class="mx-1" style="">
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showSource'>Source</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showTree'>Tree</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showTable'>Table</b-btn>
      </b-button-group>
      <b-button-group class="mx-1" style="">
        <b-btn :size="'sm'" @click='tstate.back()' :disabled='!tstate.canBack()'>Back</b-btn>
        <b-btn :size="'sm'" @click='tstate.forward()' :disabled='!tstate.canForward()'>Forward</b-btn>
      </b-button-group>
    </div>
    <split-panel ref="splitPanel" orientation="vertical" :show-border="true" :init-position="400">
      <div slot="panel1" style='overflow:auto;display:flex;flex-grow:1'>
        <split-panel ref="splitPanelLeft" orientation="vertical" :show-border="true" :init-position="100">
          <textarea slot="panel1" style="width: 100%; height: auto; flex-grow:1; overflow:auto;" v-model="jsonStr"></textarea>
          <div slot="panel2">
            <tree-view v-if="tstate.tree" :json-tree="tstate.tree" :options="{maxDepth: 2, rootObjectKey: 'root'}" v-on:nodeClicked='nodeClicked'></tree-view>
            <div v-else>No Data</div>
          </div>
        </split-panel>
      </div>
      <div slot="panel2">
        <div v-if="tstate.tree" ><json-table :tstate='tstate' v-on:nodeClicked='nodeClicked'/></div>
        <div v-else>No Data</div>
      </div>
    </split-panel>
  </div>
</template>

<script>
// import { Multipane, MultipaneResizer } from 'vue-multipane';
import _ from 'lodash';

import TreeState from '../models/TreeState';
import TreeView from './TreeView.vue';
import JsonTable from './JsonTable.vue';
import SplitPanel from './SplitPanel.vue';

let o;  // Used by eval
export default {
  name: 'app',
  components: {
    TreeView,
    JsonTable,
    SplitPanel,
  },
  props: {
    data: [Object, Array, String],
    options: Object,
  },
  data() {
    return {
      showSource: false,
      showTree: true,
      showTable: true,
      selectedNode: null,
      jsonStr: null,
      tstate: null,
    };
  },

  mounted() {
    this.$refs.splitPanel.sizeChanged(this);
    this.$refs.splitPanelLeft.sizeChanged(this);
  },
  watch: {
    data: {
      immediate: true,
      handler(data) { this.jsonStr = _.isString(data) ? data : this.jsonStr = JSON.stringify(data, null, '  '); },
    },
    jsonStr: {
      immediate: true,
      handler(data) { this.tstate = new TreeState(data, this.rootObjectKey); },
    },
  },
  methods: {
    nodeClicked(data) {
      console.log(`node clicked: ${data}`);
      this.tstate.select(data);
    },
  },
};
</script>

<style>
.multipane.foo.layout-v .multipane-resizer {
  margin: 0; left: 0; /* reset default styling */
  width: 5px;
  height: unset;
  background: lightgray;
}

.vertical-panes {
  width: 100%;
  height: 400px;
  border: 1px solid #ccc;
}
.vertical-panes > .pane {
  text-align: left;
  padding: 15px;
  overflow: hidden;
  background: #eee;
}
.vertical-panes > .pane ~ .pane {
  border-left: 1px solid #ccc;
}

.btn-outline-secondary:hover {
  /* border-width: 2px; */
  color: black;
  background-color: lightgray;
}

</style>
