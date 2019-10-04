export default {
  jsonTypeNames: ['empty', 'object', 'array', 'jsonStr', 'jsonex', 'textproto', 'json5', 'hjson'],
  jsonTypes: {
    empty: {},
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
    object: {
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
    array: [
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
    textproto: `
    n: {
      n1: {
        n11: 1
        # Duplicated key; ':' is emitted before '{'
        n11 {
          n111: false
        }
        n12: "2"
      }
      # Multi-line comments
      # Line2
      ########
      n1: {
        n11: "abcd"
        #  Extension keys
        [d.e.f]: 4
        n11: "multiline 1\n"
        'line2'
      }
      n2: [1,2,3]
      n2 [3,4,5]  # ':' is emitted before '['
      "n3" [6, 7, 8, 9]
    }
    `,
    json5: `
    // https://spec.json5.org/
    {
      // comments
      unquoted: 'and you can quote me on that',
      singleQuotes: 'I can use "double quotes" here',
      lineBreaks: "Look, Mom! \
    No \\n's!",
      hexadecimal: 0xdecaf,
      leadingDecimalPoint: .8675309, andTrailing: 8675309.,
      positiveSign: +1,
      trailingComma: 'in objects', andIn: ['arrays',],
      "backwardsCompatible": "with JSON",
    }
    `,
    jsonex: `
    // Some comments
    {
      "total": 100000000000000000000,
      "longNum": 10000000000,
      "limit": 10,
    
      /* block comments */
      "data": [
        {
          "name": "Some Name 1",  // More line comments
          "address": {
            "streetLine": "1st st",
            city: "san jose",
          },
          "createdAt": "2017-07-14T17:17:33.010Z",
        },
        {
          "name": "Some Name 2",
          "address": /*comments*/ {
            "streetLine": "2nd st",
            city: "san jose",
          },
          "createdAt": "2017-07-14T17:17:33.010Z",
        },
        \`Multiple line literal
        Line2\`
      ],
    }    
    `,
    hjson: `
    {
      // use #, // or /**/ comments,
      // omit quotes for keys
      key: 1
      // omit quotes for strings
      contains: everything on this line
      // omit commas at the end of a line
      cool: {
        foo: 1
        bar: 2
      }
      // allow trailing commas
      list: [
        1,
        2,
      ]
      // and use multiline strings
      realist:
        '''
        My half empty glass,
        I will fill your empty half.
        Now you are half full.
        '''
    }
    `,
  },
};
