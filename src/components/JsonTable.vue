<template>
  <div class='tdv-table'>
    <datatable v-bind="tableOpt">
      <div style="display: flex column">
        <div class='tdv-tbl-top'>
          <slot name='tableTitle' v-if="hasTableTitleSlot" />
          <json-path :tree-node="this.tstate ? this.tstate.selected : null" @node-clicked='nodeClicked'/>
          <div class="tdv-tbl-toolbar">
            <expand-control :state='expandState' v-if="tstate.hasTreeInTable" />
            <span v-b-tooltip.hover title="Toggle fullscreen" v-if="isInMuliPane">
              <b-btn size='sm' variant='outline-secondary' :pressed='tstate.maxPane==="table"' @click='tstate.toggleMaxPane("table")'>
                <i class="fa fa-expand"></i>
              </b-btn>
            </span>
            <span v-b-tooltip.hover title="Expand children as columns">
              <b-btn size='sm' variant='outline-secondary' :pressed.sync='isColumnExpanded'>
                <i class="fa fa-arrows-h"></i>
              </b-btn>
            </span>
            <span v-b-tooltip.hover title="Copy table as JSON">
              <b-btn size='sm' variant='outline-secondary'>
                <i class="fa fa-copy" @click='copy'></i>
              </b-btn>
            </span>
            <span v-b-tooltip.hover title="Wrap text" v-if="isInMuliPane">
              <b-btn size='sm' variant='outline-secondary' :pressed='tstate.textWrap' @click='tstate.textWrap = !tstate.textWrap'>
                <i class="fa fa-level-down"></i>
              </b-btn>
            </span>
            <span v-b-tooltip.hover title="Advanced Query" v-if="isInMuliPane">
              <b-btn size='sm' variant='outline-secondary' :pressed='showAdvancedQuery' @click='showAdvancedQuery = !showAdvancedQuery'>
                <i class="fa fa-filter"></i>
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
            <!-- columns: <pre>{{JSON.stringify(tableOpt.columns, null, ' ')}}</pre> -->
          </div>
        </div>
        <template v-if="showAdvancedQuery">
          <div style="display: flex;"  v-b-tooltip.hover title="Advanced Query with Javascript">
            JSQuery:<b-form-input size='sm' style="display:inline;width:100%" v-model="tableOpt.query.jsQuery" placeholder="Custom query in JS" debounce="500" /><br>
          </div>
          Query:{{tableOpt.query}}
        </template>
      </div>
    </datatable>
    <textarea ref='textViewCopyBuffer' v-model="copyBuffer" class='hiddenTextArea nowrap'></textarea>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import _ from 'lodash';
