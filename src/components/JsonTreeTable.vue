<template>
  <div class="tdv-container">
    <div class='tdv-top'>
      <slot name='title' />
      <b-button-group class="ml-1 tdv-toolbar">
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
        <b-btn :size="'sm'" @click='copyText(jsonStr)' class='tdv' :disabled='!jsonStr' v-b-tooltip.hover title="Copy">
          <i class="fa fa-copy"></i>
        </b-btn>
        <b-btn :size="'sm'" @click='paste' v-b-tooltip.hover title="Paste" v-if="pasteSupported">
          <i class="fa fa-paste"></i>
        </b-btn>
        <b-btn size='sm' variant='outline-secondary' class='tdv' :pressed.sync='tstate.codeView[0]' v-b-tooltip.hover title="Toggle source code syntax hi-lighting">
          <i class="fa fa-code"></i>
        </b-btn>
        <b-btn size='sm' @click='format' v-b-tooltip.hover title="Format">
          <i class="fa fa-indent"></i>
        </b-btn>
      </b-button-group>
      <b-button-group class="mx-1">
        <b-btn size='sm' variant='outline-secondary' class='tdv' :pressed.sync='tstate.showSource[0]'>Source</b-btn>
        <b-btn size='sm' variant='outline-secondary' class='tdv' :pressed.sync='tstate.showTree[0]'>Tree</b-btn>
        <b-btn size='sm' variant='outline-secondary' class='tdv' :pressed.sync='tstate.showTable[0]'>Table</b-btn>
        <template v-if="parserSelectOptions.length > 1">Parser <b-form-select :options='parserSelectOptions' v-model='selectedParser' size="sm"></b-form-select></template>
      </b-button-group>
      <span><slot/></span>
      <span class="status-msg" :class="{error: hasError}" >{{parseResult}}</span>
    </div>
    <div class="split-container">
      <!-- tabindex=0 make the div focusable -->
      <msplit :maxPane='tstate.maxPane' @node-mouse-enter.native.stop='nodeMouseEnter' @node-mouse-leave.native.stop='nodeMouseLeave'>
        <div slot="source" :grow="20" style="width: 100%" :show="tstate.showSource"  class="panview" 
          @click="tstate.curPan='source'" :class="{focus: tstate.curPan==='source'}" @keypress="onKeyPress($event, 'source')" tabindex="0">
          <SourceView ref="sourceView" v-model="jsonStr" :syntax='selectedParser.syntax' :selection='tstate.selection' :show='tstate.showSource[0]' :tstate="tstate" :useCodeView='tstate.codeView' />
        </div>
        <div slot="tree" :grow="30" :show="tstate.showTree" class="panview" 
          @click="tstate.curPan='tree'"  :class="{focus: tstate.curPan==='tree'}" @keypress="onKeyPress($event, 'tree')" tabindex="0">
          <!-- tstate.selected={{tstate.selected}} -->
          <tree-view v-if="tstate.tree" 
              :tstate="tstate"
              :expand-level=1
              :rootObjectKey='rootObjectKey' 
              />
          <div v-else>No Data</div>
        </div>
        <div slot="table" :grow="50" :show="tstate.showTable" class="panview" 
          @click="tstate.curPan='table'" :class="{focus: tstate.curPan==='table'}" @keypress="onKeyPress($event, 'table')" tabindex="0">
          <!-- <div v-if="tstate.tree"><json-table :table-data='tstate' :options="tableOpt" -->
          <json-table v-if="tstate.tree" :table-data='tstate' 
            @node-clicked='nodeClicked'
            isInMuliPane="true" />
          <div v-else>No Data</div>
        </div>
      </msplit>
    </div>
    <div id='treeItemActions' v-show="mouseInNode || mouseInActionBar === true" :style="treeItemActionStyle" @mouseenter="mouseEnterActionBar" @mouseleave="mouseLeaveActionBar">
      <b-button-group class="mx-1">
        <b-btn :size="'sm'" @click='copyNode' class='tdv' v-b-tooltip.hover title="Copy Current Node"><i class="fa fa-copy"></i></b-btn>
      </b-button-group>
    </div>
    <textarea ref='copyTextArea' class='hiddenTextArea nowrap' />
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import _ from 'lodash';
import TreeState from '../models/TreeState';
import SourceView from './SourceView.vue';
import TDVOptions, { ParserPlugin } from '../models/TDVOption';
import TreeView from './TreeView.vue';
import JsonTable from './JsonTable.vue';
import JSONParserPlugin from '../parsers/JSONParserPlugin';

