<template>
  <div class='filter-header'>
    <b-button tabindex='0' variant='link' :id="filterBtnId" style='padding: 0px;'>
      <b class='jsontable-head' :class="{'has-keyword': query[field]}">{{ title }}</b>
      <!-- <i class="m-2 fa fa-filter" :class="{ 'text-muted': !keyword}" style='margin: 1px !important;'></i> -->
    </b-button>
    <b-popover :target="filterBtnId" triggers="click blur" placement='top' @show='onShowPopover'>
      <div class="input-group input-group-sm" >
        <input type="search" class="form-control" ref="input" @keydown.esc.prevent='close' 
          v-model="query[field]" @keydown.enter="close" :placeholder="`Search ${field}...`">
      </div>
    </b-popover>
  </div>
</template>
<script>
import Vue from 'vue';
import _ from 'lodash';

// For some reason, DataTable doesn't support typescript class based dynamic component or Vue.extend({}) component
export default {
  props: ['field', 'title', 'query'],
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
</style>
