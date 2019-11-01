<template>
  <b-button-group class="ml-1">
    <b-btn :size="'sm'" @click='collapseAll()' :disabled='!canCollapse()' title="back">
      &laquo;
    </b-btn>
    <b-btn :size="'sm'" @click='collapse()' :disabled='!canCollapse()' title="back">
      &lsaquo;
    </b-btn>
    <b-btn :size="'sm'" :disabled="true" class="expand_level">{{state.expandLevel}}</b-btn>
    <b-btn :size="'sm'" @click='expend()' :disabled='!canExpand()' title="forward">
      &rsaquo;
    </b-btn>
    <b-btn :size="'sm'" @click='expendAll()' :disabled='!canExpand()' title="forward">
      &raquo;
    </b-btn>
  </b-button-group>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

export class ExpandState {
  fullyExpand = false;
  moreLevel = false;

  constructor(
    public expandLevel = 1,
    public minLevel = 1,
    ) {

  }
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
  width: 12px;
  padding-left: 0px;
  padding-right: 0px;
  text-align: center;
}
</style>
