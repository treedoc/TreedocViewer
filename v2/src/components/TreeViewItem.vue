<script setup lang="ts">
import { ref, computed, watch, nextTick, type ComponentPublicInstance } from 'vue'
import type { TDNode } from 'treedoc'
import { TDNodeType } from 'treedoc'
import SimpleValue from './SimpleValue.vue'
import type { ExpandState } from './ExpandControl.vue'
import TreeUtil from '@/utils/TreeUtil'

const PAGE_SIZE = 2000

interface TreeViewItemInstance extends ComponentPublicInstance {
  tnode: TDNode
  selected: boolean
  selectNode: (path: string[], start: number, action: (node: any) => void) => void
}

const props = defineProps<{
  tnode: TDNode
  currentLevel: number
  expandState: ExpandState
}>()

const emit = defineEmits<{
  nodeClicked: [path: string[]]
}>()

const open = ref(false)
const selected = ref(false)
const limit = ref(PAGE_SIZE)
const childrenRefs = ref<TreeViewItemInstance[]>([])

const isSimpleType = computed(() => props.tnode.type === TDNodeType.SIMPLE)

const label = computed(() => TreeUtil.getTypeSizeLabel(props.tnode, !open.value && props.expandState.showChildrenSummary));
// {
//   const node = props.tnode
//   if (node.type === TDNodeType.SIMPLE) return ''
  
//   const size = node.getChildrenSize()
//   const typeLabel = node.type === TDNodeType.ARRAY ? '[]' : '{}'
  
//   if (!open.value && props.expandState.showChildrenSummary && size > 0) {
//     // Show summary of children
//     const children = node.children?.slice(0, 3) || []
//     const preview = children.map(c => {
//       if (c.type === TDNodeType.SIMPLE) {
//         const val = c.value
//         if (typeof val === 'string' && val.length > 20) {
//           return `"${val.substring(0, 20)}..."`
//         }
//         return JSON.stringify(val)
//       }
//       return c.type === TDNodeType.ARRAY ? '[...]' : '{...}'
//     }).join(', ')
    
//     return `${typeLabel} ${size} ${size > 3 ? `(${preview}, ...)` : `(${preview})`}`
//   }
  
//   return `${typeLabel} ${size}`
// }
// )

const visibleChildren = computed(() => {
  if (!props.tnode.children) return []
  return props.tnode.children.slice(0, limit.value)
})

const hasMoreChildren = computed(() => {
  return (props.tnode.getChildrenSize() || 0) > limit.value
})

function toggleOpen() {
  open.value = !open.value
}

function handleNodeClick() {
  emit('nodeClicked', ['', ...props.tnode.path])
}

function loadMore() {
  limit.value += PAGE_SIZE
}

function selectNode(path: string[], start: number, action: (node: typeof props) => void) {
  if (start === path.length) {
    // Call action with an object that allows modifying selected state
    const nodeController = {
      ...props,
      get selected() { return selected.value },
      set selected(val: boolean) { selected.value = val }
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
  emit(eventName as 'nodeClicked', data)
}

// Watch expand state changes
watch(
  () => props.expandState,
  () => {
    if (props.tnode.isLeaf()) return

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
  { immediate: true, deep: true }
)

// Watch selected state to scroll into view
watch(selected, (isSelected) => {
  if (isSelected) {
    nextTick(() => {
      const el = document.querySelector('.node-key.selected')
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }
})

// Expose for parent access
defineExpose({ selectNode, tnode: props.tnode, selected })
</script>

<template>
  <div class="tree-item">
    <div v-if="!isSimpleType" class="tree-node">
      <div class="node-row" @click.stop="toggleOpen">
        <span class="toggle-icon" :class="{ opened: open }">
          <i class="pi pi-chevron-right"></i>
        </span>
        <a 
          href="#" 
          class="node-key" 
          :class="{ selected }"
          @click.stop.prevent="handleNodeClick"
        >
          {{ tnode.key }}
        </a>
        <span class="node-label">{{ label }}</span>
      </div>
      
      <template v-if="open">
        <TreeViewItem
          v-for="cn in visibleChildren"
          :key="cn.key"
          ref="childrenRefs"
          :tnode="cn"
          :current-level="currentLevel + 1"
          :expand-state="expandState"
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
    
    <div v-else class="leaf-node">
      <span class="node-key leaf-key">{{ tnode.key }}</span>:
      <SimpleValue :tnode="tnode" @node-clicked="emit('nodeClicked', [$event])" />
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
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
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
</style>
