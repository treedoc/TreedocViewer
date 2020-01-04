<template>
  <div class="jtt-container">
    <div>
      <b-button-group class="ml-1 jtt-toolbar">
        <b-btn :size="'sm'" @click='$refs.file1.click()' v-b-tooltip.hover title="Open File">
          <i class="fa fa-folder-open"></i>
          <input type="file" ref='file1' style="display: none" @change="readFile($event)">
        </b-btn>
        <b-btn :size="'sm'" v-b-modal.modal-1 v-b-tooltip.hover title="Open URL">
          <i class="fa fa-link"></i>
          <b-modal id="modal-1" title="Open URL" @ok='openUrl' @show='urlInput=url'>
            URL: <b-input v-model="urlInput" />
          </b-modal>
        </b-btn>
        <b-btn :size="'sm'" @click='copy' :disabled='!jsonStr' v-b-tooltip.hover title="Copy">
          <i class="fa fa-copy"></i>
        </b-btn>
        <b-btn :size="'sm'" @click='paste' v-b-tooltip.hover title="Paste">
          <i class="fa fa-paste"></i>
        </b-btn>
        <!-- <b-btn size='sm' variant='outline-secondary' :pressed.sync='sourceView.useCodeview' v-b-tooltip.hover title="Toggle source code view">
          <i class="fa fa-code"></i>
        </b-btn> -->
        <b-btn size='sm' @click='format' v-b-tooltip.hover title="Format">
          <i class="fa fa-indent"></i>
        </b-btn>
      </b-button-group>      
      <b-button-group class="mx-1">
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showSource[0]'>Source</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showTree[0]'>Tree</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='showTable[0]'>Table</b-btn>
        Parser <b-form-select :options='parserSelectOptions' v-model='selectedParser' size="sm"></b-form-select>
      </b-button-group>
      <span><slot/></span>
      <span class="status-msg" :class="{error: hasError}" >{{parseResult}}</span>
    </div>
    <div class="split-container">
      <msplit>
        <div slot="source" :grow="20" style="width: 100%" :show="showSource"  class="panview">
          <SourceView ref="sourceView" v-model="jsonStr" :syntax='selectedParser.syntax' :selection='tstate.selection' :show='showSource[0]' />
        </div>
        <div slot="tree" :grow="30" :show="showTree" class="panview">
          <!-- tstate.selected={{tstate.selected}} -->
          <tree-view v-if="tstate.tree" 
              :tstate="tstate"
              :expand-level=1
              :rootObjectKey='rootObjectKey' />
          <div v-else>No Data</div>
        </div>
        <div slot="table" :grow="50" :show="showTable" class="panview">
          <div v-if="tstate.tree" ><json-table :table-data='tstate' v-on:nodeClicked='nodeClicked'/></div>
          <div v-else>No Data</div>
        </div>
      </msplit>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import _ from 'lodash';
import TreeState from '../models/TreeState';
import SourceView from './SourceView.vue';
import JTTOptions, { ParserPlugin } from '../models/JTTOption';
import TreeView from './TreeView.vue';
import JsonTable from './JsonTable.vue';
import JSONParser from '../parsers/JSONParser';
import XMLParser from '../parsers/XMLParser';

import { TDNode, TDJSONWriter, TDJSONWriterOption } from 'jsonex-treedoc';

@Component({
  components: {
    TreeView,
    JsonTable,
    SourceView,
  },
})
export default class JsonTreeTable extends Vue {
  @Prop() data!: object | any[] | string;
  @Prop() options?: JTTOptions;
  @Prop() initalPath!: string;
  @Prop() rootObjectKey!: string;

  showSource = [true];
  showTree = [true];
  showTable = [true];
  defaultParser = new JSONParser();
  selectedParser = this.defaultParser;
  tstate = new TreeState({}, this.selectedParser);
  selectedNode = this.tstate.selected;
  jsonStr = '';

  parseResult = '';
  strDataSynced = false;
  error = {
    color: 'red',
  };

  // url = 'https://jsonplaceholder.typicode.com/posts';
  url = 'https://www.googleapis.com/discovery/v1/apis/vision/v1p1beta1/rest';
  // url = "https://www.googleapis.com/discovery/v1/apis"
  urlInput = '';

