<template>
  <div class='tdv-table'>
    <datatable v-bind="tableOpt">
      <div class="tdv-tbl-toolbar">
        <span v-b-tooltip.hover title="Toggle fullscreen">
          <b-btn size='sm' variant='outline-secondary' :pressed='tstate.maxPane==="table"' @click='tstate.toggleMaxPane("table")'>
            <i class="fa fa-expand"></i>
          </b-btn>
        </span>
        <span v-b-tooltip.hover title="Expand children as columns">
          <b-btn size='sm' variant='outline-secondary' :pressed.sync='isExpanded'>
            <i class="fa fa-arrows-h"></i>
          </b-btn>
        </span>
        <b-button-group class="ml-1">
          <!-- We have to wrapper the button so that tooltip will work properly when it's disabled -->
          <!-- https://bootstrap-vue.js.org/docs/components/tooltip/ -->
          <span v-b-tooltip.hover title="Go back">
            <b-btn :size="'sm'" @click='tstate.back()' :disabled='!tstate.canBack()'>
              <i class="fa fa-arrow-left"></i>
            </b-btn>
          </span>
          <span v-b-tooltip.hover title="Go forward">
            <b-btn :size="'sm'" @click='tstate.forward()' :disabled='!tstate.canForward()'>
              <i class="fa fa-arrow-right"></i>
            </b-btn>
          </span>
        </b-button-group>
        <expand-control :state='expandState' />
        <json-path :tree-node="this.tstate ? this.tstate.selected : null" @node-clicked='nodeClicked'/>
        <!-- query: <b-form-input size='sm' :v-bind="tableOpt.query" /> -->
        <!-- query: {{query}},  -->
        <!-- columns: <pre>{{JSON.stringify(tableOpt.columns, null, ' ')}}</pre> -->
      </div>
    </datatable>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import _ from 'lodash';
