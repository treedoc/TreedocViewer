const jsonStr = `
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
}`;



export default {
  jsonStr,
  data: [
    {text: 'emtpy', value: {}},
    {
      text: 'jsonStr',
      value: jsonStr,
    },
    {
      text: 'object',
      value: {
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
    },
    {
      text: 'array',
      value: [
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
    {
      text: 'textproto',
      value:
`n: {
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
  escapeStr: "a\\tb\\nc\\vd\\u0020e\\vf",
  htmlStr: "<a href=test>\nThis is a link\n</a>"
  n2: [1,2,3]
  n2 [3,4,5]  # ':' is emitted before '['
  "n3" [6, 7, 8, 9]
}`,
    },
    {
      text: 'json5',
      value:
`// https://spec.json5.org/
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
    },
    {
      text: 'jsonex',
      value:
`// Some comments
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
    },
    {
      text: 'hjson',
      value:
`{
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
    {
      text: 'yaml',
      value:
`-  martin:
    name: Martin D'vloper
    job: Developer
    skills:
      - python
      - perl
      - pascal
-  tabitha:
    name: Tabitha Bitumen
    job: Developer
    skills:
      - lisp
      - fortran
      - erlang
`,
    },
    {
      text: 'xml',
      value:
`<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/maven-v4_0_0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.jsonex</groupId>
  <artifactId>jcParent</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <packaging>pom</packaging>
  <name>JSONCoder Parent</name>
  <description>JSONCoder Parent</description>
  <url>https://github.com/eBay/jsonex.git</url>

  <developers>
    <developer>
      <id>jianwu</id>
      <name>Jianwu Chen</name>
      <email>jianchen@ebay.com</email>
      <organization>eBay</organization>
      <organizationUrl>http://www.ebay.com</organizationUrl>
      <roles>
        <role>architect</role>
        <role>developer</role>
      </roles>
      <timezone>America/San_Francisco</timezone>
    </developer>
  </developers>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>\${project.groupId}</groupId>
        <artifactId>core</artifactId>
        <version>\${project.version}</version>
      </dependency>
      <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>1.18.8</version>
        <scope>provided</scope>
      </dependency>
      <dependency>
        <groupId>junit</groupId>
        <artifactId>junit</artifactId>
        <scope>test</scope>
        <version>4.8.1</version>
      </dependency>
    </dependencies>
  </dependencyManagement>
</project>
`,
    },
  ] as Array<{text: string, value: any}>,
};
