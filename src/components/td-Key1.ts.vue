<template>
  <div>
    <div v-if="row['@value'].isObject()">
      <a href="#/" @click.stop="nodeClicked(row['@value'])">{{this.value11}}</a>
    </div>
    <div v-else>{{this.value}}</div>
  </div>
</template>
<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { TreeNode } from '../models/Tree';

@Component
export default class TdKey extends Vue {
  @Prop() value!: any;
  @Prop() row!: object;
  @Prop() xprops!: any;

  nodeClicked(data: TreeNode) { this.xprops.tstate.select(data); }
}
</script>
