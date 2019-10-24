<template>

  <div id='app' class='components-container'>
    <h6 class="title">Tree Table Viewer for JSON, Prototext, jsonex, json5, hjson</h6>
    <json-tree-table v-if="true" :data='jsonData' :inital-path="'activityHistory'">
      Sample Data: <b-form-select v-model="selected" :options="jsonTypeNames" size='sm' style="width:auto" />
    </json-tree-table>
    <div v-if=false>
      <hr />
      <div>Json Table</div>
      <json-table :table-data="tstateTable" :options="jsonTableOptions"/>
    </div>
  </div>
</template>


<script lang='ts'>
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

import JsonTreeTable from './components/JsonTreeTable.vue';
import JsonTable from './components/JsonTable.vue';
import sampleData from './sampleData';
import TreeState from './models/TreeState';
import TDSample from './tdSample.vue';

@Component({
  components: {
    JsonTreeTable,
    JsonTable,
  },
})
export default class App extends Vue {
  selected = sampleData.jsonTypeNames[0];
  jsonTypeNames = sampleData.jsonTypeNames;
  jsonTypes = sampleData.jsonTypes;
  jsonTableOptions = {
    Pagination: false,
    columns: [
      { field: 'activityType' },
      {
        field: 'partitionKey',
        tdComp: TDSample,
      },
      {
        field: 'creationDate',
        html: (value: any, row: any) => `<a href="http://abc.com/${row.runtimeContext.obj}">${value.obj}</a>`,
      },
    ],
  };

  get jsonData() { return this.jsonTypes[this.selected]; }

  get tstateTable() {
    const state = new TreeState(this.jsonTypes.jsonStr);
    state.select(state.tree.root.getByPath('/activityHistory'), true);
    return state;
  }
}
</script>

<style>
.title {
  text-align: center;
  color: darkblue
}
.components-container {
  display: flex;
  position: absolute;
  flex-direction: column;
  width: 100%;
  /* min-height:100%;
  min-width:100%; */
}
html {
  height: 100%;
}
body {
  min-height: 100%;
}
.inputline {
  display: flex;
  align-items: center;
  float:right;
}
</style>
