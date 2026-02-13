<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import Button from 'primevue/button'
import ToggleButton from 'primevue/togglebutton'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { useTreeStore } from '../stores/treeStore'
import { useThemeStore } from '../stores/themeStore'
import { storeToRefs } from 'pinia'
import SourceView from './SourceView.vue'
import TreeView from './TreeView.vue'
import TableView from './TableView.vue'
import type { TDVOptions } from '../models/types'

const props = defineProps<{
  data?: string | object
  initialPath?: string
  options?: TDVOptions
  rootObjectKey?: string
}>()

const emit = defineEmits<{
  ready: []
}>()

const store = useTreeStore()
const themeStore = useThemeStore()
const { 
  rawText, 
  parseResult, 
  hasError,
  showSource, 
  showTree, 
  showTable, 
  maxPane,
  currentPane,
  codeView,
  selectedParser,
  availableParsers
} = storeToRefs(store)
const { isDarkMode } = storeToRefs(themeStore)

const toast = useToast()
const fileInputRef = ref<HTMLInputElement>()
const urlDialogVisible = ref(false)
const urlInput = ref('')
const defaultUrl = 'https://www.googleapis.com/discovery/v1/apis/vision/v1p1beta1/rest'

const sourceViewRef = ref<InstanceType<typeof SourceView>>()
const treeViewRef = ref<InstanceType<typeof TreeView>>()
const tableViewRef = ref<InstanceType<typeof TableView>>()

// Parser options for select
const parserOptions = computed(() => 
  availableParsers.value.map(p => ({ label: p.name, value: p }))
)

// Computed pane visibility based on maxPane
const sourceVisible = computed(() => showSource.value && (maxPane.value === '' || maxPane.value === 'source'))
const treeVisible = computed(() => showTree.value && (maxPane.value === '' || maxPane.value === 'tree'))
const tableVisible = computed(() => showTable.value && (maxPane.value === '' || maxPane.value === 'table'))

// Pane size management - only set initial sizes, let splitpanes handle the rest
const splitpanesKey = ref(0)

// Force re-render splitpanes when visibility changes
watch([showSource, showTree, showTable, maxPane], () => {
  splitpanesKey.value++
})

function openFile() {
  fileInputRef.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target?.result) {
      store.setTextImmediate(e.target.result as string)
      toast.add({ severity: 'success', summary: 'File loaded', detail: file.name, life: 3000 })
    }
  }
  reader.readAsText(file)
  input.value = '' // Reset for same file selection
}

async function openUrl(url?: string) {
  const targetUrl = url || urlInput.value || defaultUrl
  urlDialogVisible.value = false
  
  store.setTextImmediate(JSON.stringify({ action: 'loading...', url: targetUrl }, null, 2))
  
  try {
    const response = await fetch(targetUrl)
    const text = await response.text()
    store.setTextImmediate(text)
    toast.add({ severity: 'success', summary: 'URL loaded', detail: targetUrl, life: 3000 })
  } catch (error) {
    store.setTextImmediate(JSON.stringify({ error: (error as Error).message, url: targetUrl }, null, 2))
    toast.add({ severity: 'error', summary: 'Failed to load URL', detail: (error as Error).message, life: 5000 })
  }
}

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

function onKeyDown(event: KeyboardEvent, pane: string) {
  // Block hotkeys from source pane to prevent conflicts with editor
  if (pane === 'source') return
  
  // Ignore if typing in an input field
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return
  }
  
  // Ignore if modifier keys are pressed (to allow Cmd+F, Ctrl+F, etc.)
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return
  }
  
  switch (event.key) {
    case 'f':
      event.preventDefault()
      store.toggleMaxPane(pane)
      break
    case 'w':
      event.preventDefault()
      store.textWrap = !store.textWrap
      break
    case '[':
      event.preventDefault()
      store.back()
      break
    case ']':
      event.preventDefault()
      store.forward()
      break
  }
}

// Initialize with prop data
watch(() => props.data, (data) => {
  if (data) {
    store.loadData(data)
  }
}, { immediate: true })

// Apply options
watch(() => props.options, (options) => {
  if (options) {
    store.setInitialOptions(options)
  }
}, { immediate: true })

// Select initial path
watch(() => props.initialPath, (path) => {
  if (path && store.tree) {
    store.selectNode(path, true)
  }
}, { immediate: true })

onMounted(() => {
  emit('ready')
})

// Expose for parent access
defineExpose({ openUrl })
</script>

