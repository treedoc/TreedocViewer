<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Select from 'primevue/select'
import JsonTreeTable from '../components/JsonTreeTable.vue'
import sampleData from '../data/sampleData'
import { useTreeStore } from '../stores/treeStore'

const store = useTreeStore()
const jsonTreeTableRef = ref<InstanceType<typeof JsonTreeTable>>()

// URL parameters (support both query string and hash-based params)
const urlParams = new URLSearchParams(window.location.search)
const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
const embeddedId = urlParams.get('embeddedId') || hashParams.get('embeddedId')
const dataParam = urlParams.get('data') || hashParams.get('data')
const dataUrlParam = urlParams.get('dataUrl') || hashParams.get('dataUrl')
const initialPath = urlParams.get('initialPath') || hashParams.get('initialPath') || '/'
const title = urlParams.get('title') || hashParams.get('title') || 'TreeDoc Viewer'

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

// Handle embedded mode
function setupEmbeddedMode() {
  if (embeddedId) {
    // Notify parent that we're ready
    window.parent.postMessage({ type: 'tdv-ready', id: embeddedId }, '*')
    if (window.opener) {
      window.opener.postMessage({ type: 'tdv-ready', id: embeddedId }, '*')
    }
    
    // Listen for data from parent
    window.addEventListener('message', (evt) => {
      if (evt.data.type === 'tdv-setData') {
        store.loadData(evt.data.data)
      }
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
      :initial-path="initialPath"
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
        <a href="https://github.com/treedoc/TreedocViewer" target="_blank" class="badge-link">
          <img alt="GitHub forks" src="https://img.shields.io/github/forks/treedoc/treedocviewer?style=flat-square" />
        </a>
        <a href="https://www.npmjs.com/package/treedoc-viewer" target="_blank" class="badge-link">
          <img alt="npm" src="https://img.shields.io/npm/v/treedoc-viewer?style=flat-square" />
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