  nodeClicked(node: TDNode) {
    this.tstate.select(node);
  }

  format() {
    this.jsonStr = TDJSONWriter.get().writeAsString(this.tstate.tree.root, new TDJSONWriterOption().setIndentFactor(2));
  }

  @Watch('data', { immediate: true })
  watchData(d: string | object | any[]) {
    if (_.isString(d))
      this.jsonStr =  d;
    else {
      this.jsonStr = JSON.stringify(d, null, '  ');
      this.strDataSynced = true;
    }
  }

  @Watch('selectedParser')
  watch(v: ParserPlugin<any>) {
    this.parse(this.jsonStr, this);
  }

  @Watch('jsonStr', { immediate: true })
  watchJsonStr(str: string) {
    this.parse(str, this, true);
  }

  // Have to parse THIS as Vue framework will generate a different instance
  // of this during runtime.
  parse = _.debounce((str: string, THIS: JsonTreeTable, detectParser = false) => {
    // Auto detect parser
    if (detectParser)
      for (const parser of this.parserSelectOptions) {
        if (parser.value.looksLike(str)) {
          THIS.selectedParser = parser.value;
          break;
        }
      }

    const selectedPath = THIS.tstate.selected ? THIS.tstate.selected.path : [];
    THIS.tstate = new TreeState(this.strDataSynced ? THIS.data : str, THIS.selectedParser, THIS.rootObjectKey, selectedPath);
    THIS.strDataSynced = false;
    THIS.parseResult = THIS.tstate.parseResult;

    if (selectedPath.length === 0 && THIS.initalPath && THIS.tstate.tree)
      THIS.tstate.select(THIS.initalPath, true);
  }, 500);

  get hasError() {
    return this.parseResult.startsWith('Error');
  }

  get parserSelectOptions() {
    const opt = new Array<{text: string, value: ParserPlugin<any>}>();
    opt.push({ text: this.defaultParser.name, value: this.defaultParser });
    if (this.options && this.options.parsers)
      this.options.parsers.forEach(p => opt.push({text: p.name, value: p}));
    return opt;
  }

  get sourceView() {
    return this.$refs.sourceView as SourceView;
  }

  readFile(ef: Event) {
    const fileName = (ef.target as HTMLInputElement).files![0];
    if (!fileName)
      return;
    const reader = new FileReader();
    reader.onload = (e: Event) =>  {
      if (reader.result)
        this.jsonStr = reader.result as string;
    };
    reader.readAsText(fileName);
  }

  openUrl() {
    this.url = this.urlInput;
    window.fetch(this.url)
      .then(res => res.text())
      .then(data => this.jsonStr = data)
      .catch((err) => this.jsonStr = err);
    this.jsonStr = JSON.stringify({
      action: 'loading...',
      url: this.url,
    }, null, 2);
  }

  paste() {
    // this.codeView.editor.getTextArea().select();
    // this.codeView.editor.focus();
    // Doesn't work as chrome blocked for security reason
    // const res = document.execCommand("paste");
    // console.log(`paste result: ${res}`);
    navigator.clipboard.readText().then((txt: string) => {
       this.jsonStr = txt;
    });
  }

  copy() {
    this.sourceView.copy();
  }
}
</script>
<style>
.status-msg {
  font-size: smaller;
  color: green;
}

.error {
  color: red;
}

.panview {
  /* max-height: 93vh; */
  max-height: 100%;
  width: 100%;
  /* overflow: auto; */
  background-color: white;
  display: flex;
  flex-direction: column;
}

.jtt-container {
  display: flex;
  height: 100%;
  flex-direction: column;
}

.split-container {
  /* max-height: 93vh; */
  /* width:100%; */
  /* height:100%; */
  flex-grow: 1;
  /* background-color: rgba(0, 255, 255, 0.308); */
  overflow: auto;
}

.btn-outline-secondary:hover {
  background-color: #bdccdc;
}
.jtt-toolbar {
  position: sticky;
  top: 0;
  z-index: 100;
}
</style>
