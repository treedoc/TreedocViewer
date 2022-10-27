<template>
  <div style="height:100%;overflow: hidden;">
    <template v-if="useCodeView[0]">
      <codemirror ref='codeView' class='codeView' :options="options" v-model="val" style="height:100%"></codemirror>
    </template>
    <textarea ref='textView' v-model="val" :class="[useCodeView[0] ? 'hiddenTextArea' : 'textArea']" class='nowrap'></textarea>
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
import { Bookmark } from 'treedoc/lib/Bookmark';

@Component({
  components: {
    codemirror,
  },
})
export default class SourceView extends Vue {
  @Prop() value!: string;
  @Prop() syntax!: string;
  @Prop() useCodeView!: boolean[];
  @Prop({required: false}) selection?: Selection;
  @Prop() show?: boolean;
  val = this.value;

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

  @Watch('val')
  watchVal() { this.$emit('input', this.val); }

  @Watch('value', {immediate: true})
  watchValue(v: string) { this.val = v; }

  @Watch('selection', { deep: true })
  watchSelection(v: Selection) {
    if (!this.show || !v || !v.start || !v.end)
      return;
    if (this.val.length > 1_000_000)  // Don't scroll for large file to avoid performence issue
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
