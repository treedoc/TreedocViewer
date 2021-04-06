<template>
  <div id='app' class='components-container'>
    <json-table :table-data="tstateTable" :options="tableParam.option">
      <div slot="tableTitle">
        <h5 style="margin-top:6px">{{tableParam.title}}</h5>
      </div>
    </json-table>
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
import { TDJSONParser } from 'treedoc';
import TableParam from './models/TableParam';

@Component({
  components: {
    JsonTable,
  },
})
export default class TableTest extends Vue {
  param = new UrlParam();
  tableParam: TableParam = {
    title: 'Test Table Title',
    jsonData: sampleData.jsonStr,
    initialPath: '/activityHistory',
    options: {
      Pagination: false,
      columns: [
        { field: 'activityType' },
        {
          field: 'partitionKey',
          tdComp: TDSample,
        },
        {
          field: '$type',
          html: '`<a href="relative/${row.partitionKey.value}">${value.value}</a>`',
        },
        {
          field: 'creationDate',
          html: (value: any, row: any) => `<a href="http://abc.com/${row.runtimeContext.value}">${value.value}</a>`,
        },
      ],
    },
  };

  get tstateTable() {
    const state = new TreeState(this.tableParam.jsonData);
    const n = state.tree.root.getByPath(this.tableParam.initialPath || '');
    if (n)
      state.select(n, true);
    return state;
  }

  mounted() {
    if (this.param.tableParam) {
      this.tableParam = this.param.tableParam;
    }
  }
}
</script>

<style>
</style>
