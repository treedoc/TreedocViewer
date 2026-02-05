export const jsonStr = `
{
  refundAmtMoney:"USD 15.32",
  activityHistory:[
  {
    $type:"ActivityHist",
    $id:1234,
    creationDate:"2014/10/02 10:20:37",
    lastModifiedDate:"2014/10/02 10:20:37",
    timeStamp: 1599461650448,
    runtimeContext:"t=118",
    partitionKey:0,
    activityType:"1-buyerCreateCancel",
    log:"http://www.google.com",
  },
  {
    $type:"ActivityHistBoImpl",
    creationDate:"2014/10/02 11:15:13",
    lastModifiedDate:"2014/10/02 11:15:13",
    timeStamp: 1599481650448,
    runtimeContext:"m=t=148\\nline2",
    partitionKey:0,
    activityType:"6-sellerApprove",
  }],
  current: {
    $ref: '#/activityHistory/1',
  },
  first: {
    $ref: '#1234',
  },
}`

export const yamlStr = `
-  martin:
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
`

export const xmlStr = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.jsonex</groupId>
  <artifactId>jcParent</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>JSONCoder Parent</name>
  <developers>
    <developer>
      <id>jianwu</id>
      <name>Jianwu Chen</name>
      <roles>
        <role>architect</role>
        <role>developer</role>
      </roles>
    </developer>
  </developers>
</project>`

export const csvStr = `
field1,field2,field3
v11,v12,v13
v21, "v2l1
V2l2" ,v23
"v31""v31","v32""""v32",v33
`

export interface SampleDataItem {
  text: string
  value: string | object
}

export const sampleData: SampleDataItem[] = [
  { text: 'Empty', value: {} },
  { text: 'JSON/JSONEX', value: jsonStr },
  {
    text: 'Object',
    value: {
      testArray: ['Just a Test String', 'in a Test Array', 0, 1, true, false],
      component: 'vue-json-tree-view',
      description: 'A JSON Tree View built in Vue.js',
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
    text: 'Array',
    value: [
      { col1: 'value11', col2: 'value12' },
      { col1: 'value21', col3: 'value23' },
      'value',
      { col1: 'value31', col2: 'value32', col3: 'value33' },
      ['abc', 'def', { a: 1, b: 2 }],
    ],
  },
  {
    text: 'JSON5',
    value: `// https://spec.json5.org/
{
  // comments
  unquoted: 'and you can quote me on that',
  singleQuotes: 'I can use "double quotes" here',
  hexadecimal: 0xdecaf,
  leadingDecimalPoint: .8675309, andTrailing: 8675309.,
  positiveSign: +1,
  trailingComma: 'in objects', andIn: ['arrays',],
  "backwardsCompatible": "with JSON",
}`,
  },
  { text: 'YAML', value: yamlStr },
  { text: 'XML', value: xmlStr },
  { text: 'CSV', value: csvStr },
  { text: 'Map.toString', value: '{K1=v1, k2=123, k3={c=Test with ,in}, k4=[ab,c, def]}' },
  {
    text: 'Lombok.toString',
    value: "TestBean(treeMap={key1=value1}, linkedList1=[value1], intField=100, floatField=1.4)",
  },
]

export default sampleData
