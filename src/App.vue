<template>

  <div id='app' class='components-container'>
    <json-tree-table :data='sampleJSON' />
  </div>
</template>

<script>
import JsonTreeTable from './components/JsonTreeTable.vue';

export default {
  name: 'app',
  components: {
    JsonTreeTable,
  },
  data() {
    return {
      sampleJSON: {
        testArray: ['Just a Test String', 'in a Test Array', 0, 1, true, false],
        component: 'vue-json-tree-view',
        descripton: 'A JSON Tree View built in Vue.js',
        tags: [{ name: 'vue.js' }, { name: 'JSON' }],
        steps: ['HTML Template', 'Root Component', 'View Component', {
          'Transformation Logic': ['Transform Objects', 'Transform Arrays', 'Transform Values'] },
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
html {
  height: 100%;
}
body {
  min-height: 100%;
}
</style>
