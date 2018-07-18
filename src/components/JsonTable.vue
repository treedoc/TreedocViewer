<template>
  <div>
    <code>query: {{ query }}</code>
    <datatable v-bind="$data"></datatable>
  </div>
</template>

<script>
import _ from 'lodash';
import DataFilter from './DataFilter';
import thFilter from './th-Filter.vue';

const COL_VALUE = '@value';
const COL_NO = '#';
const COL_KEY = '@key';

export default {
  name: 'json-table',
  props: ['tableData', 'options'],
  components: { thFilter },
  data() {
    return {
      tblClass: 'table-bordered',
      pageSizeOptions: [20, 100, 1000],
      columns: [],
      data: [],
      rawData: [],
      total: 0,
      query: { limit: 1000 },
    };
  },
  methods: {
    addColumn(field, idx = this.columns.length) {
      if (this.columns.some(c => c.field === field))
        return;

      this.columns.splice(idx, 0, {
        title: field,
        field,
        sortable: true,
        thComp: thFilter,
      });
    },

    buildForArray(val) {
      this.addColumn(COL_NO);
      for (const e of val) {
        const row = { [COL_NO]: this.rawData.length };
        this.rawData.push(row);
        if (e && _.isObject(e)) {
          for (const k of Object.keys(e)) {
            this.addColumn(k);
            row[k] = e[k];
          }
        } else {
          this.addColumn(COL_VALUE, 1);
          row[COL_VALUE] = e;
        }
      }
    },
    buildForObject(val) {
      this.addColumn(COL_KEY);
      for (const k of Object.keys(val)) {
        const row = { [COL_KEY]: k };
        this.rawData.push(row);
        const v = val[k];
        if (v && _.isObject(v)) {
          for (const ck of Object.keys(v)) {
            this.addColumn(ck);
            row[ck] = v[ck];
          }
        } else {
          this.addColumn(COL_VALUE, 1);
          row[COL_VALUE] = v;
        }
      }
    },
  },
  watch: {
    tableData: {
      immediate: true,
      handler(val) {
        this.columns = [];
        this.rawData = [];
        if (_.isArray(val)) {
          this.buildForArray(val);
        } else if (_.isObject(val)) {
          this.buildForObject(val);
        }
        this.total = this.rawData.length;
      },
    },
    query: {
      deep: true,
      handler(val) {
        this.data = DataFilter.filter(this.columns, this.rawData, val);
      },
    },
  },
};
</script>

<style scoped>

</style>
