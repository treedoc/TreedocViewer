const jsonStr = `
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
    runtimeContext:"m=t=148\nline2",
    partitionKey:0,
    activityType:"6-sellerApprove",
  }],
  current: {
    $ref: '#/activityHistory/1',
  },
  first: {
    $ref: '#1234',
  },
}`;

const yamlStr = `
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
`;

const yamlMultiDocStr = 
`document: 1
name: 'John'
---
document: 2
name: 'config'
`;

const xmlStr = `<?xml version="1.0" encoding="UTF-8"?>
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
`;

const fxml = `
<?xml version="1.0" encoding="UTF-8"?>
<?import javafx.geometry.Insets?>
<GridPane hgap="8.0" vgap="8.0" xmlns="http://javafx.com/javafx/11.0.1" xmlns:fx="http://javafx.com/fxml/1" fx:controller="MainController">
  <columnConstraints>
    <ColumnConstraints hgrow="SOMETIMES" minWidth="10.0" />
  </columnConstraints>
  <rowConstraints>
    <RowConstraints />
    <RowConstraints vgrow="ALWAYS" />
  </rowConstraints>
</GridPane>
`;

const csvStr = `
field1,field2,field3
v11,v12,v13
v21, "v2l1
V2l2" ,v23
"v31""v31","v32""""v32",v33
`;

const mapToStringStr = '{K1=v1, k2=123, k3={c=Test with ,in}, k4=[ab,c, def]}';

export const prometheusStr = String.raw`
# Sample from: https://prometheus.io/docs/instrumenting/exposition_formats/#text-based-format
# HELP http_requests_total The total number of HTTP requests.
# TYPE http_requests_total counter
http_requests_total{method="post",code="200"} 1027 1395066363000
http_requests_total{method="post",code="400"}    3 1395066363000

# Escaping in label values:
msdos_file_access_time_seconds{path="C:\\DIR\\FILE.TXT",error="Cannot find file:\n\"FILE.TXT\""} 1.458255915e9

# Minimalistic line:
metric_without_timestamp_and_labels 12.47

# Minimalistic line:
# HELP metric_without_timestamp_and_labels The total number of HTTP requests.
# TYPE metric_without_timestamp_and_labels counter
metric_without_timestamp_and_labels{} 12.47

# A weird metric from before the epoch:
something_weird{problem="division by zero"} +Inf -3982045

# A histogram, which has a pretty complex representation in the text format:
# HELP http_request_duration_seconds A histogram of the request duration.
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.05"} 24054
http_request_duration_seconds_bucket{le="0.1"} 33444
http_request_duration_seconds_bucket{le="0.2"} 100392
http_request_duration_seconds_bucket{le="0.5"} 129389
http_request_duration_seconds_bucket{le="1"} 133988
http_request_duration_seconds_bucket{le="+Inf"} 144320
http_request_duration_seconds_sum 53423
http_request_duration_seconds_count 144320

# HELP go_gc_duration_seconds A summary of the pause duration of garbage collection cycles.
# TYPE go_gc_duration_seconds summary
go_gc_duration_seconds{quantile="0"} 0
go_gc_duration_seconds{quantile="0.25"} 0
go_gc_duration_seconds{quantile="0.5"} 0
go_gc_duration_seconds{quantile="0.75"} 0
go_gc_duration_seconds{quantile="1"} 0
go_gc_duration_seconds_sum 0
go_gc_duration_seconds_count 0

# Finally a summary, which has a complex representation, too:
# HELP rpc_duration_seconds A summary of the RPC duration in seconds.
# TYPE rpc_duration_seconds summary
rpc_duration_seconds{quantile="0.01"} 3102
rpc_duration_seconds{quantile="0.05"} 3272
rpc_duration_seconds{quantile="0.5"} 4773
rpc_duration_seconds{quantile="0.9"} 9001
rpc_duration_seconds{quantile="0.99"} 76656
rpc_duration_seconds_sum 1.7560473e+07
rpc_duration_seconds_count 2693
`;

export default {
  jsonStr,
  yamlStr,
  xmlStr,
  csvStr,
  mapToStringStr,
  prometheusStr,
  data: [
    {text: 'empty', value: {}},
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
      value: yamlStr,
    },
    {
      text: 'yaml-Multi-Doc',
      value: yamlMultiDocStr,
    },
    {
      text: 'xml',
      value: xmlStr,
    },
    {
      text: 'fxml (JavaFx)',
      value: fxml,
    },
    {
      text: 'csv',
      value: csvStr,
    },
    {
      text: 'map.toString',
      value: mapToStringStr,
    },
    {
      text: 'prometheus',
      value: prometheusStr,
    },
  ] as {text: string, value: any}[],
};
