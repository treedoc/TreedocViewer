<template>
  <div>
    <b-button-group class="ml-1 jtt-toolbar">
      <b-btn :size="'sm'" @click='$refs.file1.click()' v-b-tooltip.hover title="Open File">
        <i class="fa fa-folder-open"></i>
        <input type="file" ref='file1' style="display: none" @change="readFile($event)">
      </b-btn>
      <b-btn :size="'sm'" @click='copy' :disabled='!value' v-b-tooltip.hover title="Copy">
        <i class="fa fa-copy"></i>
      </b-btn>
      <b-btn :size="'sm'" @click='paste' v-b-tooltip.hover title="Paste">
        <i class="fa fa-paste"></i>
      </b-btn>
    </b-button-group>
    <codemirror ref='sourceText' class='sourceText' :options="options" :value="val" @input="$emit('input', $event)"></codemirror>
    <textarea ref='textarea' v-model="val" style="width: 0px; height: 0px;" />
    <!-- <textarea ref='sourceText' style="width: 100%; min-height:400px; flex-grow:1; overflow:auto;" v-model="jsonStr"></textarea> -->
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

@Component({
  components: {
    codemirror,
  },
})
export default class SourceView extends Vue {
  @Prop() value!: string;
  @Prop() syntax!: string;
  val = this.value;

  readFile(ef: Event) {
    const fn = (ef.target as HTMLInputElement).files![0];
    if (!fn)
      return;
    const reader = new FileReader();
    reader.onload = (e: Event) =>  {
      if (reader.result) {
        this.val = reader.result as string;
         // Not sure event is not triggered by tag codemirror
        this.emitUpdateEvent();
      }
    };
    reader.readAsText(fn);
  }

  get sourceText() {
    return this.$refs.sourceText as any;
  }

  get textarea() {
    return this.$refs.textarea as HTMLInputElement;
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
      lineWrapping: false,
      viewportMargin: Infinity,
      extraKeys: {'Ctrl-Space': 'autocomplete'},
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    };
  }

  copy() {
    // code mirror doesn't support copy command, we have to use a hidden textarea to do the copy
    this.textarea.select();
    const res = document.execCommand('copy');
    console.log(`copy result: ${res}`);
    // this.sourceText.editor.getTextArea().select();
    // this.sourceText.editor.execCommand('selectAll');
    // this.sourceText.editor.execCommand('copy');
  }

  paste() {
    this.sourceText.editor.getTextArea().select();
    this.sourceText.editor.focus();
    // Doesn't work as chrome blocked for security reason
    // const res = document.execCommand("paste");
    // console.log(`paste result: ${res}`);
    navigator.clipboard.readText().then((txt: string) => {
       this.val = txt;
       this.emitUpdateEvent();
    });
  }

  emitUpdateEvent() {
    this.$emit('input', this.val);
  }

  @Watch('value', {immediate: true})
  watchValue(v: string) { this.val = v; }
}
</script>
<style>
.CodeMirror {
  height: 100%;
  font-size: small;
}
/* .sourceText {
  flex-grow:1;
  overflow:auto;
} */
</style>
