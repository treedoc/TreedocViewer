<template>
  <div class='filter-header'>
    <b-button tabindex='0' variant='link' :id="filterBtnId" style='padding: 0px;'>
      <b class='jsontable-head' :class="{'has-keyword': query[field]}">{{ title }}</b>
      <!-- <i class="m-2 fa fa-filter" :class="{ 'text-muted': !keyword}" style='margin: 1px !important;'></i> -->
    </b-button>
    <b-popover :target="filterBtnId" triggers="focus hover" placement='top' fallback-placement='clockwise'  @show='onShowPopover' boundary='viewport' delay='300' :no-fade='true' boundary-padding='0'>
      <div class="input-group input-group-sm" >
        <b-form-input type="search" class="form-control" ref="input" @keydown.esc.prevent='close' 
          v-model="query[field]" @keydown.enter="close" :placeholder="`Search ${field}...`" debounce="300" />
          <b-button size='sm' class="border-0" variant='light' v-b-toggle:my-collapse>
            <span class="when-open"><b>&vellip;</b></span><span class="when-closed">&vellip;</span>
          </b-button>

      </div>
      <div>
        <b-collapse id="my-collapse" style="font-size: small;">
          <div>
            # <b-badge variant="info">{{columnStatistic.total}}</b-badge>
            #Uniq <b-badge variant="info">{{columnStatistic.valueSortedByCounts.length}}</b-badge>
            sum <b-badge variant="info">{{columnStatistic.sum}}</b-badge>
            Avg <b-badge variant="info">{{columnStatistic.avg.toPrecision(5)}}</b-badge>
          </div>
          <div>Min <b-badge variant="info">{{columnStatistic.min | textLimit(30)}}</b-badge></div>
          <div>Max <b-badge variant="info">{{columnStatistic.max | textLimit(30)}}</b-badge></div>
          <div>Top Values</div>
          <div>
            <div v-for="val in columnStatistic.valueSortedByCounts.slice(0, 30)" style="height: 20px; font-size: small;">
              <div style="display: flex; flex-direction: row;">
                <div style="flex-grow: 1;">{{ val  | textLimit(20) }}</div>
                <div style="flex-grow: 0;color: blue;">{{ columnStatistic.valueCounts[val]}}</div>
                <div style="flex-grow: 0; width: 3rem;text-align: right;color: green;">{{ Math.round(columnStatistic.valueCounts[val] * 1000 / columnStatistic.total) / 10}}%</div>
              </div>
              <progress style="position: relative; top: -0.9em; height: 0.4rem; width: 100%;" :value="columnStatistic.valueCounts[val]" :max="columnStatistic.total"></progress>
            </div>
        </div>
        </b-collapse>
      </div>      
      <!-- {{ xprops.tstate }} -->
    </b-popover>
  </div>
</template>
<script>
import Vue from 'vue';
import _ from 'lodash';

// For some reason, DataTable doesn't support typescript class based dynamic component or Vue.extend({}) component
export default {
  props: ['field', 'title', 'query', 'xprops'],
  methods: {
    onShowPopover() {
      Vue.nextTick(() => this.$refs.input.focus({ preventScroll: true }));
    },
    close() {
      this.$root.$emit('bv::hide::popover');
    },
  },
  computed: {
    filterBtnId() {
      return `filterbtn-${this.field}`;
    },
    columnStatistic() {
      return this.xprops.columnStatistic[this.field];
    },
  },
};
</script>
<style>
.filter-header {
  display: inline;
}

input[type=search]::-webkit-search-cancel-button {
  -webkit-appearance: searchfield-cancel-button;
  cursor: pointer;
}

.has-keyword {
  color: green;
}
.jsontable-head {
  font-size: 1rem;
}
.collapsed > .when-open,
.not-collapsed > .when-closed {
  display: none;
}
</style>
