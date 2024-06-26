<template>
  <div style="height:100%;overflow: hidden;" @click="tstate.curPan='source'">
    <codemirror v-if="useCodeView[0]" ref='codeView' class='codeView' :options="options" v-model="val" style="height:100%"></codemirror>
    <!-- very important to set a min-width, otherwise when hide the panel which reduce the width to 0 and reflow will crash -->
    <textarea v-if="!useCodeView[0] && !readonly" style='min-width: 400px; overflow: scroll;' ref='textView' v-model="val" :class="[useCodeView[0] ? 'hiddenTextArea' : 'textArea']"></textarea>
    <div v-if="!useCodeView[0] && readonly" style="height: 100%;">
      <div style="font-size: smaller; color: brown;">Text size is large with {{value.length}} bytes, show in readonly mode to avoid performance issue</div>
      <textarea style='min-width: 400px; overflow: scroll;background-color: lightgray;' ref='textView-readonly' v-model="truncatedText" :class='"textArea"' readonly></textarea>
    </div>
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
import TreeState, { Selection } from '../models/TreeState';
import { Bookmark } from 'treedoc/lib/Bookmark';
import _ from 'lodash';

const SIZE_LIMIT_FOR_READONLY = 10_000_000;

@Component({
  components: {
    codemirror,
  },
})
export default class SourceView extends Vue {
  @Prop() tstate!: TreeState;
  @Prop() value!: string;
  @Prop() syntax!: string;
  @Prop() useCodeView!: boolean[];
  @Prop({required: false}) selection?: Selection;
  @Prop() show?: boolean;
  val = this.value;

  get softWrap() {  // prevent rending single long line hangs the browser
    return this.val.length > 10000 && this.val.substr(1000, 9000).indexOf('\n') < 0;
  }

  get textView() {
    return this.$refs.textView as HTMLTextAreaElement;
  }

  get codeView() {
    return this.$refs.codeView as any;
  }

  get readonly() {
    return this.value.length > SIZE_LIMIT_FOR_READONLY;
  }

  get truncatedText() {
    return _.truncate(this.value, {length: SIZE_LIMIT_FOR_READONLY});
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
      lineWrapping: this.softWrap,
      viewportMargin: 10,
      extraKeys: {'Ctrl-Space': 'autocomplete'},
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    };
  }

  @Watch('val')
  watchVal() { this.$emit('input', this.val); }

  @Watch('value', {immediate: true})
  watchValue(v: string) { this.val = v; }

  @Watch('selection', { deep: true })
  watchSelection(v: Selection) {
    if (!this.show || !v || !v.start || !v.end)
      return;
    if (this.val.length > 2_000_000)  // Don't scroll for large file to avoid performence issue
      return;
    if (this.useCodeView[0]) {
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

.textArea {
  width: 100%;
  min-height:400px;
  height:100%;
  resize: none;
  flex-grow:1;
  overflow:auto;
}
/* .codeView {
  flex-grow:1;
  overflow:auto;
} */
</style>
