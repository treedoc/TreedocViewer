<template>
  <div>
    <div v-if="row['@value'].isObject()">
      <a href="#" @click.stop="nodeClicked(row['@value'])">{{this.value}}</a>
    </div>
    <div v-else>{{this.value}}</div>
  </div>
</template>
<script>
export default {
  props: ['value', 'row', 'xprops'],
  methods: {
    nodeClicked(data) { this.xprops.tstate.select(data); },
  },
};
</script>
