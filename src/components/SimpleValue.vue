<template>
  <span class='value'>
    <template v-if='ref'>
      <a href="#" @click.stop="$emit('node-clicked', refAbsolute)">{{ref}}</a>
    </template>
    <template v-else-if="url">
      <a :href='url' target="_blank">{{url}}</a>
    </template>
    <template v-else-if="isInTable">
      <pre class='tdv-value' :class="valueStyle" :style="{'white-space': whiteSpaceStyle}">{{tnode.value}} <span class='tdv-hint'>{{date}}</span></pre>
    </template>
    <template v-else><span :class="valueStyle">{{tnode.value}}</span> <span class='tdv-hint'>{{date}}</span></template>
  </span>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { TDNode } from 'treedoc';
import TreeState from '../models/TreeState';
import TreeUtil from '../models/TreeUtil';
import _ from 'lodash';

// number and between 1980-01-01 and 2040-01-01, maybe a Date
const START_TIME = new Date('1980-01-01').getTime();
const END_TIME = new Date('2040-01-01').getTime();

function tryDate(val: number): Date | null{
  if (val > START_TIME && val < END_TIME) {
    return new Date(val);
  }
  return null;
}

@Component
export default class SimpleValue extends Vue {
  @Prop() tnode!: TDNode;
  @Prop({required: false, default: false}) isInTable!: boolean;
  @Prop({required: false, default: false}) textWrap!: boolean;

  get ref() {
    if (this.tnode.key !== TreeUtil.KEY_REF || typeof(this.tnode.value) !== 'string')
      return null;
    return this.tnode.value;
  }

  get date() {
    const val = Number(this.tnode.value);
    if (!_.isNumber(val)) return null;
    const date = tryDate(val) || tryDate(val * 1000) || tryDate(val / 1000_000);
    return date ? `\n${date.toISOString()}` : null;
  }

  get refAbsolute() {
    let result = this.ref;
    if (result && result.startsWith('../'))
      result = this.tnode.parent!.pathAsString + '/' + result;
    return result;
  }

  get url() {
    const val = this.tnode.value;
    if (typeof(val) === 'string' && (val.startsWith('http://') || val.startsWith('https://')))
      return val;
  }

  get valueStyle() { return typeof(this.tnode.value) === 'string' ? 'string' : 'number'; }

  get whiteSpaceStyle() { return this.textWrap ? 'pre-wrap' : 'pre'; }
}
</script>
<style>
pre.tdv-value {
  margin-bottom: 1px;
  overflow-wrap: anywhere;
}

.number {
  color: #164;
}

.string {
  color: #a11;
}

</style>