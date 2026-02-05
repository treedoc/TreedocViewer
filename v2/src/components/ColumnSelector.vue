<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

export interface ColumnVisibility {
  field: string
  header: string
  visible: boolean
}

const props = defineProps<{
  visible: boolean
  columns: ColumnVisibility[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:columns': [columns: ColumnVisibility[]]
}>()

const searchQuery = ref('')

const filteredColumns = computed(() => {
  if (!searchQuery.value) return props.columns
  const query = searchQuery.value.toLowerCase()
  return props.columns.filter(col => 
    col.header.toLowerCase().includes(query) || 
    col.field.toLowerCase().includes(query)
  )
})

const visibleCount = computed(() => props.columns.filter(c => c.visible).length)
const totalCount = computed(() => props.columns.length)

function toggleColumn(col: ColumnVisibility) {
  const updated = props.columns.map(c => 
    c.field === col.field ? { ...c, visible: !c.visible } : c
  )
  emit('update:columns', updated)
}

function showAll() {
  const updated = props.columns.map(c => ({ ...c, visible: true }))
  emit('update:columns', updated)
}

function hideAll() {
  // Keep at least the first column visible
  const updated = props.columns.map((c, i) => ({ ...c, visible: i === 0 }))
  emit('update:columns', updated)
}

function close() {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    header="Column Selection"
    :modal="true"
    :style="{ width: '350px' }"
    :dismissableMask="true"
    class="column-selector-dialog"
  >
    <div class="selector-content">
      <!-- Search -->
      <div class="search-row">
        <InputText
          v-model="searchQuery"
          placeholder="Search columns..."
          class="search-input"
        />
      </div>
      
      <!-- Quick Actions -->
      <div class="quick-actions">
        <Button
          label="Show All"
          size="small"
          text
          @click="showAll"
        />
        <Button
          label="Hide All"
          size="small"
          text
          severity="secondary"
          @click="hideAll"
        />
        <span class="column-count">{{ visibleCount }} / {{ totalCount }}</span>
      </div>
      
      <!-- Column List -->
      <div class="column-list">
        <div
          v-for="col in filteredColumns"
          :key="col.field"
          class="column-item"
          @click="toggleColumn(col)"
        >
          <Checkbox
            :modelValue="col.visible"
            :binary="true"
            @click.stop="toggleColumn(col)"
          />
          <span class="column-name" :class="{ 'column-hidden': !col.visible }">
            {{ col.header }}
          </span>
          <span class="column-field">{{ col.field !== col.header ? col.field : '' }}</span>
        </div>
      </div>
    </div>
    
    <template #footer>
      <Button label="Done" @click="close" />
    </template>
  </Dialog>
</template>

<style scoped>
.selector-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-row {
  display: flex;
}

.search-input {
  width: 100%;
}

.quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--tdv-surface-border);
}

.column-count {
  margin-left: auto;
  font-size: 0.85rem;
  color: var(--tdv-text-muted);
}

.column-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 350px;
  overflow-y: auto;
}

.column-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--tdv-radius-sm);
  cursor: pointer;
  transition: background 0.15s;
}

.column-item:hover {
  background: var(--tdv-hover-bg);
}

.column-name {
  flex: 1;
  font-weight: 500;
  color: var(--tdv-text);
}

.column-name.column-hidden {
  color: var(--tdv-text-muted);
  text-decoration: line-through;
}

.column-field {
  font-size: 0.8rem;
  color: var(--tdv-text-muted);
  font-family: 'JetBrains Mono', monospace;
}
</style>
