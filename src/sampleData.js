export default {
  jsonTypeNames: ['sampleJSON', 'sampleArray', 'jsonStr'],
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
      },
      {
        $type:"ActivityHistBoImpl",
        creationDate:"2014/10/02 11:15:13",
        lastModifiedDate:"2014/10/02 11:15:13",
        runtimeContext:"m=t=148",
        partitionKey:0,
        activityType:"6-sellerApprove",
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

