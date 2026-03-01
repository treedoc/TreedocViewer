<script setup lang="ts">
import { ref, computed, watch, nextTick, toRaw, type ComponentPublicInstance } from 'vue'
import type { TDNode } from 'treedoc'
import { TDNodeType, TDJSONWriter, TDJSONWriterOption } from 'treedoc'
import SimpleValue from './SimpleValue.vue'
import HoverButtonBar, { type HoverButton } from './HoverButtonBar.vue'
import type { ExpandState } from './ExpandControl.vue'
import TreeUtil from '@/utils/TreeUtil'
import { Logger } from '@/utils/Logger'

const logger = new Logger('TreeViewItem')
const PAGE_SIZE = 1000

function getRawNode(node: TDNode): TDNode {
  return toRaw(node)
}

interface TreeViewItemInstance extends ComponentPublicInstance {
  tnode: TDNode
  selected: boolean
  selectNode: (path: string[], start: number, action: (node: any) => void) => void
}

const props = defineProps<{
  tnode: TDNode
  currentLevel: number
  expandState: ExpandState
  filterQuery?: string
}>()

const emit = defineEmits<{
  nodeClicked: [path: string[]]
}>()

const open = ref(false)
const selected = ref(false)
const limit = ref(PAGE_SIZE)
const childrenRefs = ref<TreeViewItemInstance[]>([])
const isHovered = ref(false)
const nodeRowRef = ref<HTMLElement | null>(null)

const rawNode = computed(() => getRawNode(props.tnode))

const isSimpleType = computed(() => rawNode.value.type === TDNodeType.SIMPLE)

// Check if this node or any descendant matches the filter
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

const isVisible = computed(() => {
  if (!props.filterQuery) return true
  return nodeMatchesFilter(rawNode.value, props.filterQuery)
})

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  if (!text) return text
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Highlight matched text by wrapping in <mark> tags
function highlightText(text: string, query: string): string {
  if (!query || !text) return escapeHtml(text)
  
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  const index = textLower.indexOf(queryLower)
  
  if (index === -1) return escapeHtml(text)
  
  const before = text.substring(0, index)
  const match = text.substring(index, index + query.length)
  const after = text.substring(index + query.length)
  
  // Recursively highlight remaining text
  return escapeHtml(before) + '<mark class="highlight">' + escapeHtml(match) + '</mark>' + highlightText(after, query)
}

const highlightedKey = computed(() => {
  const key = rawNode.value.key
  if (!key || !props.filterQuery) return key
  return highlightText(key, props.filterQuery)
})

const nodeKey = computed(() => rawNode.value.key)

const label = computed(() => TreeUtil.getTypeSizeLabel(rawNode.value, !open.value && props.expandState.showChildrenSummary));

const visibleChildren = computed(() => {
  const node = rawNode.value
  if (!node.children) return []
  return node.children.slice(0, limit.value)
})

const hasMoreChildren = computed(() => {
  return (rawNode.value.getChildrenSize() || 0) > limit.value
})

function toggleOpen() {
  open.value = !open.value
}

function handleNodeClick() {
  emit('nodeClicked', ['', ...rawNode.value.path])
}

function loadMore() {
  limit.value += PAGE_SIZE
}

function copyNode() {
  const node = rawNode.value
  let text: string
  // For simple values, copy the raw value without JSON quoting/escaping
  if (node.type === TDNodeType.SIMPLE) {
    text = node.value === null ? 'null' : String(node.value)
  } else {
    // For complex values (objects/arrays), use JSON formatting
    text = TDJSONWriter.get().writeAsString(node, new TDJSONWriterOption().setIndentFactor(2))
  }
  navigator.clipboard.writeText(text)
}

function getJsPath(): string {
  const path = rawNode.value.path
  return path.map((key, idx) => {
    // Check if key is a valid JS identifier
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
      return idx === 0 ? key : `.${key}`
    }
    // Use bracket notation for numeric keys or invalid identifiers
    if (/^\d+$/.test(key)) {
      return `[${key}]`
    }
    return `['${key.replace(/'/g, "\\'")}']`
  }).join('')
}

function copyPath() {
  const path = getJsPath()
  navigator.clipboard.writeText(path)
}

// Button definitions for the hover button bar
const nodeButtons: HoverButton[] = [
  { id: 'copy-path', icon: 'pi-link', title: 'Copy path', variant: 'link' },
  { id: 'copy-node', icon: 'pi-copy', title: 'Copy node', variant: 'copy' }
]

function handleNodeButtonClick(buttonId: string) {
  switch (buttonId) {
    case 'copy-path':
      copyPath()
      break
    case 'copy-node':
      copyNode()
      break
  }
}

