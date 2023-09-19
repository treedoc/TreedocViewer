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
          <div style="display: flex; flex-wrap: wrap; flex-direction: row; overflow:visible;">
            <div style="white-space: nowrap;"> <b>#</b> {{columnStatistic.total}}</div>
            <div style="padding-left: 0.2em; white-space: nowrap;"><b>#Uniq</b> {{columnStatistic.valueSortedByCounts.length}}</div>
            <div style="padding-left: 0.2em; white-space: nowrap;" v-if="columnStatistic.sum"> <b>sum</b> {{columnStatistic.sum | toFixed(2)}}</div>
            <div style="padding-left: 0.2em; white-space: nowrap;" v-if="columnStatistic.sum"> <b>Avg</b> {{columnStatistic.avg | toFixed(2)}}</div>
            <div style="padding-left: 0.2em; white-space: nowrap;" v-if="columnStatistic.sum"> <b>P50</b> {{columnStatistic.p50 | toFixed(2)}}</div>
            <div style="padding-left: 0.2em; white-space: nowrap;" v-if="columnStatistic.sum"> <b>P90</b> {{columnStatistic.p90 | toFixed(2)}}</div>
            <div style="padding-left: 0.2em; white-space: nowrap;" v-if="columnStatistic.sum"> <b>P99</b> {{columnStatistic.p99 | toFixed(2)}}</div>
            
            <div style="padding-left: 0.2em; white-space: nowrap;" v-if="columnStatistic.sum"> <b>Min</b> {{columnStatistic.min}}</div>
            <div style="padding-left: 0.2em; white-space: nowrap;" v-if="columnStatistic.sum"> <b>Max</b> {{columnStatistic.max}}</div>
          </div>
          <div><b>Top Values</b></div>
          <div>
            <div v-for="val in columnStatistic.valueSortedByCounts.slice(0, 30)" style="height: 20px; font-size: small;">
              <div style="display: flex; flex-direction: row; overflow:visible;">
                <div style="flex-grow: 1;" class="text-container">{{ val  | textLimit(200) }}</div>
                <div style="flex-grow: 0; background-color: white; min-width: 2rem; text-align: right; color: blue;">{{ columnStatistic.valueCounts[val]}}</div>
                <div style="flex-grow: 0; background-color: white; min-width: 2.7rem; text-align: right;color: green;">{{ Math.round(columnStatistic.valueCounts[val] * 1000 / columnStatistic.total) / 10}}%</div>
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

.text-container {

    white-space: nowrap;
    overflow: hidden;
    opacity: 0.9;
    background-color: white;
    text-overflow: ellipsis;
}

.text-container:hover {
    overflow: visible;
    width: 100em;
    white-space: nowrap;
}
</style>
