<template>
  <div>
    <div style="width:100%">
      <b-button-group class="mx-1" style="">
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showSource'>Source</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showTree'>Tree</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showTable'>Table</b-btn>
      </b-button-group>
      <b-button-group class="mx-1" style="">
        <b-btn :size="'sm'" @click='back()' :disabled='historyPos <= 0'>Back</b-btn>
        <b-btn :size="'sm'" @click='forward()' :disabled='historyPos >= history.length - 1'>Forward</b-btn>
      </b-button-group>
    </div>

    <!-- <Split style="height: 500px; width:100%">
      <SplitArea :size="20">
        <textarea style="width: 100%; height: 100%; overflow:auto;" v-model="jsonStr"></textarea>
      </SplitArea>
      <SplitArea :size="30">
        <tree-view :json-tree="tree" :options="{maxDepth: 2, rootObjectKey: 'root'}" v-on:nodeClicked='nodeClicked'></tree-view>
      </SplitArea>
      <SplitArea :size="50">
        <div><json-table :tableData='selectedNode' /></div>
      </SplitArea>
    </Split> -->

    <!-- <multipane class="foo" layout="vertical" style='flex-grow:1;'>
      <div :style="{ width: '300px', maxWidth: '600px', 'min-height':'100%', 'max-height':'100%'}">
        <textarea style="width: 100%;height: 100%;" v-model="jsonStr"></textarea>
      </div>
      <multipane-resizer/>
      <div :style="{ width: '300px', maxWidth: '600px', 'min-height':'100%', 'max-height':'100%'}">
        <tree-view :json-tree="tree" :options="{maxDepth: 2, rootObjectKey: 'root'}" v-on:nodeClicked='nodeClicked'></tree-view>
      </div>
      <multipane-resizer/>
      <div :style="{ flexGrow: 1 }">
        <div>here</div>
        <div><json-table :tableData='selectedNode' /></div>
      </div>
    </multipane>-->


    <split-panel ref="splitPanel" orientation="vertical" :show-border="true" :init-position="400">
      <div slot="panel1" style='overflow:auto;display:flex;flex-grow:1'>
        <split-panel ref="splitPanelLeft" orientation="vertical" :show-border="true" :init-position="100">
          <textarea slot="panel1" style="width: 100%; height: auto; flex-grow:1; overflow:auto;" v-model="jsonStr"></textarea>
          <div slot="panel2">
            <tree-view v-if="tree" :json-tree="tree" :options="{maxDepth: 2, rootObjectKey: 'root'}" v-on:nodeClicked='nodeClicked'></tree-view>
            <div v-else>No Data</div>
          </div>          
        </split-panel>
      </div>
      <div slot="panel2">
        <div v-if="selectedNode" ><json-table :tableData='selectedNode' v-on:nodeClicked='nodeClicked'/></div>
        <div v-else>No Data</div>
      </div>
    </split-panel>
  </div>
</template>

<script>
// import { Multipane, MultipaneResizer } from 'vue-multipane';
import _ from 'lodash';

import { Tree } from './Tree';
import TreeView from './TreeView.vue';
import JsonTable from './JsonTable.vue';
import SplitPanel from './SplitPanel.vue';

var o;
export default {
  name: 'app',
  components: {
    // Multipane,
    // MultipaneResizer,
    TreeView,
    JsonTable,
    SplitPanel,
  },
  props: {
    data: Object,
    options: Object,
  },
  data() {
    return {
      showSource: false,
      showTree: true,
      showTable: true,
      selectedNode: null,
      jsonStr: String,
      jsonObj: Object,
      history: [],
      historyPos: -1,
    };
  },

  mounted() {
    this.$refs.splitPanel.sizeChanged(this);
    this.$refs.splitPanelLeft.sizeChanged(this);
  },
  watch: {
    data: {
      immediate: true,
      handler(data) {
        if (_.isString(data)) {
          this.jsonStr = data;
        } else {
          this.jsonStr = JSON.stringify(data, null, '  ');
        }
      },
    },
    jsonStr: {
      immediate: true,
      handler(data) {
        try {
          this.jsonObj = JSON.parse(data);
        } catch(e) {
          try {
            console.log('var o=' + data);
            eval('o=' + data);
            this.jsonObj = o;
          } catch(e) {
            console.log(e);
            this.jsonObj = null;
          }
        }
      },
    },
    jsonObj() {
      this.history.length = 0;
      this.historyPos = -1;
      this.tree ? this.nodeClicked(this.tree.root) : this.selectedNode = null;      
    },
  },
  methods: {
    nodeClicked(data) {
      console.log(`node clicked: ${data}`);
      if (this.selectedNode === data)
        return;
      this.selectedNode = data;
      this.history.length = this.historyPos + 1;
      this.history.push(data);
      this.historyPos = this.history.length - 1;
    },
    back() {
      if (this.historyPos <= 0)
        return;
      this.selectedNode = this.history[--this.historyPos];
    },
    forward() {
      if (this.historyPos >= this.history.length - 1)
        return;
      this.selectedNode = this.history[++this.historyPos];
    },
  },
  computed: {
    tree() {
      return this.jsonObj ? new Tree(this.jsonObj, this.rootObjectKey || 'root') : null;
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
