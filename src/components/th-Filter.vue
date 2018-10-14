<template>
    <div class='filter-header'>
    {{ title }}
      <b-button tabindex='0' size='sm' variant='link' :id="filterBtnId" style='padding: 0px;'>
        <i class="m-2 fa fa-filter" :class="{ 'text-muted': !keyword}" style='margin: 1px !important;'></i>
      </b-button>
      <b-popover :target="filterBtnId" triggers="click blur" placement='bottom' @show='onShowPopover'>
        <div class="input-group input-group-sm" >
          <input type="search" class="form-control" ref="input"
            v-model="keyword" @keydown.enter="search" :placeholder="`Search ${field}...`">
            <span class="input-group-btn">
              <button class="btn btn-default fa fa-search" @click="search"></button>
            </span>
        </div>
      </b-popover>
    </div>
</template>
<script>
import Vue from 'vue';

export default {
  props: ['field', 'title', 'query'],
  data: () => ({
    keyword: '',
  }),
  watch: {
    keyword(kw) {
      // reset immediately if empty
      if (kw === '') this.search();
    },
  },
  methods: {
    search() {
      const { query } = this;
      // `$props.query` would be initialized to `{ limit: 10, offset: 0, sort: '', order: '' }` by default
      // custom query conditions must be set to observable by using `Vue.set / $vm.$set`
      this.$set(query, this.field, this.keyword);
      query.offset = 0; // reset pagination
      this.$root.$emit('bv::hide::popover');
    },
    onShowPopover() {
      Vue.nextTick(() => this.$refs.input.focus({ preventScroll: true }));
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
  white-space: nowrap;
}


input[type=search]::-webkit-search-cancel-button {
  -webkit-appearance: searchfield-cancel-button;
  cursor: pointer;
}
</style>
