<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import Select from 'primevue/select'
import JsonTreeTable from '../components/JsonTreeTable.vue'
import sampleData from '../data/sampleData'
import { useTreeStore } from '../stores/treeStore'
import { TDJSONParser } from 'treedoc'
import type { TDVOptions } from '../models/types'

const store = useTreeStore()
const jsonTreeTableRef = ref<InstanceType<typeof JsonTreeTable>>()

// URL parameters (support both query string and hash-based params)
const urlParams = new URLSearchParams(window.location.search)
const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
const embeddedId = urlParams.get('embeddedId') || hashParams.get('embeddedId')
const dataParam = urlParams.get('data') || hashParams.get('data')
const dataUrlParam = urlParams.get('dataUrl') || hashParams.get('dataUrl')
const initialPathParam = urlParams.get('initialPath') || hashParams.get('initialPath') || '/'
const titleParam = urlParams.get('title') || hashParams.get('title')
// Preset parameter - JSONEx encoded preset to apply after data loads
const presetParam = urlParams.get('preset') || hashParams.get('preset') || undefined

// Option parameter - JSONEx encoded view options (e.g. {maxPane:table}) applied
// on mount. Lets an embedder open straight into a maximized table/chart view.
const optionParam = urlParams.get('option') || hashParams.get('option') || undefined
const eventOptions = ref<TDVOptions | undefined>()
const eventPresetParam = ref<string | undefined>()
const eventInitialPath = ref(initialPathParam)

const urlOptions = computed<TDVOptions | undefined>(() => {
  if (!optionParam) return undefined
  try {
    return TDJSONParser.get().parse(optionParam).toObject(false) as TDVOptions
  } catch (e) {
    console.error('[Home] Failed to parse option param:', e)
    return undefined
  }
})
const options = computed<TDVOptions | undefined>(() => {
  if (!urlOptions.value) return eventOptions.value
  if (!eventOptions.value) return urlOptions.value
  return { ...urlOptions.value, ...eventOptions.value }
})
const initialPreset = computed(() => eventPresetParam.value ?? presetParam)
const title = computed(() => options.value?.title || titleParam || 'TreeDoc Viewer')

// Sample data selection
const selectedSample = ref<typeof sampleData[0] | null>(null)
const sampleOptions = computed(() => 
  sampleData.map(s => ({ label: s.text, value: s }))
)

function handleSampleChange(event: any) {
  const sample = event.value
  if (sample) {
    store.loadData(sample.value)
  }
}

function parseOptionsParam(value: unknown): TDVOptions | undefined {
  if (!value) return undefined
  if (typeof value === 'string') {
    try {
      return TDJSONParser.get().parse(value).toObject(false) as TDVOptions
    } catch (e) {
      console.error('[Home] Failed to parse event option:', e)
      return undefined
    }
  }
  if (typeof value === 'object') return value as TDVOptions
  return undefined
}

function parsePresetParam(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return undefined
}

function applyEventConfig() {
  nextTick(() => {
    jsonTreeTableRef.value?.applyPresetConfig(initialPreset.value, options.value, { immediate: true })
  })
}

// Handle embedded mode
function setupEmbeddedMode() {
  if (embeddedId) {
    // Notify parent that we're ready
    window.parent.postMessage({ type: 'tdv-ready', id: embeddedId }, '*')
    if (window.opener) {
      window.opener.postMessage({ type: 'tdv-ready', id: embeddedId }, '*')
    }
    
    // Listen for data/config from parent
    window.addEventListener('message', (evt) => {
      if (evt.data?.type !== 'tdv-setData' && evt.data?.type !== 'tdv-setOptions') {
        return
      }

      const nextOptions = parseOptionsParam(evt.data.options ?? evt.data.option)
      if (nextOptions) eventOptions.value = nextOptions

      const nextPreset = parsePresetParam(evt.data.preset ?? evt.data.initialPreset)
      if (nextPreset !== undefined) eventPresetParam.value = nextPreset

      if (typeof evt.data.initialPath === 'string') {
        eventInitialPath.value = evt.data.initialPath
      }

      if (evt.data.type === 'tdv-setData') {
        store.loadData(evt.data.data)
      }

      applyEventConfig()
    })
  }
}

