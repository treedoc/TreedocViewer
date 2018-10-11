<template>

  <div id='app' class='components-container'>
    <b-form-select v-model="selected" :options="jsonTypeNames" class="mb-3" />

    <json-tree-table v-if="selected" :data='jsonTypes[selected]' />
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
      jsonTypeNames: ['sampleJSON', 'sampleArray', 'jsonStr'],
      selected: 'sampleJSON',
      jsonTypes: {
        jsonStr: `
        {
          refundAmtMoney:"USD 15.32",
          activityHistory:[
          {
            $type:"ActivityHist",
            creationDate:"2014/10/02 10:20:37",
            lastModifiedDate:"2014/10/02 10:20:37",
            runtimeContext:"t=118",
            partitionKey:0,
            activityType:"1-buyerCreateCancel",
            CancelRequestId:5000001470,
            ActivityHistId:5000007162,
            fromState:"0-initial",
            toState:"4-approvalPending",
            actionDate:"2014/10/02 10:20:35",
            actorId:0,
            actorType:"2-buyer",
            $hash:"70f48ae6"
          },
          {
            $type:"ActivityHistBoImpl",
            creationDate:"2014/10/02 11:15:13",
            lastModifiedDate:"2014/10/02 11:15:13",
            runtimeContext:"m=t=148",
            partitionKey:0,
            activityType:"6-sellerApprove",
            CancelRequestId:5000001470,
            ActivityHistId:5000007163,
            fromState:"4-approvalPending",
            toState:"1-refundPending",
            actionDate:"2014/10/02 11:15:11",
            actorId:0,
            actorType:"1-seller",
            $hash:"70f48ae7"
          }]
        }
        `,
        sampleJSON: {
          testArray: ['Just a Test String', 'in a Test Array', 0, 1, true, false],
          component: 'vue-json-tree-view',
          descripton: 'A JSON Tree View built in Vue.js',
          tags: [{ name: 'vue.js' }, { name: 'JSON' }],
          steps: [
            'HTML Template',
            'Root Component',
            'View Component',
            {
              'Transformation Logic': ['Transform Objects', 'Transform Arrays', 'Transform Values'],
            },
            'Animate',
            'Allow Options',
            'Blog about it...',
          ],
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
      },
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
