<template functional>
  <div>h
    <tree-view-item v-if="props.value && props.value.isObject()"  class='tree-view-item-root' :data='props.value' :max-depth='0' :current-depth='0' style="margin-left: 0!important;"></tree-view-item>
    <div v-else>{{props.value && props.value.obj}}</div>
        <!-- <div v-if="html()" v-html="html()"/>
    <div v-else-if="strVal() === null">
      <tree-view-item class='tree-view-item-root' :data='props.value' :max-depth='0' :current-depth='0' style="margin-left: 0!important;" v-on:nodeClicked='nodeClicked'></tree-view-item>
    </div>
    <div v-else>
      {{strVal()}}
    </div> -->
  </div>
</template>
<script>
import _ from 'lodash';
import TreeViewItem from './TreeViewItem.vue';

export default {
  nodeClicked(data) {
    console.log(`node clicked: ${data}`);
    props.xprops.tstate.select(data);
  },
  strVal() {
    if (!props.value)
      return '';
    if (!props.value.isObject())
      return props.value.obj;
    return null;
  },
  html() {
    const col = _.find(props.columns, { field: props.field });
    return col && col.html && col.html(props.value, props.row);
  },
};
</script>
<style>
</style>
