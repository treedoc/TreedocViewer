<script setup lang="ts">
import { ref, reactive, watch, nextTick } from 'vue'
import type { TDNode } from 'treedoc'
import TreeViewItem from './TreeViewItem.vue'
import ExpandControl from './ExpandControl.vue'
import type { ExpandState } from './ExpandControl.vue'
import { useTreeStore } from '../stores/treeStore'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  rootObjectKey?: string
  expandLevel?: number
}>()

const store = useTreeStore()
const { tree, selectedNode } = storeToRefs(store)

const expandControlRef = ref<InstanceType<typeof ExpandControl>>()
const treeItemRef = ref<InstanceType<typeof TreeViewItem>>()

const expandState = reactive<ExpandState>({
  expandLevel: props.expandLevel || 0, // Changed from 1 to 0 - don't auto-expand for large files
  minLevel: 1,
  fullyExpand: false,
  moreLevel: false,
  showChildrenSummary: true,
})

function nodeClicked(path: string[]) {
  store.selectNode(path)
}

function onKeyPress(e: KeyboardEvent) {
  expandControlRef.value?.onKeyPress(e)
}

// Watch for selection changes to update tree view
watch(selectedNode, (newNode, oldNode) => {
  // Defer the expensive tree traversal to not block the UI
  requestIdleCallback(() => {
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
  }, { timeout: 100 }) // Force execution within 100ms if browser is busy
})

// Reset expand state when tree changes
watch(tree, () => {
  expandState.expandLevel = props.expandLevel || 1
  expandState.fullyExpand = false
  expandState.moreLevel = false
})

defineExpose({ onKeyPress })
</script>

<template>
  <div class="tree-view" @keypress="onKeyPress" tabindex="0">
    <div class="tree-header">
      <span class="panel-title">Tree View</span>
      <ExpandControl ref="expandControlRef" :state="expandState" :active="true" />
    </div>
    
    <div class="tree-content">
      <TreeViewItem
        v-if="tree"
        ref="treeItemRef"
        class="root-item"
        :tnode="tree.root"
        :current-level="0"
        :expand-state="expandState"
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
