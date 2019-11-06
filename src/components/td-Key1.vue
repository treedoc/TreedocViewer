<template>
  <div>
    <div v-if="row['@value'].isObject()" class="jtt_key">
      <a href="#/" @click.stop="nodeClicked(row['@value'])">{{this.value}}</a>
    </div>
    <div v-else class="jtt_key">{{this.value}}</div>
  </div>
</template>
<script lang='js'>
import { TreeNode } from '../models/Tree';
import Vue from 'vue';

// For some reason, DataTable doesn't support typescript class based dynamic component or Vue.extend({}) component
export default {
  props: ['value', 'row', 'xprops'],
  methods: {
    nodeClicked(data) { this.xprops.tstate.select(data); },
  },
};
</script>
<style scoped>
.jtt_key  {
  white-space: nowrap;
}
</style>