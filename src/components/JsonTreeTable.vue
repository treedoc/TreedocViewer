<template>
  <div>
    <div style="width:100%">
      <b-button-group class="mx-1">
        <b-btn size='sm' variant='outline-secondary' @click='format'>format</b-btn><b-divider/>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showSource[0]'>Source</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showTree[0]'>Tree</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showTable[0]'>Table</b-btn>
      </b-button-group>
      <span class="status-msg" :class="{error: hasError}" >{{parseResult}}</span>
    </div>
    <msplit style="width:99%;height:100%">
      <div slot="source" :grow="20" style="width: 100%" :show="showSource" >
        <textarea style="width: 100%; min-height:400px; height: 100%; flex-grow:1; overflow:auto;" v-model="jsonStr"></textarea>
      </div>
      <div slot="tree" :grow="30" :show="showTree">
        <tree-view v-if="tstate.tree" :json-tree="tstate.tree" :options="{maxDepth: 2, rootObjectKey: 'root'}" v-on:nodeClicked='nodeClicked'></tree-view>
        <div v-else>No Data</div>
      </div>
      <div slot="table" :grow="50" :show="showTable">
        <div v-if="tstate.tree" ><json-table :table-data='tstate' v-on:nodeClicked='nodeClicked'/></div>
        <div v-else>No Data</div>
      </div>
    </msplit>

    <!-- <split-panel ref="splitPanel" orientation="vertical" :show-border="true" :init-position="400">
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
        <div v-if="tstate.tree" ><json-table :table-data='tstate' v-on:nodeClicked='nodeClicked'/></div>
        <div v-else>No Data</div>
      </div>
    </split-panel> -->
  </div>
</template>

<script>
// import { Multipane, MultipaneResizer } from 'vue-multipane';
import _ from 'lodash';
import Vue from 'vue';
// import { MSplit } from 'msplit';
// import 'msplit/dist/lib/lib.css';
import TreeState from '../models/TreeState';
import TreeView from './TreeView.vue';
import JsonTable from './JsonTable.vue';
// import SplitPanel from './SplitPanel.vue';
// import MSplitPanel from './MSplitPanel.vue';


Vue.component('test', {
  render() { return null; },
});
/* eslint-disable no-unused-vars */
let o;  // Used by eval
export default {
  name: 'app',
  components: {
    TreeView,
    JsonTable,
  },
  props: {
    data: [Object, Array, String],
    options: Object,
    initalPath: String,
    rootObjectKey: String,
  },
  data() {
    return {
      showSource: [true],
      showTree: [true],
      showTable: [true],
      selectedNode: null,
      jsonStr: null,
      tstate: null,
      parseResult: null,
      strDataSynced: false,
      error: {
        color: 'red',
      },
    };
  },

  // mounted() {
  //   this.$refs.splitPanel.sizeChanged(this);
  //   this.$refs.splitPanelLeft.sizeChanged(this);
  // },
  watch: {
    data: {
      immediate: true,
      handler(d) {
        if (_.isString(d))
          this.jsonStr =  d;
        else {
          this.jsonStr = JSON.stringify(d, null, '  ');
          this.strDataSynced = true;
        }
      },
    },
    jsonStr: {
      immediate: true,
      handler(str) {
        this.tstate = new TreeState(this.strDataSynced ? this.data : str, this.rootObjectKey);
        this.strDataSynced = false;
        this.parseResult = this.tstate.parseResult;

        if (this.initalPath)
          this.tstate.select(this.initalPath, true);
      },
    },
  },
  methods: {
    nodeClicked(node) {
      // console.log(data.toString());
      this.tstate.select(node);
    },
    format() {
      this.jsonStr = JSON.stringify(this.tstate.tree.obj, null, 2);
    },
  },
  computed: {
    hasError() {
      return this.parseResult.startsWith('Error');
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

.status-msg {
  font-size: smaller;
  color: green;
}

.error {
  color: red;
}
</style>
