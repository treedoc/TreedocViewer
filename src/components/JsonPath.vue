<template>
  <ol class="breadcrumb">
    <template v-if="items">
      <li v-for="item in items" v-bind:key='item.text' :class="['breadcrumb-item', item.active ? 'active' : null]">
        <span v-if="item.active" v-html="item.text"></span>
        <b-link v-else :to="item.to||item.href||item.link" v-html="item.text" @click="onclick(item)"></b-link>
      </li>
    </template>
    <slot></slot>
  </ol>
  <!-- <b-breadcrumb :items="items" @click="onClick" /> -->
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { TreeNode } from '../models/Tree';

interface Item {
  text: string;
  active?: boolean;
  href?: string;
  node?: TreeNode;
}

@Component
export default class JsonPath extends Vue {
  @Prop() private treeNode!: TreeNode;

  onclick(item: Item) {
    this.$emit('nodeClicked', item.node);
  }

  get items() {
    const paths = new Array<Item>();
    if (!this.treeNode)
      return null;

    paths.unshift({ text: this.treeNode.key, active: true });
    for (let pNode = this.treeNode.parent; pNode !== null; pNode = pNode.parent) {
      paths.unshift({ text: pNode.key, href: '', node: pNode });
    }
    return paths;
  }
}
</script>
<style>
  .breadcrumb {
    margin-bottom: auto;
    padding: 0.3em;
  }
</style>
