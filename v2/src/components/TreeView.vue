<script setup lang="ts">
import { ref, reactive, watch, nextTick, toRaw, shallowRef, computed } from 'vue'
import type { TDNode, TreeDoc } from 'treedoc'
import TreeViewItem from './TreeViewItem.vue'
import ExpandControl from './ExpandControl.vue'
import type { ExpandState } from './ExpandControl.vue'
import { useTreeStore } from '../stores/treeStore'
import { Logger } from '@/utils/Logger'

const logger = new Logger('TreeView')

const props = defineProps<{
  rootObjectKey?: string
  expandLevel?: number
}>()

const store = useTreeStore()

const localTree = shallowRef<TreeDoc | null>(null)
const localSelectedNode = shallowRef<TDNode | null>(null)

const expandControlRef = ref<InstanceType<typeof ExpandControl>>()
const treeItemRef = ref<InstanceType<typeof TreeViewItem>>()

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
        v-if="rawTree"
        ref="treeItemRef"
        class="root-item"
        :tnode="rawTree.root"
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
