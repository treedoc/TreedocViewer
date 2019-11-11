<template>
  <b-button-group class="ml-1">
    <b-btn :size="'sm'" @click='collapseAll()' :disabled='!canCollapse()' title="collapse all">
      &laquo;
    </b-btn>
    <b-btn :size="'sm'" @click='collapse()' :disabled='!canCollapse()' title="collapse one level">
      &lsaquo;
    </b-btn>
    <b-btn :size="'sm'" :disabled="true" class="expand_level" v-b-tooltip.hover title="Current expand level">{{state.expandLevel}}</b-btn>
    <b-btn :size="'sm'" @click='expend()' :disabled='!canExpand()' title="expand one level">
      &rsaquo;
    </b-btn>
    <b-btn :size="'sm'" @click='expendAll()' :disabled='!canExpand()' title="expand all">
      &raquo;
    </b-btn>
  </b-button-group>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { TreeNode } from '../models/Tree';

export class ExpandState {
  fullyExpand = false;
  moreLevel = false;

  constructor(
    public expandLevel = 1,
    public minLevel = 1,
  ) {}
}

@Component
export default class ExpandControl extends Vue {
  @Prop() state!: ExpandState;

  collapse() {
    if (this.state.expandLevel > this.state.minLevel)
      this.state.expandLevel--;
    this.state.fullyExpand = false;
  }

  collapseAll() {
    this.state.expandLevel = this.state.minLevel;
    this.state.fullyExpand = false;
  }

  canCollapse() {
    return this.state.expandLevel > this.state.minLevel || this.state.fullyExpand;
  }

  expend() {
    this.state.moreLevel = false;
    this.state.expandLevel++;
  }

  expendAll() {
    this.state.moreLevel = false;
    this.state.fullyExpand = true;
  }

  canExpand() {
    return this.state.moreLevel;
  }
}
</script>
<style scoped>
.expand_level {
  width: 16px;
  padding-left: 0px;
  padding-right: 0px;
  text-align: center;
}
</style>
