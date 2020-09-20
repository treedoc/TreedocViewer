<template>
  <div>
    <div v-if="isObject" class="tdv_key">
      <a href="#/" @click.stop="nodeClicked(row['@value'])">{{value}}</a>
    </div>
    <div v-else class="tdv_key">{{value}}</div>
  </div>
</template>
<script lang='js'>
import Vue from 'vue';
import { TDNodeType } from 'treedoc';

// For some reason, DataTable doesn't support typescript class based dynamic component or Vue.extend({}) component
export default {
  props: ['value', 'row', 'xprops'],
  methods: {
    nodeClicked(data) { this.xprops.tstate.select(data); },
  },
  computed: {
    isObject() {
      return this.row['@value'].type !== TDNodeType.SIMPLE;
    },
  },
};
</script>
<style scoped>
.tdv_key {
  white-space: nowrap;
  font-weight: bolder;
}
</style>