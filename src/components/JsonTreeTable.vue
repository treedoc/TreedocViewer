<template>
  <div class="jtt-container">
    <div class='jtt-top'>
      <slot name='title' />
      <b-button-group class="ml-1 jtt-toolbar">
        <b-btn :size="'sm'" @click='$refs.file1.click()' v-b-tooltip.hover title="Open File">
          <i class="fa fa-folder-open"></i>
          <input type="file" ref='file1' style="display: none" @change="readFile($event)">
        </b-btn>
        <b-btn :size="'sm'" v-b-modal.modal-1 v-b-tooltip.hover title="Open URL">
          <i class="fa fa-link"></i>
          <b-modal id="modal-1" title="Open URL" @ok='openUrl(urlInput)' @show='urlInput=url'>
            URL: <b-input v-model="urlInput" />
          </b-modal>
        </b-btn>
        <b-btn :size="'sm'" @click='copy' class='jtt' :disabled='!jsonStr' v-b-tooltip.hover title="Copy">
          <i class="fa fa-copy"></i>
        </b-btn>
        <b-btn :size="'sm'" @click='paste' v-b-tooltip.hover title="Paste">
          <i class="fa fa-paste"></i>
        </b-btn>
        <b-btn size='sm' variant='outline-secondary' class='jtt' :pressed.sync='codeView[0]' v-b-tooltip.hover title="Toggle source code syntax hi-lighting">
          <i class="fa fa-code"></i>
        </b-btn>
        <b-btn size='sm' @click='format' v-b-tooltip.hover title="Format">
          <i class="fa fa-indent"></i>
        </b-btn>
      </b-button-group>
      <b-button-group class="mx-1">
        <b-btn size='sm' variant='outline-secondary' class='jtt' :pressed.sync='showSource[0]'>Source</b-btn>
        <b-btn size='sm' variant='outline-secondary' class='jtt' :pressed.sync='showTree[0]'>Tree</b-btn>
        <b-btn size='sm' variant='outline-secondary' class='jtt' :pressed.sync='showTable[0]'>Table</b-btn>
        Parser <b-form-select :options='parserSelectOptions' v-model='selectedParser' size="sm"></b-form-select>
      </b-button-group>
      <span><slot/></span>
      <span class="status-msg" :class="{error: hasError}" >{{parseResult}}</span>
    </div>
    <div class="split-container">
      <msplit :maxPane='tstate.maxPane'>
        <div slot="source" :grow="20" style="width: 100%" :show="showSource"  class="panview">
          <SourceView ref="sourceView" v-model="jsonStr" :syntax='selectedParser.syntax' :selection='tstate.selection' :show='showSource[0]' :useCodeView='codeView' />
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
          <div v-if="tstate.tree" ><json-table :table-data='tstate' @node-clicked='nodeClicked'/></div>
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
import JSONParserPlugin from '../parsers/JSONParserPlugin';

import { TDNode, TDJSONWriter, TDJSONWriterOption } from 'treedoc';

@Component({
  components: {
    TreeView,
    JsonTable,
    SourceView,
  },
})
export default class JsonTreeTable extends Vue {
  @Prop() title?: string;
  @Prop() data!: object | any[] | string;
  @Prop() options?: JTTOptions;
  @Prop() initalPath!: string;
  @Prop() rootObjectKey!: string;

  private showSource = [true];
  private showTree = [true];
  private showTable = [true];
  private codeView = [true];
  private defaultParser = new JSONParserPlugin();
  private selectedParser = this.defaultParser;
  private tstate = new TreeState({}, this.selectedParser);
  private jsonStr = '';

  private parseResult = '';
  private strDataSynced = false;
  private error = {
    color: 'red',
  };

  // url = https://maps.sensor.community/data/v2/data.24h.json
  // url = 'https://jsonplaceholder.typicode.com/posts';
  private url = 'https://www.googleapis.com/discovery/v1/apis/vision/v1p1beta1/rest';
  // url = "https://www.googleapis.com/discovery/v1/apis"
  private urlInput = '';

  private nodeClicked(nodePath: string[]) {
    this.tstate.select(nodePath);
  }

  private format() {
    this.jsonStr = TDJSONWriter.get().writeAsString(this.tstate.tree.root, new TDJSONWriterOption().setIndentFactor(2));
  }

  @Watch('data', { immediate: true })
  private watchData(d: string | object | any[]) {
    if (_.isString(d))
      this.jsonStr = d;
    else {
      this.jsonStr = JSON.stringify(d, null, '  ');
      this.strDataSynced = true;
    }
  }

  @Watch('selectedParser')
  private watch(v: ParserPlugin<any>) {
    this.parse(this.jsonStr, this);
  }

  @Watch('jsonStr', { immediate: true })
  private watchJsonStr(str: string, old: string) {
    if (str.length > 200_000)
      this.codeView[0] = false;
    if (str.length < 100_000)
      this.codeView[0] = true;
    // Need detected only if significant changes happens. Not accurate.
    const oldLen = old ? old.length : 0;
    const detectNeeded = Math.abs(oldLen - str.length) > 7;
    this.parse(str, this, detectNeeded);
  }

  // Have to pass THIS as Vue framework will generate a different instance
  // of this during runtime.
  private parse = _.debounce((str: string, THIS: JsonTreeTable, detectParser = false) => {
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
    (window as any).tstate = THIS.tstate;
    THIS.strDataSynced = false;
    THIS.parseResult = THIS.tstate.parseResult;

    if (selectedPath.length === 0 && THIS.initalPath && THIS.tstate.tree)
      THIS.tstate.select(THIS.initalPath, true);
  }, 500);

  private get hasError() {
    return this.parseResult.startsWith('Error');
  }

  private get parserSelectOptions() {
    const opt = new Array<{text: string, value: ParserPlugin<any>}>();
    opt.push({ text: this.defaultParser.name, value: this.defaultParser });
    if (this.options && this.options.parsers)
      this.options.parsers.forEach(p => opt.push({text: p.name, value: p}));
    return opt;
  }

  private get sourceView() {
    return this.$refs.sourceView as SourceView;
  }

  private readFile(ef: Event) {
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

  openUrl(dataUrl: string) {
    this.url = dataUrl;
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
  color: darkgreen;
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
.jtt-top {
  background-color: lightgray;
}
.jtt-toolbar {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 100;
}
.jtt-title {
  color: darkblue;
}
.jtt-hint {
  color: #aaa;
  font-size: 90%;
}
.json-tree-table * .btn-outline-secondary:hover {
  background-color: #bdccdc;
}
.json-tree-table * .btn-secondary {
  background-color: #6c757da6;
}
.json-tree-table * .btn-outline-secondary:not(:disabled):not(.disabled).active {
  background-color: #6c757da6;
}
.json-tree-table * .btn-outline-secondary:not(:disabled):not(.disabled).active:hover {
  background-color: #6c757d;
}
.json-tree-table * .btn-secondary:hover:not(:disabled){
  background-color: #6c757d;
}
</style>
