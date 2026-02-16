<script setup lang="ts">
import { ref, reactive, watch, nextTick, toRaw, shallowRef, computed, onMounted } from 'vue'
import type { TDNode, TreeDoc } from 'treedoc'
import { TDNodeType } from 'treedoc'
import { storeToRefs } from 'pinia'
import TreeViewItem from './TreeViewItem.vue'
import ExpandControl from './ExpandControl.vue'
import type { ExpandState } from './ExpandControl.vue'
import { useTreeStore } from '../stores/treeStore'
import { Logger } from '@/utils/Logger'
import { debounce } from 'lodash-es'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const logger = new Logger('TreeView')

const props = defineProps<{
  rootObjectKey?: string
  expandLevel?: number
}>()

const store = useTreeStore()
const { showTreeFilter, treeFilterQuery } = storeToRefs(store)

const localTree = shallowRef<TreeDoc | null>(null)
const localSelectedNode = shallowRef<TDNode | null>(null)

const expandControlRef = ref<InstanceType<typeof ExpandControl>>()
const treeItemRef = ref<InstanceType<typeof TreeViewItem>>()

// Filter state (persisted in store: showTreeFilter, treeFilterQuery)
const activeFilter = ref('')  // The actual filter applied after debounce
const matchCount = ref(0)
const currentMatchIndex = ref(-1)
const matchedNodes = ref<TDNode[]>([])

function toggleFilter() {
  showTreeFilter.value = !showTreeFilter.value
  if (!showTreeFilter.value) {
    clearFilterState()
  }
}

function clearFilterState() {
  treeFilterQuery.value = ''
  activeFilter.value = ''
  matchCount.value = 0
  currentMatchIndex.value = -1
  matchedNodes.value = []
}

const expandState = reactive<ExpandState>({
  expandLevel: props.expandLevel || 1,
  minLevel: 1,
  fullyExpand: false,
  moreLevel: false,
  showChildrenSummary: true,
})

const rawTree = computed(() => {
  const t = localTree.value
  return t ? toRaw(t) : null
})

function nodeClicked(path: string[]) {
  store.selectNode(path)
}

function onKeyPress(e: KeyboardEvent) {
  expandControlRef.value?.onKeyPress(e)
}

// Check if a node or any descendant matches the filter
function nodeMatchesFilter(node: TDNode, query: string): boolean {
  if (!query) return true
  
  const queryLower = query.toLowerCase()
  
  // Check if key matches
  if (node.key?.toLowerCase().includes(queryLower)) {
    return true
  }
  
  // Check if value matches (for simple types)
  if (node.type === TDNodeType.SIMPLE && node.value !== null) {
    if (String(node.value).toLowerCase().includes(queryLower)) {
      return true
    }
  }
  
  // Check children recursively
  if (node.children) {
    for (const child of node.children) {
      if (nodeMatchesFilter(child, query)) {
        return true
      }
    }
  }
  
  return false
}

// Collect all matched nodes for navigation
function collectMatches(node: TDNode, query: string, results: TDNode[]): void {
  if (!query) return
  
  const queryLower = query.toLowerCase()
  
  // Check if this node itself matches
  const keyMatches = node.key?.toLowerCase().includes(queryLower)
  let valueMatches = false
  if (node.type === TDNodeType.SIMPLE && node.value !== null) {
    valueMatches = String(node.value).toLowerCase().includes(queryLower)
  }
  
  if (keyMatches || valueMatches) {
    results.push(node)
  }
  
  // Search children
  if (node.children) {
    for (const child of node.children) {
      collectMatches(child, query, results)
    }
  }
}

// Debounced filter application
const applyFilter = debounce(() => {
  activeFilter.value = treeFilterQuery.value
  
  if (!treeFilterQuery.value || !localTree.value) {
    matchCount.value = 0
    currentMatchIndex.value = -1
    matchedNodes.value = []
    return
  }
  
  // Collect matches for navigation
  const results: TDNode[] = []
  collectMatches(localTree.value.root, treeFilterQuery.value, results)
  matchedNodes.value = results
  matchCount.value = results.length
  
  // Just set the index to 0 without navigating - user must click next/prev to navigate
  if (results.length > 0) {
    currentMatchIndex.value = 0
  } else {
    currentMatchIndex.value = -1
  }
}, 300)

function goToMatch(index: number) {
  if (index < 0 || index >= matchedNodes.value.length) return
  
  currentMatchIndex.value = index
  const node = matchedNodes.value[index]
  
  if (node && treeItemRef.value) {
    // Only expand and scroll to the node, don't update the global selection
    treeItemRef.value.selectNode(node.path, 0, (nodeController: any) => {
      // Scroll the specific matched node into view
      nodeController.scrollIntoView()
    })
  }
}

function nextMatch() {
  if (matchedNodes.value.length === 0) return
  const nextIndex = (currentMatchIndex.value + 1) % matchedNodes.value.length
  goToMatch(nextIndex)
}

