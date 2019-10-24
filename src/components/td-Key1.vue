<template>
  <div>
    <div v-if="row['@value'].isObject()">
      <a href="#/" @click.stop="nodeClicked(row['@value'])">{{this.value}}</a>
    </div>
    <div v-else>{{this.value}}</div>
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
