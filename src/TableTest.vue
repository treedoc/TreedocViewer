<template>
  <div id='app' class='components-container'>
    <json-table :table-data="tstateTable" :options="tableParam.tableConfig">
      <div slot="tableTitle">
        <h5 style="margin-top:6px;margin-right: 5px;">{{tableParam.title}}&nbsp;</h5>
      </div>
    </json-table>
  </div>
</template>

<script lang='ts'>
import { Component, Vue } from 'vue-property-decorator';

import JsonTable from './components/JsonTable.vue';
import sampleData from './sampleData';
import TreeState from './models/TreeState';
import TDSample from './tdSample.vue';
import UrlParam from './UrlParam';
import TableParam from './models/TableParam';
import { table } from 'console';
import { LangUtil }  from 'treedoc';

const doIfNotNull = LangUtil.doIfNotNull;

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
    tableConfig: {
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

  // tslint:disable-next-line:max-line-length
  // Sample URL: http://localhost:8081/?data={a:1,b:[{b1:2,b2:3},%20{b1:4,b2:5}],c:3}&initialPath=/b&tableConfig={Pagination:false,columns:[{field:b1}]}&title=tableTest&#/table
  mounted() {
    doIfNotNull(this.param.title, $ => this.tableParam.title = $)  
    doIfNotNull(this.param.tableConfig, $ => this.tableParam.tableConfig = $)  
    doIfNotNull(this.param.data, $ => this.tableParam.jsonData = $)
    doIfNotNull(this.param.initialPath, $ => this.tableParam.initialPath = $);
  }
}
</script>

<style>
</style>