onMounted(async () => {
  setupEmbeddedMode()
  
  // Load data from URL param
  if (dataParam) {
    // Check if dataParam is a localStorage key (starts with tdv_temp_)
    if (dataParam.startsWith('tdv_temp_')) {
      const storedData = localStorage.getItem(dataParam)
      if (storedData) {
        store.loadData(storedData)
        localStorage.removeItem(dataParam)
        // Clean up the URL
        window.history.replaceState({}, '', window.location.pathname + '#/')
      } else {
        store.loadData('{}')
      }
    } else {
      store.loadData(dataParam)
    }
  } else if (dataUrlParam) {
    // Load from URL when component is ready
    setTimeout(() => {
      jsonTreeTableRef.value?.openUrl(dataUrlParam)
    }, 100)
  } else if (!embeddedId) {
    // Load empty object by default
    store.loadData('{}')
  }
})

// Sync sample selection with loaded data
watch(() => store.rawText, (text) => {
  // Check if current text matches a sample
  const matchingSample = sampleData.find(s => {
    if (typeof s.value === 'string') {
      return s.value.trim() === text.trim()
    }
    return JSON.stringify(s.value, null, 2).trim() === text.trim()
  })
  if (matchingSample) {
    selectedSample.value = matchingSample
  }
})
</script>

<template>
  <div class="home-container">
    <JsonTreeTable
      ref="jsonTreeTableRef"
      :initial-path="eventInitialPath"
      :initial-preset="initialPreset"
      :options="options"
      :title="title"
      root-object-key="root"
    >
      <template #title>
        <a href="https://www.treedoc.org" class="app-title">
          <i class="pi pi-sitemap"></i>
          <strong>{{ title }}</strong>
        </a>
      </template>
      
      <div class="sample-selector" v-if="!embeddedId && !dataParam && !dataUrlParam">
        <span class="sample-label">Sample:</span>
        <Select
          v-model="selectedSample"
          :options="sampleOptions"
          optionLabel="label"
          optionValue="value"
          size="small"
          class="sample-select"
          @change="handleSampleChange"
        />
      </div>
      
      <div class="badges">
        <a href="/v1/" class="version-link" title="Switch to legacy version (Vue 2)">v1</a>
        <a href="https://github.com/treedoc/TreedocViewer/issues" target="_blank" class="badge-link">
          <img alt="GitHub issues" src="https://img.shields.io/github/issues/treedoc/treedocviewer?style=flat-square" />
        </a>
      </div>
    </JsonTreeTable>
  </div>
</template>

<style scoped>
.home-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  color: var(--tdv-accent);
  text-decoration: none;
  white-space: nowrap;
}

.app-title:hover {
  color: var(--tdv-accent-light);
}

.sample-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-left: 1px solid var(--tdv-surface-border);
}

.sample-label {
  font-size: 0.85rem;
  color: var(--tdv-text-muted);
  white-space: nowrap;
}

.sample-select {
  min-width: 120px;
}

.badges {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  border-left: 1px solid var(--tdv-surface-border);
}

.version-link {
  display: flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--tdv-text-muted);
  background: var(--tdv-surface-light);
  border: 1px solid var(--tdv-surface-border);
  border-radius: 4px;
  text-decoration: none;
  opacity: 0.8;
  transition: all 0.2s;
}

.version-link:hover {
  opacity: 1;
  color: var(--tdv-primary);
  border-color: var(--tdv-primary);
}

.badge-link {
  display: flex;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.badge-link:hover {
  opacity: 1;
}

@media (max-width: 768px) {
  .badges {
    display: none;
  }
  
  .sample-selector {
    display: none;
  }
}
</style>