import { TDNode, TDJSONWriter, TDJSONWriterOption } from 'treedoc';
import { NodeMouseEnterEvent } from './TreeViewItem.vue';
import { nextTick } from 'vue/types/umd';

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
  @Prop() options?: TDVOptions;
  @Prop() initalPath!: string;
  @Prop() rootObjectKey!: string;

  defaultParser: ParserPlugin<any> = new JSONParserPlugin();
  selectedParser: ParserPlugin<any> = this.defaultParser;
  tstate = new TreeState({}, this.selectedParser).setInitSOpt(this.options);
  jsonStr = '';

  parseResult = '';
  strDataSynced = false;
  error = {
    color: 'red',
  };

  // url = https://maps.sensor.community/data/v2/data.24h.json
  // url = 'https://jsonplaceholder.typicode.com/posts';
  url = 'https://www.googleapis.com/discovery/v1/apis/vision/v1p1beta1/rest';
  // url = "https://www.googleapis.com/discovery/v1/apis"
  urlInput = '';

  treeItemActionStyle = {};
  mouseEnterEvent: NodeMouseEnterEvent | null = null;
  mouseInActionBarRealtime = false;
  mouseInActionBar = false;
  mouseInNode = false;

  nodeClicked(nodePath: string[]) {
    this.tstate.select(nodePath);
  }

  format() {
    this.jsonStr = TDJSONWriter.get().writeAsString(this.tstate.tree.root, new TDJSONWriterOption().setIndentFactor(2));
  }

  mounted() {
    // for devtool interaction
    (window as any).tdv = this;
  }

  onKeyPress(e: KeyboardEvent, pane: string) {
    // console.log(e);
    // Very strange: In source page, for 'f' key it will send to div first, then to editor. But for ctrl-f, 
    // it will send to editor first and it preventDefault(), so the hot key won't work. We disable hot key for source page for now.
    if (pane === 'source')
      return;  // The source pane the key event won't reach editor before the div
    if (e.key === 'f') {
      this.tstate.toggleMaxPane(pane);
      // e.preventDefault();
    } else if (e.key === 'w') {
      this.tstate.textWrap = !this.tstate.textWrap
      // e.preventDefault();
    } else if (e.key === '[') {
      this.tstate.back()
      // e.preventDefault();
    } else if (e.key === ']') {
      this.tstate.forward()
      // e.preventDefault();
    }
  }

  // for devtool interaction only
  transformJson(func: (obj: any) => any) {
    this.jsonStr = JSON.stringify(func(this.tstate.tree.root.toObject(true)), null, 2);
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
    if (!str)
      str = '';

    if (str.length > 200_000)
      this.tstate.codeView[0] = false;
    if (str.length < 100_000)
      this.tstate.codeView[0] = true;
    // Need detected only if significant changes happens. Not accurate.
    const oldLen = old ? old.length : 0;
    const detectNeeded = Math.abs(oldLen - str.length) > 7 && str.length < 1000_000;
    this.parse(str, this, detectNeeded);
  }

  // Have to pass THIS as Vue framework will generate a different instance
  // of this during runtime.
  private parse = _.debounce((str: string, THIS: JsonTreeTable, detectParser = false) => {
    // Auto detect parser
    if (detectParser) {
      THIS.selectedParser = this.parserSelectOptions[0].value;  // Default to first parser
      for (const parser of this.parserSelectOptions) {
        if (parser.value.looksLike(str)) {
          THIS.selectedParser = parser.value;
          break;
        }
      }
    }

    const selectedPath = THIS.tstate.selected ? THIS.tstate.selected.path : [];
    THIS.tstate = new TreeState(this.strDataSynced ? THIS.data : str, THIS.selectedParser, THIS.rootObjectKey, selectedPath).retainState(THIS.tstate);
    THIS.strDataSynced = false;
    THIS.parseResult = THIS.tstate.parseResult;

    if (selectedPath.length === 0 && THIS.initalPath && THIS.tstate.tree)
      THIS.tstate.select(THIS.initalPath, true);
  }, 300);

  get hasError() {
    return this.parseResult.startsWith('Error');
  }

  get tableOpt() {
    return this.options?.defaultTableOpt;
  }

  get parserSelectOptions() {
    const opt = new Array<{text: string, value: ParserPlugin<any>}>();
    opt.push({ text: this.defaultParser.name, value: this.defaultParser });
    if (this.options && this.options.parsers)
      this.options.parsers.forEach(p => opt.push({text: p.name, value: p}));
    return opt;
  }
  
  get copyTextArea() { return this.$refs.copyTextArea as HTMLTextAreaElement; }
  get sourceView() { return this.$refs.sourceView as SourceView; }

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

  openUrl(dataUrl: string) {
    this.url = dataUrl;
    window.fetch(this.url,{
        // mode: 'navigate' 
      }
      )
      .then(res => res.text())
      .then(data => this.jsonStr = data)
      .catch((err) => this.jsonStr = err);
    this.jsonStr = JSON.stringify({
      action: 'loading...',
      url: this.url,
    }, null, 2);
  }

  get pasteSupported() { return !!navigator?.clipboard?.readText; }

  paste() {
    // this.copyTextArea.select();
    // this.copyTextArea.focus();
    // // Doesn't work both in firefox and chrome
    // const res = document.execCommand('paste');
    // console.log(`paste result: ${res}`);

    // Only works for chrome
    navigator.clipboard.readText().then((txt: string) => {
       this.jsonStr = txt;
    });
  }


  copyText(text: string) {
    // code mirror doesn't support copy command, we have to use a hidden textarea to do the copy
    this.copyTextArea.value = text;
    this.copyTextArea.select();
    this.copyTextArea.setSelectionRange(0, 999999999);
    // document.execCommand('selectAll');
    const res = document.execCommand('copy');
    console.log(`copy result: ${res}`);
    // this.codeView.editor.getTextArea().select();
    // this.codeView.editor.execCommand('selectAll');
    // this.codeView.editor.execCommand('copy');
  }

  get mouseOverNode() { return this.tstate.findNodeByPath(this.mouseEnterEvent!.nodePath); }
  
  copyNode() { 
    const node = this.mouseOverNode;
    if (node.start && node.end)
      this.copyText(this.jsonStr.substring(node.start.pos, node.end.pos));
    else 
      this.copyText(TDJSONWriter.writeAsString(node, new TDJSONWriterOption().setIndentFactor(2)));
  }

  nodeMouseEnter(e: CustomEvent) { 
    this.mouseEnterEvent = e.detail; 
    this.mouseInNode = true;
    const pos = this.mouseEnterEvent!.source.getBoundingClientRect();
    this.treeItemActionStyle = {position: 'fixed', top: `${pos.top}px`, left: `${pos.right}px`};
  }

  nodeMouseLeave(e: CustomEvent) {
    if (this.mouseEnterEvent?.source === e.detail.source)
      this.mouseInNode = false;
  }

  mouseEnterActionBar() {
    this.mouseInActionBarRealtime = true;
    setTimeout(() => this.mouseInActionBar = true, 500);
  }

  mouseLeaveActionBar() {
    this.mouseInActionBarRealtime = false;
    setTimeout(() => {
      if (!this.mouseInActionBarRealtime)
        this.mouseInActionBar = false;
    }, 500);
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
  height: 100%;
  /* overflow: auto; */
  background-color: white;
  display: flex;
  flex-direction: column;
}
.tdv-container {
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
.tdv-top {
  background-color: lightgray;
}
.tdv-toolbar {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 100;
}
.tdv-title {
  color: darkblue;
}
.tdv-hint {
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

.hiddenTextArea {
  width: 0px;
  height: 0px;
  left: 0px;
  top: 0px;
  position: static;
}

/* workaround for firefox bug:  https://bugzilla.mozilla.org/show_bug.cgi?id=1137650 */
.nowrap {
    white-space: pre;
    overflow: auto;
    word-wrap: normal;
}

.hiddenTextArea {
  position: fixed; 
  opacity: 0;
  width: 0px;
  height: 0px;
}

.focus {
  outline: 1px solid blue;
  margin: 1px;  /* not sure why border is not showing without this. The border is ecliped as it's out of parent border */
}
</style>
