<script setup lang="ts">
import { computed } from 'vue'
import type { TDNode } from 'treedoc'

const props = defineProps<{
  tnode: TDNode
  isInTable?: boolean
  textWrap?: boolean
}>()

const emit = defineEmits<{
  nodeClicked: [path: string]
}>()

const KEY_REF = '$ref'
const START_TIME = new Date('1980-01-01').getTime()
const END_TIME = new Date('2040-01-01').getTime()

function tryDate(val: number): Date | null {
  if (val > START_TIME && val < END_TIME) {
    return new Date(val)
  }
  return null
}

const ref = computed(() => {
  if (props.tnode.key !== KEY_REF || typeof props.tnode.value !== 'string') {
    return null
  }
  return props.tnode.value
})

const date = computed(() => {
  const val = Number(props.tnode.value)
  if (isNaN(val)) return null
  const d = tryDate(val) || tryDate(val * 1000) || tryDate(val / 1000_000)
  return d ? d.toISOString() : null
})

const refAbsolute = computed(() => {
  let result = ref.value
  if (result && result.startsWith('../')) {
    result = props.tnode.parent?.pathAsString + '/' + result
  }
  return result
})

const url = computed(() => {
  const val = props.tnode.value
  if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
    return val
  }
  return null
})

const valueStyle = computed(() => {
  const val = props.tnode.value
  if (val === null) return 'value-null'
  if (typeof val === 'string') return 'value-string'
  if (typeof val === 'boolean') return 'value-boolean'
  return 'value-number'
})

const whiteSpaceStyle = computed(() => (props.textWrap ? 'pre-wrap' : 'pre'))

function handleRefClick() {
  if (refAbsolute.value) {
    emit('nodeClicked', refAbsolute.value)
  }
}
</script>

<template>
  <span class="simple-value">
    <template v-if="ref">
      <a href="#" class="ref-link" @click.prevent="handleRefClick">{{ ref }}</a>
    </template>
    <template v-else-if="url">
      <a :href="url" target="_blank" class="url-link">{{ url }}</a>
    </template>
    <template v-else-if="isInTable">
      <pre class="value-pre" :class="valueStyle" :style="{ whiteSpace: whiteSpaceStyle }">{{ tnode.value }}</pre>
      <span v-if="date" class="date-hint">{{ date }}</span>
    </template>
    <template v-else>
      <span :class="valueStyle">{{ tnode.value }}</span>
      <span v-if="date" class="date-hint"> ({{ date }})</span>
    </template>
  </span>
</template>

<style scoped>
.simple-value {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9rem;
}

.ref-link {
  color: var(--tdv-primary);
  text-decoration: underline;
  cursor: pointer;
  font-weight: 500;
}

.ref-link:hover {
  color: var(--tdv-primary-light);
}

.url-link {
  color: var(--tdv-primary);
  word-break: break-all;
}

.url-link:hover {
  color: var(--tdv-primary-light);
}

.value-pre {
  margin: 0;
  font-family: inherit;
  overflow-wrap: anywhere;
}

.date-hint {
  color: var(--tdv-text-muted);
  font-size: 0.75rem;
  font-style: italic;
  display: block;
  margin-top: 2px;
}
</style>
