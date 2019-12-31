<template>
  <div style="height:100%">
    <b-button-group class="ml-1 jtt-toolbar">
      <b-btn :size="'sm'" @click='$refs.file1.click()' v-b-tooltip.hover title="Open File">
        <i class="fa fa-folder-open"></i>
        <input type="file" ref='file1' style="display: none" @change="readFile($event)">
      </b-btn>
      <b-btn :size="'sm'" v-b-modal.modal-1 v-b-tooltip.hover title="Open URL">
        <i class="fa fa-internet-explorer"></i>
        <b-modal id="modal-1" title="Open URL" @ok='openUrl' @show='urlInput=url'>
          URL: <b-input v-model="urlInput" />
        </b-modal>
      </b-btn>
      <b-btn :size="'sm'" @click='copy' :disabled='!value' v-b-tooltip.hover title="Copy">
        <i class="fa fa-copy"></i>
      </b-btn>
      <b-btn :size="'sm'" @click='paste' v-b-tooltip.hover title="Paste">
        <i class="fa fa-paste"></i>
      </b-btn>
      <b-btn size='sm' variant='outline-secondary' :pressed.sync='useCodeview' v-b-tooltip.hover title="Source Code View">
        <i class="fa fa-code"></i>
      </b-btn>
    </b-button-group>
    <template v-if="useCodeview">
      <codemirror ref='codeView' class='codeView' :options="options" v-model="val" style="height:100%"></codemirror>
    </template>
    <textarea ref='textView' v-model="val" :class="[useCodeview ? 'hiddenTextArea' : 'textArea']"></textarea>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { codemirror } from 'vue-codemirror-lite';

import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/vue/vue';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/yaml/yaml';

import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/javascript-hint';

import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/fold/indent-fold';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/xml-fold';
import { Selection } from '../models/TreeState';
import Bookmark from 'jsonex-treedoc/lib/Bookmark';

@Component({
  components: {
    codemirror,
  },
})
export default class SourceView extends Vue {
  @Prop() value!: string;
  @Prop() syntax!: string;
  @Prop({required: false}) selection?: Selection;
  @Prop() show?: boolean;
  useCodeview = true;
  val = this.value;
  // url = 'https://jsonplaceholder.typicode.com/posts';
  url = 'https://www.googleapis.com/discovery/v1/apis/vision/v1p1beta1/rest';
  // url = "https://www.googleapis.com/discovery/v1/apis"
  urlInput = '';

  readFile(ef: Event) {
    const fileName = (ef.target as HTMLInputElement).files![0];
    if (!fileName)
      return;
    const reader = new FileReader();
    reader.onload = (e: Event) =>  {
      if (reader.result)
        this.val = reader.result as string;
    };
    reader.readAsText(fileName);
  }

  openUrl() {
    this.url = this.urlInput;
    window.fetch(this.url)
      .then(res => res.text())
      .then(data => this.val = data)
      .catch((err) => this.val = err);
    this.val = JSON.stringify({
      action: 'loading...',
      url: this.url,
    }, null, 2);
  }

  // get codeView() {
  //   return this.$refs.codeView as any;
  // }

  get textView() {
    return this.$refs.textView as HTMLTextAreaElement;
  }

  get codeView() {
    return this.$refs.codeView as any;
  }

  get options() {
    const syntaxMap: any = {
      xml: 'xml',
      yaml: 'yaml',
      json: { name: 'javascript', json: true },
    };

    const mode = syntaxMap[this.syntax] || syntaxMap.json;

    return {
      mode,
      tabSize: 2,
      lineNumbers: true,
      // lineWrapping: true,
      viewportMargin: 10,
      extraKeys: {'Ctrl-Space': 'autocomplete'},
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    };
  }

  copy() {
    // code mirror doesn't support copy command, we have to use a hidden textarea to do the copy
    this.textView.select();
    this.textView.setSelectionRange(0, 999999);
    // document.execCommand('selectAll');
    const res = document.execCommand('copy');

    console.log(`copy result: ${res}`);
    // this.codeView.editor.getTextArea().select();
    // this.codeView.editor.execCommand('selectAll');
    // this.codeView.editor.execCommand('copy');
  }

  paste() {
    // this.codeView.editor.getTextArea().select();
    // this.codeView.editor.focus();
    // Doesn't work as chrome blocked for security reason
    // const res = document.execCommand("paste");
    // console.log(`paste result: ${res}`);
    navigator.clipboard.readText().then((txt: string) => {
       this.val = txt;
    });
  }

  @Watch('val')
  watchVal() { this.$emit('input', this.val); }

  @Watch('value', {immediate: true})
  watchValue(v: string) { this.val = v; }

  @Watch('selection', { deep: true })
  watchSelection(v: Selection) {
    if (!this.show || !v || !v.start || !v.end)
      return;
    if (this.useCodeview) {
      this.codeView.editor.doc.setSelection(toPos(v.start), toPos(v.end), {scroll: true});
    } else {
      scrollTo(this.textView, v.start.pos);
      this.textView.select();
      this.textView.setSelectionRange(v.start.pos, v.end.pos);
    }
  }
}

function toPos(bm: Bookmark): {line: number, ch: number} {
  return {
    line: bm.line,
    ch: bm.col,
  };
}

function scrollTo(textarea: HTMLTextAreaElement, offset: number) {
    const txt = textarea.value;
    if (offset >= txt.length || offset < 0)
      return;
    textarea.scrollTop = 0;  // Important, so that scrollHeight will be adjusted
    textarea.value = txt.substring(0, offset);
    const height = textarea.scrollHeight;
    textarea.value = txt;
    textarea.scrollTop = height - 40;  // Margin between selection and top of viewport
}
</script>
<style>
.CodeMirror {
  height: 100%;
  font-size: small;
}

.hiddenTextArea {
  width: 0px;
  height: 0px;
}

.textArea {
  width: 100%;
  min-height:400px;
  height:100%;
  flex-grow:1;
  overflow:auto;
}
/* .codeView {
  flex-grow:1;
  overflow:auto;
} */
</style>
