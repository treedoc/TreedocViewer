<template>
  <div id='app' class='components-container'>
    <json-tree-table :data='jsonData' :inital-path="'/'" :options='tdvOption' rootObjectKey='root' class="json-tree-table" ref="jsonTreeTable">
      <template v-slot:title>
        <a href="https://www.treedoc.org"><b class="tdv-title">{{param.title}}</b></a>
      </template>
      <span v-if="param.embeddedId == null">
        Sample Data: <b-form-select v-model="jsonData" :options="sampleData" size='sm' style="width:auto" />
      </span>
      <span class="title">
        <span id='icons'>
          <!-- <a href='https://github.com/treedoc/TreedocViewer' target="_blank"><img alt="GitHub stars" src="https://img.shields.io/github/stars/treedoc/treedocviewer"></a> -->
          <a href='https://github.com/treedoc/TreedocViewer' target="_blank"><img alt="Github folks" src="https://img.shields.io/github/forks/treedoc/treedocviewer"></a>

          <!-- <a href='https://github.com/treedoc/TreedocViewer/issues' target="_blank"><img alt="GitHub issues" src="https://img.shields.io/github/issues/treedoc/treedocviewer"></a> -->
          <a href='https://www.npmjs.com/package/treedoc-viewer' target="_blank"><img alt="npm" src="https://img.shields.io/npm/v/treedoc-viewer"></a>
          <!-- <a href='https://www.reddit.com/r/javascript/comments/el6bs2/treedoc_viewer_is_a_featurerich_viewer_for/' title="Discuss on Reddit" target="_blank">
            <i class="fa fa-reddit"></i>
          </a> -->
          <!--| <a href='http://p/treedoc' target="_blank" title="Vote on pegboard">Vote on p/treedoc</i></a> http://go/treedoc -->
        </span>
      </span> 
    </json-tree-table>
  </div>
</template>

<script lang='ts'>
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

import JsonTreeTable from './components/JsonTreeTable.vue';
import JsonTable from './components/JsonTable.vue';
import sampleData from './sampleData';
import TDVOptions from './models/TDVOption';
import YAMLParserPlugin from './parsers/YAMLParserPlugin';
import XMLParserPlugin from './parsers/XMLParserPlugin';
import CSVParserPlugin from './parsers/CSVParserPlugin';
import UrlParam from './UrlParam';
import JSONParserPlugin, { JSONParserOption, JSONParserType } from './parsers/JSONParserPlugin';

@Component({
  components: {
    JsonTreeTable,
    JsonTable,
  },
})
export default class Home extends Vue {
  param = new UrlParam();
  sampleData = sampleData.data;
  jsonData: any = sampleData.data[0].value;

  tdvOption: TDVOptions = {
    parsers: [
      new JSONParserPlugin('Map.toString', JSONParserType.JAVA_MAP_TO_STRING),
      new XMLParserPlugin('XML compact', 'text/xml', true),
      new XMLParserPlugin(),
      new XMLParserPlugin('html', 'text/html'),
      new CSVParserPlugin(),
      new CSVParserPlugin('TSV', '\t'),
      new YAMLParserPlugin(),
      ],
  };

  private get jsonTreeTable() {
    return this.$refs.jsonTreeTable as JsonTreeTable;
  }

  mounted() {
    if (this.param.dataUrl)
      this.jsonTreeTable.openUrl(this.param.dataUrl);

    if (this.param.data)
      this.jsonData = this.param.data;
      

    if (this.param.embeddedId != null) {
      window.parent.postMessage({ type: 'tdv-ready', id: this.param.embeddedId }, '*');
      if (window.opener)
        window.opener.postMessage({ type: 'tdv-ready', id: this.param.embeddedId }, '*');

      window.addEventListener('message', evt => {
        if (evt.data.type !== 'tdv-setData')
          return;
        this.jsonData = evt.data.data;
      }, false);
    }
  }
}
</script>

<style>
.title {
  text-align: center;
  color: darkblue
}
.components-container {
  display: flex;
  position: absolute;
  flex-direction: column;
  margin-left: 2px;
  width: 99%;
  /* background-color: #ff0; */
  height: 98%;
  /* overflow: auto; */
  /* min-height:100%;
  min-width:100%; */
}
html {
  height: 100%;
}
body {
  min-height: 100%;
}
.inputline {
  display: flex;
  align-items: center;
  float:right;
}
.json-tree-table {
  /* background-color: rgba(0, 0, 255, 0.16); */
  height: 100%;
  /* overflow: auto; */
}
#icons {
  float: right;
}
</style>
