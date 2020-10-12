<template>
  <div id='app' class='components-container'>
    <json-table :table-data="tstateTable" :options="jsonTableOptions"/>
  </div>
</template>

<script lang='ts'>
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

import JsonTreeTable from './components/JsonTreeTable.vue';
import JsonTable from './components/JsonTable.vue';
import sampleData from './sampleData';
import TreeState from './models/TreeState';
import TDSample from './tdSample.vue';
import TDVOptions from './models/TDVOption';
import YAMLParserPlugin from './parsers/YAMLParserPlugin';
import XMLParserPlugin from './parsers/XMLParserPlugin';
import CSVParserPlugin from './parsers/CSVParserPlugin';
import UrlParam from './UrlParam';

@Component({
  components: {
    JsonTable,
  },
})
export default class TableTest extends Vue {
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
        html: (value: any, row: any) => `<a href="http://abc.com/${row.runtimeContext.value}">${value.value}</a>`,
      },
    ],
  };

  get tstateTable() {
    const state = new TreeState(sampleData.jsonStr);
    const n = state.tree.root.getByPath('/activityHistory');
    if (n)
      state.select(n, true);
    return state;
  }
}
</script>

<style>
</style>
