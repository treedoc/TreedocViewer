<template>
  <div>
    <div v-if="strVal === null">
      <tree-view-item class='tree-view-item-root' :data='value' :max-depth='0' :current-depth='0' style="margin-left: 0!important;" v-on:nodeClicked='nodeClicked'></tree-view-item>
    </div>
    <div v-else>
      {{strVal}}
    </div>
  </div>
</template>
<script>
import TreeViewItem from './TreeViewItem.vue';

export default {
  components: {
    TreeViewItem,
  },
  props: ['value', 'xprops'],
  methods: {
    nodeClicked(data) {
      console.log(`node clicked: ${data}`);
      this.xprops.jsonTable.nodeClicked(data);
    },
  },
  computed: {
    strVal() {
      if (!this.value)
        return "";
      if (!this.value.isObject)
        return this.value;
      if (!this.value.isObject())
        return this.value.obj;
      return null;
    }
  }
};
</script>
<style>
</style>
