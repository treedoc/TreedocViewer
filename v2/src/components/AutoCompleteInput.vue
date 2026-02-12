<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import InputText from 'primevue/inputtext'

const MAX_RECENT_ITEMS = 10

const props = defineProps<{
  modelValue: string
  placeholder?: string
  storageKey: string
  inputClass?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'blur': []
  'enter': []
}>()

const recentValues = ref<string[]>([])
const showSuggestions = ref(false)
const selectedIndex = ref(-1)

const filteredValues = computed(() => {
  if (!props.modelValue) return recentValues.value
  const query = props.modelValue.toLowerCase()
  return recentValues.value.filter(item => item.toLowerCase().includes(query))
})

function loadRecentValues(): string[] {
  try {
    const stored = localStorage.getItem(props.storageKey)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveRecentValue(value: string) {
  if (!value || !value.trim()) return
  
  let values = loadRecentValues()
  // Remove if already exists
  values = values.filter(v => v !== value)
  // Add to front
  values.unshift(value)
  // Limit size
  values = values.slice(0, MAX_RECENT_ITEMS)
  
  localStorage.setItem(props.storageKey, JSON.stringify(values))
  recentValues.value = values
}

function handleFocus() {
  showSuggestions.value = filteredValues.value.length > 0
  selectedIndex.value = -1
}

function handleBlur() {
  saveRecentValue(props.modelValue)
  setTimeout(() => showSuggestions.value = false, 200)
  emit('blur')
}

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', target.value)
  showSuggestions.value = filteredValues.value.length > 0
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    showSuggestions.value = false
    return
  }
  
  if (!showSuggestions.value || filteredValues.value.length === 0) {
    if (e.key === 'Enter') {
      emit('enter')
    }
    return
  }
  
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredValues.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
  } else if (e.key === 'Enter') {
    if (selectedIndex.value >= 0) {
      e.preventDefault()
      selectValue(filteredValues.value[selectedIndex.value])
    } else {
      emit('enter')
    }
  }
}

function selectValue(value: string) {
  emit('update:modelValue', value)
  showSuggestions.value = false
}

onMounted(() => {
  recentValues.value = loadRecentValues()
})

// Watch for external value changes
watch(() => props.modelValue, () => {
  if (showSuggestions.value) {
    showSuggestions.value = filteredValues.value.length > 0
  }
})
</script>

<template>
  <div class="autocomplete-wrapper">
    <InputText
      :value="modelValue"
      :placeholder="placeholder"
      :class="inputClass"
      @focus="handleFocus"
      @blur="handleBlur"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    <div v-if="showSuggestions && filteredValues.length > 0" class="suggestions-dropdown">
      <div class="suggestion-header">Recent:</div>
      <div
        v-for="(value, idx) in filteredValues"
        :key="idx"
        :class="['suggestion-item', { selected: idx === selectedIndex }]"
        @mousedown.prevent="selectValue(value)"
      >
        {{ value }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.autocomplete-wrapper {
  position: relative;
  flex: 1;
  width: 100%;
}

.autocomplete-wrapper :deep(input) {
  width: 100%;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--tdv-surface);
  border: 1px solid var(--tdv-surface-border);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
}

.suggestion-header {
  padding: 6px 10px;
  font-size: 0.75rem;
  color: var(--tdv-text-muted);
  border-bottom: 1px solid var(--tdv-surface-border);
}

.suggestion-item {
  padding: 8px 10px;
  cursor: pointer;
  font-size: 0.85rem;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background: var(--tdv-hover-bg);
}
</style>
