<template>
  <b-button-group class="ml-1">
    <b-btn :size="'sm'" @click='collapseAll()' :disabled='!canCollapse()' title="back">
      <i class="fa fa-angle-double-up"></i>
    </b-btn>
    <b-btn :size="'sm'" @click='collapse()' :disabled='!canCollapse()' title="back">
      <i class="fa fa-angle-up"></i>
    </b-btn>
    <b-btn :size="'sm'" @click='expend()' :disabled='!canExpand()' title="forward">
      <i class="fa fa-angle-down"></i>
    </b-btn>
    <b-btn :size="'sm'" @click='expendAll()' :disabled='!canExpand()' title="forward">
      <i class="fa fa-angle-double-down"></i>
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
    public minLevel = 1
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
