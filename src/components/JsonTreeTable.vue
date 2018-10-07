<template>
  <div>
    <div style="width:100%">
      <b-button-group class="mx-1" style="">
        <b-btn :size="'sm'" :variant="showSource?'primary': 'secondary'" @click="showSource=!showSource">Source</b-btn>
        <b-btn :size="'sm'" :variant="showTree?'primary': 'secondary'" @click="showTree=!showTree">Tree</b-btn>
        <b-btn :size="'sm'" :variant="showTable?'primary': 'secondary'" @click="showTable=!showTable">Table</b-btn>
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


    <split-panel ref="splitPanel" orientation="vertical" :show-border="true" :init-position="300">
      <div slot="panel1" style='overflow:auto;display:flex;flex-grow:1'>
        <split-panel ref="splitPanelLeft" orientation="vertical" :show-border="true" :init-position="100">
          <textarea slot="panel1" style="width: 100%; height: auto; flex-grow:1; overflow:auto;" v-model="jsonStr"></textarea>
          <tree-view  slot="panel2" :json-tree="tree" :options="{maxDepth: 2, rootObjectKey: 'root'}" v-on:nodeClicked='nodeClicked'></tree-view>
        </split-panel>
      </div>   
      <div slot="panel2">
        <div>here</div>
        <div><json-table :tableData='selectedNode' /></div>
      </div>
    </split-panel>
  </div>
</template>

<script>
import { Multipane, MultipaneResizer } from 'vue-multipane';
import _ from 'lodash';

import { Tree } from './Tree';
import TreeView from './TreeView.vue';
import JsonTable from './JsonTable.vue';
import SplitPanel from './SplitPanel.vue';

export default {
  name: 'app',
  components: {
    Multipane,
    MultipaneResizer,
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
    };
  },
  created() {
    if (_.isString(this.data)) {
      this.jsonStr = this.data;
      this.jsonObj = JSON.parse(this.data);
    } else {
      this.jsonObj = this.data;
      this.jsonStr = JSON.stringify(this.data, null, "  ");
    }
  },
  mounted() {
    this.$refs.splitPanel.sizeChanged(this)
    this.$refs.splitPanelLeft.sizeChanged(this)
  },
  watch: {
    jsonStr() {
      this.jsonObj = JSON.parse(this.jsonStr);
    },
    jsonObj() {
      this.selectedNode = this.tree.root;
    },
  },
  methods: {
    nodeClicked(data) {
      console.log(`node clicked: ${data}`);
      this.selectedNode = data;
    },
  },
  computed: {
    tree() {
      return this.jsonObj ? new Tree(this.jsonObj, this.rootObjectKey || "root") : null;
    },
  }
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
</style>