import { DatatableOptions, Column, Query } from './Vue2DataTable';
import DataFilter from './DataFilter';
import thFilter from './th-Filter.vue';
import tdValue from './td-Value.vue';
import tdKey from './td-Key1.vue';
import JsonPath from './JsonPath.vue';
import TreeState, { TableNodeState } from '../models/TreeState';
import JSONParserPlugin from '../parsers/JSONParserPlugin';
import ExpandControl, { ExpandState } from './ExpandControl.vue';
import { TDNode, TDNodeType } from 'treedoc';

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
    // fixHeaderAndSetBodyMaxHeight: 200,
    // tblStyle: 'table-layout: fixed', // must
    tblClass: 'table-bordered',
    pageSizeOptions: [5, 20, 50, 100, 200, 500],
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
  isExpandedBuild = false;  // Flag to avoid duplicated rebuild()
  expandState = new ExpandState(0, 0, false);

  @Prop() private tableData!: TreeState | TDNode | object | string;
  @Prop() private options?: DatatableOptions;

  rebuildTable(val: TDNode, cachedState: TableNodeState | null = null) {
    // use defTableOpt to get rid of this.options for non-initial node
    if (!this.defTableOpt)  // backup for the first time, we have to intialize tableOpt attributes to make them reactive
      this.defTableOpt = this.tableOpt;

    this.defTableOpt.columns = [];
    this.tableOpt = { ...this.defTableOpt, ...(this.applyCustomOpts && this.options) };
    if (cachedState) {
      this.tableOpt.query = cachedState.query;
      this.tableOpt.columns = cachedState.columns;
      this.isExpanded = cachedState.isColumnExpanded;
    }

    this.buildTable(val);
    this.queryData(this);
    this.tableOpt.xprops.tstate = this.tstate;
    this.tableOpt.xprops.expandState = this.expandState;
    this.isExpandedBuild = this.isExpanded;
  }

  buildTable(val: TDNode) {
    this.tableOpt.rawData = [];

    if (!val)
      return;
    const ia = val.type === TDNodeType.ARRAY;
    const keyCol = ia ? COL_NO : COL_KEY;
    this.addColumn(keyCol, 0);

    if (val.children) {
      for (const v of val.children) {
        const row = {
          [keyCol]: ia ? Number(v.key) : v.key,
          [COL_VALUE]: v,
        };
        this.tableOpt.rawData.push(row);
        if (this.isExpanded && v && v.children) {
          for (const cv of v.children) {
            this.addColumn(cv.key!);
            row[cv.key!] = cv;
          }
        } else {
          this.addColumn(COL_VALUE, 1);
        }
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
    // VUETIP: we have to use Vue.$set, otherwise, once it's assigned with array syntax. this field will no longer
    // be reactive
    // this.tableOpt.query[field] = '';
    this.$set(this.tableOpt.query, field, undefined);

    col.thClass = 'tdv-th';
    col.tdClass = 'tdv-td';
    if (isKeyCol) {
      col.thClass += ' tdv-min tdv-td';
      col.tdClass = 'tdv-min tdv-td';
    }
  }

  defaultExpand(val: TDNode) {
    if (!val)
      return false;
    const cols = new Set<string>();
    let cellCnt = 0;
    if (!val.children || val.children.length === 0)
      return false;

    for (const v of val.children) {
      if (v && v.children) {
        for (const child of v.children) {
          cols.add(child.key!);
          cellCnt++;
        }
      }
    }
    // k: threshold (blank cell / Total possible blank cells)
    // k = (rc - cellCnt) / (rc - c) => cellCnt = rc - krc + kc = c (r - rk + k) = c (r - (r-1)k)
    //     When row = 2:   2c(1-k) + ck = 2c - kc = (2-k)c <= cellcnt
    //     When row = 3:   3c(1-k) + ck = 3c - 2ck = (3-2k)c
    const k = 0.8;
    const r = val.children.length;
    const c = cols.size - 1;  // ignore the first column, as the key column is always there
    cellCnt -= r;
    // Limited number of cols due to performance reason
    return cols.size < 100 && cellCnt >= c * (r - (r - 1) * k);
  }

  nodeClicked(data: TDNode) { this.tstate.select(data); }

  queryData = _.debounce((THIS) => {
    const opt = THIS.tableOpt;
    DataFilter.filter(opt);
  });

  @Watch('query', {deep: true})
  watchQuery() { this.queryData(this); }

  @Watch('isExpanded')
  watchIsExpanded() {
    if (this.isExpanded !== this.isExpandedBuild)
      this.rebuildTable(this.selected!);
  }

  @Watch('tableData', {immediate: true})
  watchTableData() {
    this.tstate = this.tableData && this.tableData instanceof TreeState ? this.tableData : new TreeState(this.tableData, new JSONParserPlugin());
  }

  @Watch('tstate.selected', {immediate: true})
  watchSelected(val: TDNode, valOld: TDNode) {
    this.tstate.saveTableState(valOld, new TableNodeState(_.cloneDeep(
      this.tableOpt.query), this.expandState.expandLevel, this.tableOpt.columns, this.isExpanded));

    const cachedState = this.tstate.getTableState(val);
    if (cachedState != null) {
      this.isExpanded = cachedState.isColumnExpanded;
    } else {
      this.isExpanded = this.defaultExpand(val);
    }

    // this.tableOpt.query.offset = 0;
    // if (this.defTableOpt)
    //   this.defTableOpt.query = { limit: 100, offset: 0 };
    this.expandState = new ExpandState(cachedState ? cachedState.expandedLevel : 0, 0, this.expandState.showChildrenSummary);
    this.rebuildTable(val, cachedState);
  }

  @Watch('options', {immediate: true})
  optionsUpdated() { this.rebuildTable(this.selected!); }

  get selected(): TDNode | null {
    return this.tstate ? this.tstate.selected : null;
  }

  get applyCustomOpts() {
    return this.tstate.isInitialNodeSelected() && this.isExpanded && this.options;
  }

  get query() { return this.tableOpt.query; }
}
</script>

<style>
.tdv-table {
  margin: 0 auto;
  width: 100%;
  height: 100%
}
.tdv-th {
  white-space: nowrap;
}
.tdv-min {
  width:1%;
  /* white-space: nowrap; */
}
.tdv-table * .table td, .table th {
  padding: .25rem;
}
.tdv-table * pre {
  /* white-space: pre-wrap; */
  white-space: pre;
  word-wrap: break-word;
  margin-bottom: 0px;
}
.tdv-table * .clearfix {
  margin-bottom: 0px !important;
  position: sticky;top: 0px;
}
.tdv-table * div[name="SimpleTable"] {
  overflow: scroll;
}
.tdv-tbl-toolbar {
  display: flex;
  flex-wrap: wrap;
}
.thead>td{
  position: sticky;
  top: 0;
}
.tdv-td {
  padding: 2px!;
}
/* Fix extra space for the row below the table */
.tdv-table * .col-sm-6 {
  padding-right: 0px;
  padding-left: 0px;
}
.tdv-table * .row {
  margin-right: 0px;
  margin-left: 0px;
}
.tdv-table * .-page-size-select {
  display: inline-block;
  width: 70px;
  font-size: small;
}
</style>
