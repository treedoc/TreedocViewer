<template>
  <div>
    <div>
      <b-btn size='sm' variant='outline-secondary' @click='format'>format</b-btn>
      <b-button-group class="mx-1">
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showSource[0]'>Source</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showTree[0]'>Tree</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showTable[0]'>Table</b-btn>
      </b-button-group>
      <span class="status-msg" :class="{error: hasError}" >{{parseResult}}</span>
      <span><slot/></span>
    </div>
    <div style="width:99%">
      <msplit>
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
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import _ from 'lodash';
import TreeState from '../models/TreeState';
import TreeView from './TreeView.vue';
import JsonTable from './JsonTable.vue';
import Tree, { TreeNode } from '../models/Tree';

@Component({
  components: {
    TreeView,
    JsonTable,
  },
})
export default class JsonTreeTable extends Vue {
  @Prop() data!: object | any[] | string;
  @Prop() options!: object;
  @Prop() initalPath!: string;
  @Prop() rootObjectKey!: string;

  showSource = [true];
  showTree = [true];
  showTable = [true];
  tstate = new TreeState({});
  selectedNode = this.tstate.selected;
  jsonStr = '';

  parseResult = '';
  strDataSynced = false;
  error = {
    color: 'red',
  };

  nodeClicked(node: TreeNode) {
    this.tstate.select(node);
  }

  format() {
    this.jsonStr = JSON.stringify(this.tstate.tree.obj, null, 2);
  }

  @Watch('data', { immediate: true })
  watchData(d: string | object | any[]) {
    if (_.isString(d))
      this.jsonStr =  d;
    else {
      this.jsonStr = JSON.stringify(d, null, '  ');
      this.strDataSynced = true;
    }
  }

  @Watch('jsonStr', { immediate: true })
  watchJsonStr(str: string) {
    this.tstate = new TreeState(this.strDataSynced ? this.data : str, this.rootObjectKey);
    this.strDataSynced = false;
    this.parseResult = this.tstate.parseResult;

    if (this.initalPath)
      this.tstate.select(this.initalPath, true);
  }

  get hasError() {
    return this.parseResult.startsWith('Error');
  }
}
</script>
<style>
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
