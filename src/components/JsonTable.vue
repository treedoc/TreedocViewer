<template>
  <div>
    query: {{query}}
    <datatable v-bind="tableOpt">
      <div style="display: flex">
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='isExpanded' v-b-tooltip.hover title="expand">
          <i class="fa fa-arrows-h"></i>
        </b-btn> &nbsp;
        <b-button-group class="mx-1" style="">
          <b-btn :size="'sm'" @click='tstate.back()' v-if='tstate.canBack()' title="back">
            <i class="fa fa-arrow-left"></i>
          </b-btn>
          <b-btn :size="'sm'" @click='tstate.forward()' v-if='tstate.canForward()' title="forward">
            <i class="fa fa-arrow-right"></i>
          </b-btn>
        </b-button-group>
        <json-path :tree-node="selected" v-on:nodeClicked='nodeClicked' v-if="!tstate.isRootSelected()"/>
      </div>
    </datatable>
  </div>
</template>

<script>
import DataFilter from './DataFilter';
import thFilter from './th-Filter.vue';
import tdValue from './td-Value.vue';
import tdKey from './td-Key1.vue';
import JsonPath from './JsonPath.vue';
import TreeState from '../models/TreeState';
import Tree from '../models/Tree';

const COL_VALUE = '@value';
const COL_NO = '#';
const COL_KEY = '@key';

export default {
  name: 'json-table',
  props: {
    /* eslint-disable object-curly-newline */
    tableData: { TreeState, Tree, Object, String },
    options: Object,  // columns:Object: similar as the one defined in Vue2DataTable, exception field is the key
  },
  components: { thFilter, JsonPath },
  data() {
    return {
      tableOpt: {
        tblClass: 'table-bordered',
        pageSizeOptions: [5, 20, 50, 100, 200],
        columns: [],
        data: [],
        rawData: [],
        total: 0,
        query: { limit: 100, offset: 0 },
        xprops: { tstate: this.tstate },
      },
      defTableOpt: null,
      tstate: null,
      isExpanded: false,
    };
  },
  methods: {
    /** @param {TreeNode} val */
    rebuildTable(val) {
      if (!this.defTableOpt)  // backup for the first time, we have to intialize tableOpt attributes to make them reacti
        this.defTableOpt = this.tableOpt;

      this.defTableOpt.columns = [];
      this.tableOpt = { ...this.defTableOpt, ...(this.applyCustomOpts && this.options) };
      this.buildTable(val);
      this.queryData();
      this.tableOpt.xprops.tstate = this.tstate;
    },
    /** @param {TreeNode} val */
    buildTable(val) {
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
    },
    addColumn(field, idx = this.tableOpt.columns.length) {
      const isKeyCol = idx === 0;
      const cols = this.tableOpt.columns;
      let col = cols.find(c => c.field === field);
      if (!col) {
        col = {
          field,
          visible: isKeyCol || !(this.applyCustomOpts && this.options.columns),
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
    },
    defaultExpand(val) {
      if (!val)
        return false;
      const cols = {};
      let cellCnt = 0;
      for (const k of Object.keys(val.children)) {
        const v = val.children[k];
        if (v && !v.isLeaf()) {
          for (const ck of Object.keys(v.children)) {
            cols[ck] = null;
            cellCnt++;
          }
        }
      }
      const totalCell = Object.keys(cols).length * Object.keys(val.children).length;
      return cellCnt * 4 > totalCell;  // Fill ratio > 1/4
    },
    nodeClicked(data) { this.tstate.select(data); },
    queryData() {
      const opt = this.tableOpt;
      opt.data = DataFilter.filter(opt.columns, opt.rawData, opt.query);
      opt.total = opt.rawData.length;
    },
  },
  watch: {
    query: {
      deep: true,
      handler() { this.queryData(); },
    },
    isExpanded() { this.rebuildTable(this.selected); },
    tableData: {  // Can't use computed as change state of computed won't work
      immediate: true,
      handler(tableData) {
        this.tstate = tableData && tableData.constructor.name === 'TreeState' ? tableData : new TreeState(tableData);
      },
    },
    selected: {
      immediate: true,
      handler(val) {
        this.isExpanded = this.defaultExpand(val);
        this.tableOpt.query.offset = 0;
        this.rebuildTable(val);
      },
    },
    options() { this.rebuildTable(this.selected); },
  },
  computed: {
    selected() { return this.tstate && this.tstate.selected; },
    applyCustomOpts() { return this.tstate.isInitialNodeSelected() && this.isExpanded && this.options; },
    query() { return this.tableOpt.query; },
  },
};
</script>

<style>
.jsontable-min {
  width:1%;
}
</style>
