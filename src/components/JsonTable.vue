<template>
  <div>
    <datatable v-bind="tableOpt">
      <div style="display: flex">
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='isExpanded' v-b-tooltip.hover title="expand as columns">
          <i class="fa fa-arrows-h"></i>
        </b-btn> &nbsp;
        <b-button-group class="ml-1">
          <b-btn :size="'sm'" @click='tstate.back()' :disabled='!tstate.canBack()' v-b-tooltip.hover title="back">
            <i class="fa fa-arrow-left"></i>
          </b-btn>
          <b-btn :size="'sm'" @click='tstate.forward()' :disabled='!tstate.canForward()' v-b-tooltip.hover title="forward">
            <i class="fa fa-arrow-right"></i>
          </b-btn>
        </b-button-group>
        <expand-control :state='expandState' />
        <json-path :tree-node="this.tstate ? this.tstate.selected : null" v-on:nodeClicked='nodeClicked'/>
        <!-- query: <b-form-input size='sm' :v-bind="tableOpt.query" /> -->
      </div>
    </datatable>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

import { DatatableOptions, Column, Query } from './Vue2DataTable';
import DataFilter from './DataFilter';
import thFilter from './th-Filter.vue';
import tdValue from './td-Value.vue';
import tdKey from './td-Key1.vue';
import JsonPath from './JsonPath.vue';
import TreeState from '../models/TreeState';
import Tree, { TreeNode } from '../models/Tree';
import JSONParser from '../parsers/JSONParser';
import ExpandControl, { ExpandState } from './ExpandControl.vue';

const COL_VALUE = '@value';
const COL_NO = '#';
const COL_KEY = '@key';

@Component({
  components: {
    JsonPath,
    ExpandControl,
  },
})
export default class JsonTable extends Vue {
  tableOpt: DatatableOptions = {
    tblClass: 'table-bordered',
    pageSizeOptions: [5, 20, 50, 100, 200],
    columns: [],
    data: [],
    rawData: [],
    total: 0,
    query: { limit: 100, offset: 0 },
    xprops: { tstate: null },
  };
  defTableOpt!: any;
  // !! class based component, we have to initialized the data field, "undefined" won't be reactive. !!
  // https://github.com/vuejs/vue-class-component#undefined-will-not-be-reactive
  tstate: TreeState = new TreeState({});
  isExpanded = false;
  expandState = new ExpandState(0, 0);

  @Prop() private tableData!: TreeState | Tree | object | string;
  @Prop() private options?: DatatableOptions;

  rebuildTable(val: TreeNode) {
    if (!this.defTableOpt)  // backup for the first time, we have to intialize tableOpt attributes to make them reactive
      this.defTableOpt = this.tableOpt;

    this.defTableOpt.columns = [];
    this.tableOpt = { ...this.defTableOpt, ...(this.applyCustomOpts && this.options) };
    this.buildTable(val);
    this.queryData();
    this.tableOpt.xprops.tstate = this.tstate;
    this.tableOpt.xprops.expandState = this.expandState;
  }

  buildTable(val: TreeNode) {
    this.tableOpt.rawData = [];

    if (!val)
      return;
    const ia = val.isArray();
    const keyCol = ia ? COL_NO : COL_KEY;
    this.addColumn(keyCol, 0);
    for (const k of Object.keys(val.children)) {
      const v = val.children[k];
      const row = {
        [keyCol]: ia ? Number(k) : k,
        [COL_VALUE]: v,
      };
      this.tableOpt.rawData.push(row);
      if (this.isExpanded && v && !v.isLeaf()) {
        for (const ck of Object.keys(v.children)) {
          this.addColumn(ck);
          row[ck] = v.children[ck];
        }
      } else {
        this.addColumn(COL_VALUE, 1);
      }
    }
  }

  addColumn(field: string, idx = this.tableOpt.columns.length) {
    const isKeyCol = idx === 0;
    const cols = this.tableOpt.columns;
    let col = cols.find(c => c.field === field);
    if (!col) {
      col = {
        field,
        visible: isKeyCol || !(this.applyCustomOpts && this.options!.columns),
      };
      cols.splice(idx, 0, col);
    }
    if (col.processed)
      return;

    col.title = col.title || field;
    col.sortable = true;
    col.thComp = col.thComp || thFilter;
    col.tdComp = col.tdComp || (isKeyCol ? tdKey : tdValue);
    col.processed = true;

    if (isKeyCol) {
      col.thClass = 'jsontable-min';
      col.tdClass = 'jsontable-min';
    }
  }

  defaultExpand(val: TreeNode) {
    if (!val)
      return false;
    const cols = new Set<string>();
    let cellCnt = 0;
    for (const k of Object.keys(val.children)) {
      const v = val.children[k];
      if (v && !v.isLeaf()) {
        for (const ck of Object.keys(v.children)) {
          cols.add(ck);
          cellCnt++;
        }
      }
    }
    const totalCell = cols.size * Object.keys(val.children).length;
    // Limited number of cells due to performance reason
    return cellCnt < 1000 && cellCnt * 2 > totalCell;  // Fill ratio > 1/3
  }

  nodeClicked(data: TreeNode) { this.tstate.select(data); }

  queryData() {
    const opt = this.tableOpt;
    opt.data = DataFilter.filter(opt.columns, opt.rawData, opt.query);
    opt.total = opt.rawData.length;
  }

  @Watch('query', {deep: true})
  watchQuery() { this.queryData(); }

  @Watch('isExpanded')
  watchIsExpanded() { this.rebuildTable(this.selected!); }

  @Watch('tableData', {immediate: true})
  watchTableData() {
    this.tstate = this.tableData && this.tableData instanceof TreeState ? this.tableData : new TreeState(this.tableData, new JSONParser());
  }

  @Watch('tstate.selected', {immediate: true})
  watchSelected(val: TreeNode) {
    this.isExpanded = this.defaultExpand(val);
    this.tableOpt.query.offset = 0;
    this.expandState = new ExpandState(0, 0);
    this.rebuildTable(val);
  }

  @Watch('options', {immediate: true})
  optionsUpdated() { this.rebuildTable(this.selected!); }

  get selected(): TreeNode | null {
    return this.tstate ? this.tstate.selected : null;
  }

  get applyCustomOpts() {
    return this.tstate.isInitialNodeSelected() && this.isExpanded && this.options;
  }

  get query() { return this.tableOpt.query; }
}
</script>

<style>
.jsontable-min {
  width:1%;
}
.table td, .table th {
  padding: .25rem;
}
pre {
  /* white-space: pre-wrap; */
  white-space: pre;
  word-wrap: break-word;
  margin-bottom: 0px;
}
.clearfix {
  margin-bottom: 0px !important;
}
</style>