<template>
  <div class="json-tree-table">
    <input
      ref="fileInputRef"
      type="file"
      style="display: none"
      @change="handleFileSelect"
    />
    
    <Dialog
      v-model:visible="urlDialogVisible"
      header="Open URL"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="url-dialog-content">
        <label>URL:</label>
        <InputText v-model="urlInput" :placeholder="defaultUrl" class="url-input" />
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="urlDialogVisible = false" />
        <Button label="Open" @click="openUrl()" />
      </template>
    </Dialog>
    
    <!-- Toolbar (hidden in fullscreen mode) -->
    <div v-if="!maxPane" class="tdv-toolbar">
      <div class="toolbar-left">
        <slot name="title">
          <a href="https://www.treedoc.org" class="app-title">
            <i class="pi pi-sitemap"></i>
            TreeDoc Viewer
          </a>
        </slot>
      </div>
      
      <div class="toolbar-center">
        <div class="tdv-toolbar-group">
          <Button
            icon="pi pi-folder-open"
            size="small"
            text
            @click="openFile"
            v-tooltip.bottom="'Open File'"
          />
          <Button
            icon="pi pi-link"
            size="small"
            text
            @click="urlDialogVisible = true"
            v-tooltip.bottom="'Open URL'"
          />
          <Button
            icon="pi pi-copy"
            size="small"
            text
            :disabled="!rawText"
            @click="copy"
            v-tooltip.bottom="'Copy'"
          />
          <Button
            icon="pi pi-clipboard"
            size="small"
            text
            @click="paste"
            v-tooltip.bottom="'Paste'"
          />
          <Button
            icon="pi pi-code"
            size="small"
            :severity="codeView ? 'primary' : 'secondary'"
            :text="!codeView"
            @click="codeView = !codeView"
            v-tooltip.bottom="'Toggle syntax highlighting'"
          />
          <Button
            icon="pi pi-align-justify"
            size="small"
            text
            @click="format"
            v-tooltip.bottom="'Format'"
          />
        </div>
        
        <div class="tdv-toolbar-group">
          <ToggleButton
            v-model="showSource"
            onLabel="Source"
            offLabel="Source"
            :pt="{ root: { class: 'view-toggle' } }"
          />
          <ToggleButton
            v-model="showTree"
            onLabel="Tree"
            offLabel="Tree"
            :pt="{ root: { class: 'view-toggle' } }"
          />
          <ToggleButton
            v-model="showTable"
            onLabel="Table"
            offLabel="Table"
            :pt="{ root: { class: 'view-toggle' } }"
          />
        </div>
        
        <div class="tdv-toolbar-group" v-if="availableParsers.length > 1">
          <span class="parser-label">Parser:</span>
          <Select
            v-model="selectedParser"
            :options="parserOptions"
            optionLabel="label"
            optionValue="value"
            size="small"
            class="parser-select"
            @change="(e: any) => store.setParser(e.value)"
          />
        </div>
        
        <slot />
      </div>
      
      <div class="toolbar-right">
        <span class="status-message" :class="{ error: hasError }">
          {{ parseResult }}
        </span>
        <Button
          :icon="isDarkMode ? 'pi pi-sun' : 'pi pi-moon'"
          size="small"
          text
          rounded
          @click="themeStore.toggleTheme()"
          v-tooltip.bottom="isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
          class="theme-toggle"
        />
      </div>
    </div>
    
    <!-- Split Panes -->
    <div class="split-container">
      <Splitpanes :key="splitpanesKey" class="default-theme" :horizontal="false">
        <Pane v-if="sourceVisible">
          <div 
            class="pane-wrapper"
            :class="{ 'pane-focused': currentPane === 'source' }"
            @click="currentPane = 'source'"
            @keydown="onKeyDown($event, 'source')"
            tabindex="0"
          >
            <SourceView ref="sourceViewRef" />
          </div>
        </Pane>
        
        <Pane v-if="treeVisible">
          <div 
            class="pane-wrapper"
            :class="{ 'pane-focused': currentPane === 'tree' }"
            @click="currentPane = 'tree'"
            @keydown="onKeyDown($event, 'tree')"
            tabindex="0"
          >
            <TreeView 
              ref="treeViewRef"
              :root-object-key="rootObjectKey"
              :expand-level="1"
            />
          </div>
        </Pane>
        
        <Pane v-if="tableVisible">
          <div 
            class="pane-wrapper"
            :class="{ 'pane-focused': currentPane === 'table' }"
            @click="currentPane = 'table'"
            @keydown="onKeyDown($event, 'table')"
            tabindex="0"
          >
            <TableView ref="tableViewRef" />
          </div>
        </Pane>
      </Splitpanes>
    </div>
  </div>
</template>

<style scoped>
.json-tree-table {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--tdv-bg-gradient);
  background-attachment: fixed;
}

.tdv-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--tdv-surface);
  border-bottom: 1px solid var(--tdv-surface-border);
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--tdv-accent);
  text-decoration: none;
}

.app-title:hover {
  color: var(--tdv-accent-light);
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-toggle {
  width: 36px;
  height: 36px;
}

.parser-label {
  font-size: 0.85rem;
  color: var(--tdv-text-muted);
}

.parser-select {
  min-width: 140px;
}

.view-toggle {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.split-container {
  flex: 1;
  overflow: hidden;
  padding: 8px;
}

.pane-wrapper {
  height: 100%;
  background: var(--tdv-surface);
  border-radius: var(--tdv-radius);
  overflow: hidden;
  outline: none;
  transition: box-shadow 0.2s;
}

.pane-wrapper:focus,
.pane-focused {
  box-shadow: 0 0 0 2px var(--tdv-accent);
}

.url-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.url-input {
  width: 100%;
}

/* Splitpanes theme overrides */
:deep(.splitpanes__splitter) {
  background: transparent;
  min-width: 8px;
  min-height: 8px;
}

:deep(.splitpanes__splitter::before) {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 40px;
  background: var(--tdv-surface-border);
  border-radius: 2px;
  transition: background 0.2s;
}

:deep(.splitpanes--horizontal > .splitpanes__splitter::before) {
  width: 40px;
  height: 4px;
}

:deep(.splitpanes__splitter:hover::before) {
  background: var(--tdv-accent);
}

:deep(.splitpanes__pane) {
  background: transparent;
}
</style>
