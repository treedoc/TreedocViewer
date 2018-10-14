<template>
  <div>
    <datatable v-bind="$data">
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

const COL_VALUE = '@value';
const COL_NO = '#';
const COL_KEY = '@key';

export default {
  name: 'json-table',
  props: {
    tstate: TreeState,
    options: Object,  // columns:Object: similar as the one defined in Vue2DataTable, exception field is the key
  },
  components: { thFilter, JsonPath },
  data() {
    return {
      tblClass: 'table-bordered',
      pageSizeOptions: [20, 50, 100, 200],
      columns: [],
      data: [],
      rawData: [],
      total: 0,
      query: { limit: 100 },
      isExpanded: false,
      xprops: { tstate: this.tstate },
    };
  },
  methods: {
    /** @param {TreeNode} val */
    rebuildTable(val) {
      this.columns = [];
      this.rawData = [];
      this.buildTable(val);
      this.queryData();
      this.total = this.rawData.length;
    },
    /** @param {TreeNode} val */
    buildTable(val) {
      if (!val)
        return;
      const ia = val.isArray();
      const keyCol = ia ? COL_NO : COL_KEY;
      this.addColumn(keyCol);
      for (const k of Object.keys(val.children)) {
        const v = val.children[k];
        const row = {
          [keyCol]: ia ? Number(k) : k,
          [COL_VALUE]: v,
        };
        this.rawData.push(row);
        if (this.isExpanded && v && !v.isLeaf()) {
          for (const ck of Object.keys(v.children)) {
            this.addColumn(ck);
            row[ck] = v.children[ck];
          }
        } else {
          this.addColumn(COL_VALUE, 1);
        }
      }
      if (this.tstate.isInitialNodeSelected() && this.options && this.options.columns)
        this.applyColOption();
    },
    addColumn(field, idx = this.columns.length) {
      if (this.columns.some(c => c.field === field))
        return;
      const isKeyCol = idx === 0;
      const col = {
        title: field,
        field,
        sortable: true,
        thComp: thFilter,
        tdComp: isKeyCol ? tdKey : tdValue,
      };
      if (isKeyCol) {
        col.thClass = 'jsontable-min';
        col.tdClass = 'jsontable-min';
      } else {
        col.tdComp = tdValue;
      }

      this.columns.splice(idx, 0, col);
    },
    applyColOption() {
      const cols = [];
      while (this.columns.length > 0 && this.isSpecialCol(this.columns[0].field)) {
        [cols[cols.length]] = this.columns;
        this.columns.shift();
      }
      for (const cOpt of this.options.columns) {
        const i = this.columns.findIndex(c => c.field === cOpt.field);
        if (i < 0)
          continue;
        const col = { ...this.columns[i], ...{ visible: true }, ...cOpt };
        cols[cols.length] = col;
        this.columns.splice(i, 1);
      }
      for (const c of this.columns) {
        c.visible = false;
        cols[cols.length] = c;
      }
      this.columns = cols;
    },
    isSpecialCol(col) { return col === COL_VALUE || col === COL_KEY || col === COL_NO; },
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
      this.data = DataFilter.filter(this.columns, this.rawData, this.query);
    },
  },
  watch: {
    selected: {
      immediate: true,
      handler(val) {
        this.isExpanded = this.defaultExpand(val);
        this.rebuildTable(val);
      },
    },
    query: {
      deep: true,
      handler() { this.queryData(); },
    },
    isExpanded() { this.rebuildTable(this.selected); },
    tstate() { this.xprops = { tstate: this.tstate }; },
    options() { this.rebuildTable(this.selected); },
  },
  computed: {
    selected() { return this.tstate && this.tstate.selected; },
  },
};
</script>

<style>
.jsontable-min {
  width:1%;
}
</style>
