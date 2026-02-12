<script setup lang="ts">
import { computed, toRaw } from 'vue'
import type { TDNode } from 'treedoc'

const props = defineProps<{
  treeNode: TDNode | null
}>()

const emit = defineEmits<{
  nodeClicked: [path: string[]]
}>()

interface PathItem {
  label: string
  node?: TDNode
}

const items = computed<PathItem[]>(() => {
  const paths: PathItem[] = []
  const node = props.treeNode
  if (!node) return paths

  // Build path from root to current node
  const nodeChain: TDNode[] = []
  let current: TDNode | undefined = node
  while (current) {
    nodeChain.unshift(current)
    current = current.parent as TDNode | undefined
  }

  // Create breadcrumb items (exclude last as it will be the current)
  for (let i = 0; i < nodeChain.length - 1; i++) {
    const n = nodeChain[i]
    paths.push({
      label: n.key || 'root',
      node: n,
    })
  }

  return paths
})

const currentLabel = computed(() => props.treeNode?.key || '')

function handleClick(item: PathItem) {
  if (item.node) {
    emit('nodeClicked', ['', ...item.node.path])
  }
}

function handleHomeClick() {
  if (items.value.length > 0 && items.value[0].node) {
    emit('nodeClicked', ['', ...items.value[0].node.path])
  }
}
</script>

<template>
  <div class="json-path" v-if="treeNode">
    <nav class="breadcrumb-nav">
      <a href="#" class="home-link" @click.prevent="handleHomeClick" v-if="items.length > 0">
        <i class="pi pi-home"></i>
      </a>
      <template v-for="(item, idx) in items" :key="idx">
        <span class="separator">/</span>
        <a href="#" class="path-link" @click.prevent="handleClick(item)">
          {{ item.label }}
        </a>
      </template>
      <span class="separator" v-if="items.length > 0">/</span>
      <span class="current-node">{{ currentLabel }}</span>
    </nav>
  </div>
</template>

<style scoped>
.json-path {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9rem;
}

.breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.home-link {
  color: var(--tdv-text-muted);
  transition: color 0.2s;
}

.home-link:hover {
  color: var(--tdv-accent);
}

.separator {
  color: var(--tdv-text-muted);
  opacity: 0.5;
}

.path-link {
  color: var(--tdv-primary-light);
  cursor: pointer;
  transition: color 0.2s;
  text-decoration: none;
}

.path-link:hover {
  color: var(--tdv-accent);
}

.current-node {
  color: var(--tdv-text-bright);
  font-weight: 600;
}
</style>