import { DataTableOptions, Column, Query } from './Vue2DataTable';
import DataFilter from './DataFilter';
import thFilter from './th-Filter.vue';
import tdValue from './td-Value.vue';
import tdKey from './td-Key1.vue';
import JsonPath from './JsonPath.vue';
import TreeState, { TableNodeState } from '../models/TreeState';
import JSONParserPlugin from '../parsers/JSONParserPlugin';
import ExpandControl, { ExpandState } from './ExpandControl.vue';
import { identity, ListUtil, TD, TDNode, TDNodeType } from 'treedoc';
import { TableUtil } from '../models/TableUtil';

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
  tableOpt: DataTableOptions = {
    // fixHeaderAndSetBodyMaxHeight: 200,
    // tblStyle: 'table-layout: fixed', // must
    tblClass: 'table-bordered',
    pageSizeOptions: [5, 20, 50, 100, 200, 500],
    columns: [],
    data: [],
    filteredData: [],
    rawData: [],
    total: 0,
    query: { limit: 100, offset: 0, jsQuery: 'r => r' },
    xprops: { tstate: null },
  };
  defTableOpt!: any;
  // !! class based component, we have to initialized the data field, "undefined" won't be reactive. !!
  // https://github.com/vuejs/vue-class-component#undefined-will-not-be-reactive
  tstate: TreeState = new TreeState({});
  isColumnExpanded = false;
  isColumnExpandedBuild = false;  // Flag to avoid duplicated rebuild()
  expandState = new ExpandState(0, 0, false);
  copyBuffer = '';
  showAdvancedQuery = false;

  @Prop() private tableData!: TreeState | TDNode | object | string;
  @Prop() private options?: DataTableOptions;
  @Prop() private isInMuliPane?: boolean;  // TODO: Move to TDVTableOption

  rebuildTable(val: TDNode, cachedState: TableNodeState | null = null) {
    // use defTableOpt to get rid of this.options for non-initial node
    if (!this.defTableOpt)  // backup for the first time, we have to intialize tableOpt attributes to make them reactive
      this.defTableOpt = this.tableOpt;

    this.defTableOpt.columns = [];
    this.tableOpt = { ...this.defTableOpt, ...(this.applyCustomOpts && this.options) };
    if (cachedState) {
      this.tableOpt.query = cachedState.query;
      this.tableOpt.columns = cachedState.columns;
      this.isColumnExpanded = cachedState.isColumnExpanded;
    }

    this.buildTable(val);
    this.queryData();
    this.tstate.hasTreeInTable = false;
    // console.log('clear hasTreeInTable');
    this.tableOpt.xprops.tstate = this.tstate;
    this.tableOpt.xprops.expandState = this.expandState;
    this.isColumnExpandedBuild = this.isColumnExpanded;
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
        if (this.isColumnExpanded && v && v.children) {
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
    // k = (r * c - cellCnt) / (r * c - c) => cellCnt = r * c - k * r * c + k * c = c (r - r * k + k) = c (r - (r-1)k)
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

  queryData() {
    DataFilter.filter(this.tableOpt);
  }

  copy() {
    // console.log(this.tableOpt.filteredData);
    // console.log('coloumns:');
    // console.log(this.tableOpt.columns, null, ' ');
    const data = this.tableOpt.filteredData;
    const exportData = this.tableOpt.columns[0].field === '@key' ? 
        TableUtil.rowsToObject(data, this.tableOpt) : data.map(r => TableUtil.rowToObject(r, this.tableOpt));

    // Array to object if there's "@key"
    this.copyBuffer = TD.stringify(exportData);
    console.log(`this.copyBuffer=${this.copyBuffer}`);
    this.$nextTick(() => {
      const textView = this.$refs.textViewCopyBuffer as HTMLTextAreaElement;
      textView.select();
      textView.setSelectionRange(0, 999999999);
      // document.execCommand('selectAll');
      const res = document.execCommand('copy');
      this.$bvToast.toast('Data is copied successfully', { autoHideDelay: 2000, appendToast: true, toaster: 'b-toaster-bottom-right' });
    });
  }


  @Watch('query', {deep: true})
  watchQuery() { this.queryData(); }

  @Watch('isColumnExpanded')
  watchisColumnExpanded() {
    if (this.isColumnExpanded !== this.isColumnExpandedBuild)
      this.rebuildTable(this.selected!);
  }

  @Watch('tableData', {immediate: true})
  watchTableData() {
    this.tstate = this.tableData && this.tableData instanceof TreeState ? this.tableData : new TreeState(this.tableData, new JSONParserPlugin());
  }

  @Watch('tstate.selected', {immediate: true})
  watchSelected(node: TDNode, oldNode: TDNode) {
    if (oldNode && oldNode.doc === node.doc)
      this.tstate.saveTableState(oldNode, new TableNodeState(_.cloneDeep(
        this.tableOpt.query), this.expandState.expandLevel, this.tableOpt.columns, this.isColumnExpanded));

    const cachedState = this.tstate.getTableState(node);
    if (cachedState != null) {
      this.isColumnExpanded = cachedState.isColumnExpanded;
    } else {
      this.isColumnExpanded = this.defaultExpand(node);
    }

    // this.tableOpt.query.offset = 0;
    // if (this.defTableOpt)
    //   this.defTableOpt.query = { limit: 100, offset: 0 };
    this.expandState = new ExpandState(cachedState ? cachedState.expandedLevel : 0, 0, this.expandState.showChildrenSummary);
    this.rebuildTable(node, cachedState);
  }

  @Watch('options', {immediate: true})
  optionsUpdated() { this.rebuildTable(this.selected!); }

  get selected(): TDNode | null {
    return this.tstate ? this.tstate.selected : null;
  }

  get applyCustomOpts() {
    return this.tstate.isInitialNodeSelected() && this.isColumnExpanded && this.options;
  }

  get query() { return this.tableOpt.query; }

  get hasTableTitleSlot() { return !!this.$slots.tableTitle; }
}
</script>

<style>
.tdv-tbl-top {
  display: flex;
  justify-content: space-between;
}
.tdv-tbl-toolbar {
  display: flex;
  flex-grow: 2;
  justify-content: flex-end;
  flex-wrap: wrap;
  float: right;
}
.tdv-tbl-title {
  display: inline;
}
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