function prevMatch() {
  if (matchedNodes.value.length === 0) return
  const prevIndex = currentMatchIndex.value <= 0 
    ? matchedNodes.value.length - 1 
    : currentMatchIndex.value - 1
  goToMatch(prevIndex)
}

function clearFilter() {
  clearFilterState()
}

function onFilterKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      prevMatch()
    } else {
      nextMatch()
    }
    e.preventDefault()
  } else if (e.key === 'Escape') {
    clearFilter()
  }
}

// Watch filter query changes - immediate: true ensures filter is applied on mount
watch(treeFilterQuery, () => {
  applyFilter()
}, { immediate: true })

watch(
  () => store.nodeVersion,
  () => {
    const oldNode = localSelectedNode.value
    const newNode = store.getRawSelectedNode()
    localSelectedNode.value = newNode
    
    logger.log('Selection changed, updating tree view')
    if (oldNode && treeItemRef.value) {
      treeItemRef.value.selectNode(oldNode.path, 0, (node: any) => {
        node.selected = false
      })
    }
    if (newNode && treeItemRef.value) {
      treeItemRef.value.selectNode(newNode.path, 0, (node: any) => {
        node.selected = true
      })
    }
    logger.log(`watch: selected: end`)
  }
)

watch(
  () => store.tree,
  () => {
    localTree.value = store.getRawTree()
    logger.log('Tree changed, resetting expand state')
    expandState.expandLevel = props.expandLevel || 1
    expandState.fullyExpand = false
    expandState.moreLevel = false
  },
  { immediate: true }
)

// Restore selected node highlighting on mount (e.g., after fullscreen toggle)
onMounted(() => {
  nextTick(() => {
    const selectedNode = store.getRawSelectedNode()
    if (selectedNode && treeItemRef.value) {
      localSelectedNode.value = selectedNode
      treeItemRef.value.selectNode(selectedNode.path, 0, (node: any) => {
        node.selected = true
      })
    }
  })
})

defineExpose({ onKeyPress })
</script>

<template>
  <div class="tree-view" @keypress="onKeyPress" tabindex="0">
    <div class="tree-header">
      <span class="panel-title">Tree View</span>
      <div class="header-controls">
        <Button
          icon="pi pi-filter"
          size="small"
          text
          :severity="showTreeFilter ? 'primary' : 'secondary'"
          @click="toggleFilter"
          v-tooltip.top="'Filter nodes'"
        />
        <ExpandControl ref="expandControlRef" :state="expandState" :active="true" />
      </div>
    </div>
    
    <div v-if="showTreeFilter" class="filter-bar">
      <i class="pi pi-filter filter-icon"></i>
      <InputText
        v-model="treeFilterQuery"
        placeholder="Filter nodes..."
        class="filter-input"
        @keydown="onFilterKeydown"
      />
      <Button
        v-if="treeFilterQuery"
        icon="pi pi-times"
        size="small"
        text
        severity="secondary"
        @click="clearFilter"
        v-tooltip.top="'Clear (Esc)'"
      />
      <template v-if="activeFilter">
        <Button
          icon="pi pi-chevron-up"
          size="small"
          text
          :disabled="matchCount === 0"
          @click="prevMatch"
          v-tooltip.top="'Previous (Shift+Enter)'"
        />
        <Button
          icon="pi pi-chevron-down"
          size="small"
          text
          :disabled="matchCount === 0"
          @click="nextMatch"
          v-tooltip.top="'Next (Enter)'"
        />
        <span v-if="matchCount > 0" class="match-count">
          {{ currentMatchIndex + 1 }} / {{ matchCount }}
        </span>
        <span v-else class="no-matches">
          No matches
        </span>
      </template>
    </div>
    
    <div class="tree-content">
      <TreeViewItem
        v-if="rawTree"
        ref="treeItemRef"
        class="root-item"
        :tnode="rawTree.root"
        :current-level="0"
        :expand-state="expandState"
        :filter-query="activeFilter"
        @node-clicked="nodeClicked"
      />
      <div v-else class="no-data">
        <i class="pi pi-inbox"></i>
        <span>No Data</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  outline: none;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--tdv-surface-light);
  border-bottom: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius) var(--tdv-radius) 0 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--tdv-surface);
  border-bottom: 1px solid var(--tdv-surface-border);
}

.filter-icon {
  color: var(--tdv-text-muted);
  font-size: 0.9rem;
}

.filter-input {
  flex: 1;
  min-width: 150px;
}

.match-count {
  font-size: 0.8rem;
  color: var(--tdv-text-muted);
  white-space: nowrap;
  padding: 0 8px;
}

.no-matches {
  font-size: 0.8rem;
  color: var(--tdv-warning);
  white-space: nowrap;
  padding: 0 8px;
}

.tree-content {
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.root-item {
  margin-left: 0 !important;
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--tdv-text-muted);
  gap: 8px;
}

.no-data i {
  font-size: 2rem;
}
</style>
