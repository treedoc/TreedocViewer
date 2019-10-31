<template>

  <div id='app' class='components-container'>
    <h6 class="title">TreeDoc Table Viewer for JSON, Prototext, jsonex, json5, hjson, yaml</h6>
    <json-tree-table v-if="true" :data='selectedSample' :inital-path="'activityHistory'" :options='jttOption' rootObjectKey='root'>
      Sample Data: <b-form-select v-model="selectedSample" :options="sampleData" size='sm' style="width:auto" />
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
import JTTOptions from './models/JTTOption';
import YAMLParser from './parsers/YAMLParser';
import XMLParser from './parsers/XMLParser';

@Component({
  components: {
    JsonTreeTable,
    JsonTable,
  },
})
export default class App extends Vue {
  sampleData = sampleData.data;
  selectedSample  = sampleData.data[0].value;
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
  jttOption: JTTOptions = {
    parsers: [
      new YAMLParser(),
      new XMLParser(),
      new XMLParser('XML compact', 'text/xml', true),
      new XMLParser('html', 'text/html'),
      ],
  };

  get tstateTable() {
    const state = new TreeState(sampleData.jsonStr);
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
