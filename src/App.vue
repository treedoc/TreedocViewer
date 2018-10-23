<template>

  <div id='app' class='components-container'>
    <div class="inputline">Select JSON data:
      <b-form-select v-model="selected" :options="jsonTypeNames" class="mb-3" style="width:auto"/>
    </div>
    <json-tree-table v-if="selected" :data='jsonData' :inital-path="'activityHistory'" />
    <hr />
    <div>Json Table</div>
    <json-table :table-data="tstateTable" :options="jsonTableOptions"/>
  </div>
</template>

<script>
import JsonTreeTable from './components/JsonTreeTable.vue';
import JsonTable from './components/JsonTable.vue';
import sampleData from './sampleData';
import TreeState from './models/TreeState';

export default {
  name: 'app',
  components: {
    JsonTreeTable,
    JsonTable,
  },
  data() {
    return {
      selected: sampleData.jsonTypeNames[0],
      ...sampleData,
      jsonTableOptions: {
        Pagination: false,
        columns: [
          { field: 'activityType' },
          { field: 'partitionKey' },
          {
            field: 'creationDate',
            html: (value, row) => `<a href="http://abc.com/${row.runtimeContext.obj}">${value.obj}</a>`,
          },
        ],
      },
    };
  },
  computed: {
    jsonData() { return this.jsonTypes[this.selected]; },
    tstateTable() {
      const state = new TreeState(this.jsonTypes.jsonStr);
      state.select(state.tree.root.getByPath('/activityHistory'), true);
      return state;
    },
  },
};
</script>

<style>
.components-container {
  display: flex;
  position: absolute;
  flex-direction: column;
  min-height:100%;
  min-width:100%;
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
}
</style>
