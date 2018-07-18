<template>

  <div id='app' class='components-container'>
    <multipane class="foo" layout="vertical" style='flex-grow:1;'>
      <div :style="{ width: '100px', maxWidth: '500px', 'min-height':'100%', 'max-height':'100%'}">
        <tree-view :data="sampleJSON" :options="{maxDepth: 2, rootObjectKey: 'The Test String'}"></tree-view>
      </div>
      <multipane-resizer/>
      <div :style="{ width: '25%', maxWidth: '50%' }">
        pane2
      </div>
      <multipane-resizer/>
      <div :style="{ flexGrow: 1 }">
        <!-- <div><json-table :tableData='sampleArray' /></div> -->
        <div><json-table :tableData='sampleJSON' /></div>
      </div>
    </multipane>
    <!-- <Split style="flex-grow: 1; display:flex;">
    <SplitArea :size="25">
        <tree-view :data="sampleJSON" :options="{maxDepth: 2, rootObjectKey: 'The Test String'}"></tree-view>
    </SplitArea>
    <SplitArea :size="75">
        panel right
    </SplitArea>
    </Split> -->
    <!-- <split-pane v-on:resize="resize" :min-percent='20' :default-percent='30' split="vertical">
      <template slot="paneL">
        <tree-view :data="sampleJSON" :options="{maxDepth: 2, rootObjectKey: 'The Test String'}"></tree-view>
      </template>
      <template slot="paneR">
        B
      </template>
    </split-pane> -->
  </div>
</template>

<script>
import { Multipane, MultipaneResizer } from 'vue-multipane';

import TreeView from './components/TreeView.vue';
import JsonTable from './components/JsonTable.vue';


export default {
  name: 'app',
  components: {
    Multipane,
    MultipaneResizer,
    TreeView,
    JsonTable,
  },
  data() {
    return {
      sampleJSON: {
        testArray: ['Just a Test String', 'in a Test Array', 0, 1, true, false],
        component: 'vue-json-tree-view',
        descripton: 'A JSON Tree View built in Vue.js',
        tags: [{ name: 'vue.js' }, { name: 'JSON' }],
        steps: ['HTML Template', 'Root Component', 'View Component', { 'Transformation Logic': ['Transform Objects', 'Transform Arrays', 'Transform Values'] },
          'Animate', 'Allow Options', 'Blog about it...'],
        obj: { key1: 'val1', key2: 'val2' },
      },
      sampleArray: [
        {
          col1: 'value11',
          col2: 'value12',
        },
        {
          col1: 'value21',
          col3: 'value23',
        },
        'value',
        {
          col1: 'value31',
          col2: 'value32',
          col3: 'value33',
        },
        [
          'abc',
          'def',
          { a: 1, b: 2 },
        ],
      ],
    };
  },
  methods: {
    resize() {
    },
  },
};
</script>

<style>
  .components-container {
    display: flex;
    position: absolute;
    flex-direction: column;
    min-height:100%;
    min-width:100%;
  }

.multipane.foo.layout-v .multipane-resizer {
  margin: 0; left: 0; /* reset default styling */
  width: 5px;
  height: unset;
  background: lightgray;
}

html {
  height: 100%;
}
body {
  min-height: 100%;
}
</style>
