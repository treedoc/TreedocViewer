<template>
  <div>
    <datatable v-bind="$data">
      <div style="display: flex">
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='isExpanded'>Expanded</b-btn> &nbsp;
        <b-button-group class="mx-1" style="">
          <b-btn :size="'sm'" @click='tstate.back()' :disabled='!tstate.canBack()'>Back</b-btn>
          <b-btn :size="'sm'" @click='tstate.forward()' :disabled='!tstate.canForward()'>Forward</b-btn>
        </b-button-group>
        <json-path :tree-node="selected" v-on:nodeClicked='nodeClicked' />
      </div>
    </datatable>
  </div>
</template>

<script>
import _ from 'lodash';
import DataFilter from './DataFilter';
import thFilter from './th-Filter.vue';
import tdValue from './td-Value.vue';
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
      pageSizeOptions: [20, 100, 1000],
      columns: [],
      data: [],
      rawData: [],
      total: 0,
      query: { limit: 1000 },
      isExpanded: false,
      xprops: { tstate: this.tstate },
    };
  },
  methods: {
    addColumn(field, idx = this.columns.length) {
      if (this.columns.some(c => c.field === field))
        return;

      const tdClass = idx === 0 ? 'jsontable-min' : '';
      let col = {
        title: field,
        field,
        sortable: true,
        thComp: thFilter,
        tdComp: tdValue,
        thClass: tdClass,
        tdClass,
      };
      if (this.tstate.isInitialNodeSelected() && idx > 0 && this.options && this.options.columns)
        col = this.applyColOption(col);

      this.columns.splice(idx, 0, col);
    },
    applyColOption(col) {
      const optCol = _.find(this.options.columns, { field: col.field });
      col.visible = !!optCol;
      if (optCol)
        col = { ...col, ...optCol };
      return col;
    },
    rebuildTable(val) {
      this.columns = [];
      this.rawData = [];
      this.buildTable(val);
      this.data = this.rawData;
      this.total = this.rawData.length;
    },
    buildTable(val) {
      if (!val)
        return;
      const keyCol = val.isObject() ? COL_KEY : COL_NO;
      this.addColumn(keyCol);
      for (const k of Object.keys(val.children)) {
        const v = val.children[k];
        const row = { [keyCol]: k };
        this.rawData.push(row);
        if (this.isExpanded && v && !v.isLeaf()) {
          for (const ck of Object.keys(v.children)) {
            this.addColumn(ck);
            row[ck] = v.children[ck];
          }
        } else {
          this.addColumn(COL_VALUE, 1);
          row[COL_VALUE] = v;
        }
      }
    },
    needExpand(val) {
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
  },
  watch: {
    selected: {
      immediate: true,
      handler(val) {
        this.isExpanded = this.needExpand(val);
        this.rebuildTable(val);
      },
    },
    query: {
      deep: true,
      handler(val) { this.data = DataFilter.filter(this.columns, this.rawData, val); },
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
