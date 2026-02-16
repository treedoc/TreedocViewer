<script setup lang="ts">
import { ref, computed, watch, onMounted, shallowRef } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { EditorView } from '@codemirror/view'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { useTreeStore } from '../stores/treeStore'
import { useThemeStore } from '../stores/themeStore'
import { storeToRefs } from 'pinia'
import { useToast } from 'primevue/usetoast'
import ToggleButton from 'primevue/togglebutton'
import Button from 'primevue/button'

const SIZE_LIMIT_FOR_READONLY = 10_000_000
const SIZE_LIMIT_FOR_CODE_VIEW = 1000_000

const store = useTreeStore()
const themeStore = useThemeStore()
const toast = useToast()
const { rawText, selection, selectedParser, codeView } = storeToRefs(store)
const { isDarkMode } = storeToRefs(themeStore)

const localText = ref(rawText.value)
const editorRef = ref<any>(null)

// Theme for CodeMirror that uses CSS variables
const editorTheme = computed(() => EditorView.theme({
  '&': {
    backgroundColor: 'var(--tdv-surface)',
    color: 'var(--tdv-text)',
  },
  '.cm-content': {
    caretColor: 'var(--tdv-primary)',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: '13px',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--tdv-primary)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--tdv-selection-bg)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--tdv-surface-light)',
    color: 'var(--tdv-text-muted)',
    border: 'none',
    borderRight: '1px solid var(--tdv-surface-border)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--tdv-hover-bg)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--tdv-hover-bg)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--tdv-surface-light)',
    color: 'var(--tdv-primary)',
    border: 'none',
  },
  '.cm-line': {
    padding: '0 4px',
  },
}, { dark: isDarkMode.value }))

const extensions = computed(() => {
  const exts = [editorTheme.value]
  
  const syntax = selectedParser.value?.syntax || 'json'
  switch (syntax) {
    case 'xml':
      exts.push(xml())
      break
    case 'yaml':
      exts.push(yaml())
      break
    case 'json':
    default:
      exts.push(javascript())
      break
  }
  
  return exts
})

// Force re-render when theme changes
const editorKey = computed(() => `editor-${isDarkMode.value ? 'dark' : 'light'}`)

const isReadonly = computed(() => rawText.value.length > SIZE_LIMIT_FOR_READONLY)
const shouldUseCodeView = computed(() => codeView.value)

const truncatedText = computed(() => {
  if (rawText.value.length > SIZE_LIMIT_FOR_READONLY) {
    return rawText.value.substring(0, SIZE_LIMIT_FOR_READONLY) + '\n... (truncated)'
  }
  return rawText.value
})

function handleChange(value: string) {
  localText.value = value
  store.setRawText(value)
}

function handleReady({ view }: { view: EditorView }) {
  editorRef.value = view
}

// Watch for external text changes
watch(rawText, (newText) => {
  if (newText !== localText.value) {
    localText.value = newText
  }
})

// Watch selection changes to scroll to position
watch(selection, (sel) => {
  if (!editorRef.value || !sel?.start || !sel?.end) return
  if (rawText.value.length > 2_000_000) return // Skip for large files
  
  try {
    const view = editorRef.value as EditorView
    const from = sel.start.pos
    const to = sel.end.pos
    
    view.dispatch({
      selection: { anchor: from, head: to },
      scrollIntoView: true,
    })
  } catch (e) {
    console.warn('Failed to update selection:', e)
  }
}, { deep: true })

// Auto-disable code view for large files
watch(rawText, (text) => {
  if (text.length > SIZE_LIMIT_FOR_CODE_VIEW && codeView.value) {
    codeView.value = false
  } else if (text.length < 100_000 && !codeView.value) {
    codeView.value = true
  }
})

async function paste() {
  try {
    const text = await navigator.clipboard.readText()
    store.setTextImmediate(text)
    toast.add({ severity: 'success', summary: 'Pasted from clipboard', life: 2000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Failed to paste', detail: 'Clipboard access denied', life: 3000 })
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(rawText.value)
    toast.add({ severity: 'success', summary: 'Copied to clipboard', life: 2000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Failed to copy', life: 3000 })
  }
}

function format() {
  store.format()
  toast.add({ severity: 'success', summary: 'Formatted', life: 2000 })
}
</script>

<template>
  <div class="source-view">
    <div class="source-header">
      <span class="panel-title">Source View</span>
      <div class="source-controls">
        <Button
          icon="pi pi-copy"
          size="small"
          text
          :disabled="!rawText"
          @click="copy"
          v-tooltip.top="'Copy'"
        />
        <Button
          icon="pi pi-clipboard"
          size="small"
          text
          @click="paste"
          v-tooltip.top="'Paste'"
        />
        <Button
          icon="pi pi-align-justify"
          size="small"
          text
          :disabled="!rawText"
          @click="format"
          v-tooltip.top="'Format'"
        />
        <ToggleButton
          v-model="codeView"
          onLabel="Code"
          offLabel="Text"
          onIcon="pi pi-code"
          offIcon="pi pi-align-left"
          v-tooltip.top="rawText.length > SIZE_LIMIT_FOR_CODE_VIEW 
            ? 'Large file (' + (rawText.length / 1000).toFixed(0) + 'KB) - Code view may be slow' 
            : 'Toggle syntax highlighting'"
        />
        <span v-if="isReadonly" class="readonly-badge">
          <i class="pi pi-lock"></i> Read-only ({{ (rawText.length / 1_000_000).toFixed(1) }}MB)
        </span>
      </div>
    </div>
    
    <div class="source-content">
      <Codemirror
        v-if="shouldUseCodeView"
        :key="editorKey"
        v-model="localText"
        :extensions="extensions"
        :style="{ height: '100%', width: '100%' }"
        @change="handleChange"
        @ready="handleReady"
      />
      
      <textarea
        v-else-if="!isReadonly"
        v-model="localText"
        class="source-textarea"
        @input="handleChange(($event.target as HTMLTextAreaElement).value)"
      />
      
      <div v-else class="readonly-view">
        <div class="readonly-notice">
          <i class="pi pi-info-circle"></i>
          Text size is {{ (rawText.length / 1_000_000).toFixed(1) }}MB, shown in read-only mode for performance
        </div>
        <pre class="readonly-content">{{ truncatedText }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.source-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.source-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--tdv-surface-light);
  border-bottom: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius) var(--tdv-radius) 0 0;
}

.source-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.readonly-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--tdv-warning);
  padding: 4px 8px;
  background: rgba(255, 217, 61, 0.1);
  border-radius: 4px;
}

.source-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.source-textarea {
  flex: 1;
  width: 100%;
  resize: none;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  background: var(--tdv-surface);
  color: var(--tdv-text);
  border: none;
  padding: 12px;
  outline: none;
  line-height: 1.5;
  overflow: auto;
}

.readonly-view {
  height: 100%;
  overflow: auto;
}

.readonly-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 217, 61, 0.1);
  color: var(--tdv-warning);
  font-size: 0.85rem;
}

.readonly-content {
  margin: 0;
  padding: 12px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: var(--tdv-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--tdv-surface);
  line-height: 1.5;
}

/* CodeMirror container */
:deep(.cm-editor) {
  height: 100%;
}

:deep(.cm-scroller) {
  overflow: auto;
}
</style>