function selectNode(path: string[], start: number, action: (node: typeof props) => void) {
  logger.log(`selectNode: start: ${path}, ${start}`)
  if (start === path.length) {
    // Call action with an object that allows modifying selected state and accessing DOM element
    const nodeController = {
      ...props,
      get selected() { return selected.value },
      set selected(val: boolean) { selected.value = val },
      get element() { return nodeRowRef.value },
      scrollIntoView() {
        nextTick(() => {
          nodeRowRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })
      }
    }
    action(nodeController as any)
    return
  }

  open.value = true
  nextTick(() => {
    for (const item of childrenRefs.value) {
      if (item.tnode.key === path[start]) {
        item.selectNode(path, start + 1, action)
      }
    }
  })
}

function bubbleEvent(data: string[], eventName: string) {
  logger.log(`bubbleEvent: start: ${data}, ${eventName}`)  
  emit(eventName as 'nodeClicked', data)
}

watch(
  () => [props.expandState.expandLevel, props.expandState.fullyExpand, props.expandState.moreLevel] as const,
  () => {
    logger.log(`watch: expand state: start`)
    if (rawNode.value.isLeaf()) return

    const state = props.expandState
    open.value = state.fullyExpand || props.currentLevel < state.expandLevel

    if (state.fullyExpand) {
      if (props.currentLevel + 1 > state.expandLevel) {
        state.expandLevel = props.currentLevel + 1
      }
    } else if (!state.moreLevel) {
      if (props.currentLevel > state.expandLevel - 1) {
        state.moreLevel = true
      }
    }
  },
  { immediate: true }
)

watch(selected, (isSelected) => {
  logger.log(`watch: selected: start`)
  if (isSelected) {
    nextTick(() => {
      const el = document.querySelector('.node-key.selected')
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }
})

defineExpose({ selectNode, tnode: rawNode, selected })
</script>

<template>
  <div class="tree-item" v-show="isVisible">
    <div v-if="!isSimpleType" class="tree-node">
      <div 
        ref="nodeRowRef"
        class="node-row" 
        @click.stop="toggleOpen"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
      >
        <span class="toggle-icon" :class="{ opened: open }">
          <i class="pi pi-chevron-right"></i>
        </span>
        <a 
          href="#" 
          class="node-key" 
          :class="{ selected }"
          @click.stop.prevent="handleNodeClick"
          v-html="highlightedKey"
        ></a>
        <span class="node-label">{{ label }}</span>
        <HoverButtonBar
          :buttons="nodeButtons"
          :is-visible="isHovered"
          layout="inline"
          @click="handleNodeButtonClick"
        />
      </div>
      
      <template v-if="open">
        <TreeViewItem
          v-for="cn in visibleChildren"
          :key="cn.key"
          ref="childrenRefs"
          :tnode="cn"
          :current-level="currentLevel + 1"
          :expand-state="expandState"
          :filter-query="filterQuery"
          @node-clicked="bubbleEvent($event, 'nodeClicked')"
        />
        <a 
          v-if="hasMoreChildren"
          href="#" 
          class="load-more"
          @click.prevent="loadMore"
        >
          ... Load next {{ PAGE_SIZE }} items
        </a>
      </template>
    </div>
    
    <div 
      v-else 
      ref="nodeRowRef"
      class="leaf-node"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <span class="node-key leaf-key" v-html="highlightedKey"></span>:
      <SimpleValue :tnode="rawNode" :filter-query="filterQuery" @node-clicked="emit('nodeClicked', [$event])" />
      <HoverButtonBar
        :buttons="nodeButtons"
        :is-visible="isHovered"
        layout="inline"
        @click="handleNodeButtonClick"
      />
    </div>
  </div>
</template>

<style scoped>
.tree-item {
  font-size: 0.9rem;
  margin-left: 18px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.tree-node {
  white-space: nowrap;
}

.node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  transition: background 0.15s;
}

.node-row:hover {
  background: var(--tdv-hover-bg);
}

.toggle-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--tdv-text-muted);
  transition: transform 0.15s;
}

.toggle-icon.opened {
  transform: rotate(90deg);
}

.toggle-icon i {
  font-size: 10px;
}

.node-key {
  color: var(--tdv-key);
  text-decoration: none;
  font-weight: 600;
}

.node-key:hover {
  color: var(--tdv-primary-light);
  text-decoration: underline;
}

.node-key.selected {
  background: #ffc107;
  color: #000;
  font-weight: 600;
}

.leaf-key {
  cursor: default;
  color: var(--tdv-text);
}

.node-label {
  color: var(--tdv-text-muted);
  font-size: 0.8rem;
}

.leaf-node {
  padding: 3px 6px;
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.load-more {
  color: var(--tdv-primary);
  font-size: 0.8rem;
  margin-left: 20px;
  display: block;
}

.load-more:hover {
  color: var(--tdv-primary-light);
}

/* Highlight for matched filter text - use :deep() since v-html content is not affected by scoped styles */
:deep(.highlight) {
  background-color: #ffc107;
  color: #000;
  padding: 0 1px;
  border-radius: 2px;
}
</style>
