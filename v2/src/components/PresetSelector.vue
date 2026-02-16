<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import type { QueryPreset, FieldQuery } from '@/models/types'
import {
  getAllPresets,
  savePreset,
  updatePreset,
  deletePreset,
  exportPreset,
  importPreset,
} from '@/utils/PresetService'
import { getFieldValueColors } from '@/utils/ValueColorService'

export interface CurrentState {
  columns: { field: string; visible: boolean }[]
  extendedFields: string
  fieldQueries: Record<string, FieldQuery>
  jsQuery: string
  expandLevel?: number
}

const props = defineProps<{
  currentState: CurrentState
}>()

const emit = defineEmits<{
  'load': [preset: QueryPreset]
}>()

// State
const presets = ref<QueryPreset[]>(getAllPresets())
const selectedPresetId = ref<string | null>(null)
const showSaveDialog = ref(false)
const showManageDialog = ref(false)
const newPresetName = ref('')
const newPresetDescription = ref('')
const editingPreset = ref<QueryPreset | null>(null)

// Computed
const selectedPreset = computed(() => {
  if (!selectedPresetId.value) return null
  return presets.value.find(p => p.id === selectedPresetId.value) || null
})

const presetOptions = computed(() => {
  return presets.value.map(p => ({
    label: p.name,
    value: p.id,
  }))
})

// Methods
function refreshPresets() {
  presets.value = getAllPresets()
}

function loadSelectedPreset() {
  if (selectedPreset.value) {
    emit('load', selectedPreset.value)
  }
}

function onPresetChange(presetId: string | null) {
  selectedPresetId.value = presetId
  if (presetId) {
    const preset = presets.value.find(p => p.id === presetId)
    if (preset) {
      emit('load', preset)
    }
  }
}

function openSaveDialog() {
  newPresetName.value = ''
  newPresetDescription.value = ''
  showSaveDialog.value = true
}

// Build fieldQueries with valueColors included
function buildFieldQueriesWithColors() {
  const result: Record<string, any> = {}
  for (const [field, fq] of Object.entries(props.currentState.fieldQueries)) {
    result[field] = {
      ...fq,
      valueColors: getFieldValueColors(field),
    }
  }
  return result
}

function saveCurrentAsPreset() {
  if (!newPresetName.value.trim()) return
  
  const preset = savePreset({
    name: newPresetName.value.trim(),
    description: newPresetDescription.value.trim() || undefined,
    columns: props.currentState.columns,
    extendedFields: props.currentState.extendedFields,
    fieldQueries: buildFieldQueriesWithColors(),
    jsQuery: props.currentState.jsQuery,
    expandLevel: props.currentState.expandLevel,
  })
  
  refreshPresets()
  selectedPresetId.value = preset.id
  showSaveDialog.value = false
}

function updateCurrentPreset() {
  if (!selectedPresetId.value) return
  
  updatePreset(selectedPresetId.value, {
    columns: props.currentState.columns,
    extendedFields: props.currentState.extendedFields,
    fieldQueries: buildFieldQueriesWithColors(),
    jsQuery: props.currentState.jsQuery,
    expandLevel: props.currentState.expandLevel,
  })
  
  refreshPresets()
}

function openManageDialog() {
  refreshPresets()
  showManageDialog.value = true
}

function startEdit(preset: QueryPreset) {
  editingPreset.value = { ...preset }
}

function saveEdit() {
  if (!editingPreset.value) return
  
  updatePreset(editingPreset.value.id, {
    name: editingPreset.value.name,
    description: editingPreset.value.description,
  })
  
  refreshPresets()
  editingPreset.value = null
}

function cancelEdit() {
  editingPreset.value = null
}

function removePreset(id: string) {
  alert('Deleting preset: ' + id)
  const success = deletePreset(id)
  if (success) {
    if (selectedPresetId.value === id) {
      selectedPresetId.value = null
    }
    refreshPresets()
  } else {
    alert('Failed to delete preset')
  }
}

function exportPresetToClipboard(preset: QueryPreset) {
  const json = exportPreset(preset)
  navigator.clipboard.writeText(json)
  alert('Preset copied to clipboard!')
}

function importFromClipboard() {
  navigator.clipboard.readText().then(text => {
    const preset = importPreset(text)
    if (preset) {
      refreshPresets()
      selectedPresetId.value = preset.id
      alert('Preset imported successfully!')
    } else {
      alert('Failed to import preset. Invalid format.')
    }
  }).catch(() => {
    alert('Failed to read clipboard.')
  })
}

function countPresetColors(preset: QueryPreset): number {
  let count = 0
  for (const fq of Object.values(preset.fieldQueries)) {
    if (fq.valueColors) {
      count += Object.keys(fq.valueColors).length
    }
  }
  return count
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="preset-selector">
    <!-- Preset Dropdown -->
    <Select
      v-model="selectedPresetId"
      :options="presetOptions"
      optionLabel="label"
      optionValue="value"
      placeholder="Select preset..."
      class="preset-dropdown"
      :showClear="true"
      @change="onPresetChange($event.value)"
    />
    
    <!-- Save Button -->
    <Button
      icon="pi pi-save"
      size="small"
      text
      :severity="selectedPresetId ? 'primary' : 'secondary'"
      @click="selectedPresetId ? updateCurrentPreset() : openSaveDialog()"
      v-tooltip.top="selectedPresetId ? 'Update preset' : 'Save as new preset'"
    />
    
    <!-- Save As New Button (when preset selected) -->
    <Button
      v-if="selectedPresetId"
      icon="pi pi-plus"
      size="small"
      text
      severity="secondary"
      @click="openSaveDialog"
      v-tooltip.top="'Save as new preset'"
    />
    
    <!-- Manage Button -->
    <Button
      icon="pi pi-cog"
      size="small"
      text
      severity="secondary"
      @click="openManageDialog"
      v-tooltip.top="'Manage presets'"
    />
  </div>
  
  <!-- Save Dialog -->
  <Dialog
    v-model:visible="showSaveDialog"
    header="Save Preset"
    :modal="true"
    :style="{ width: '400px' }"
    :dismissableMask="true"
  >
    <div class="save-dialog-content">
      <div class="field">
        <label>Name</label>
        <InputText
          v-model="newPresetName"
          placeholder="Enter preset name..."
          class="w-full"
          @keydown.enter="saveCurrentAsPreset"
        />
      </div>
      <div class="field">
        <label>Description (optional)</label>
        <InputText
          v-model="newPresetDescription"
          placeholder="Describe this preset..."
          class="w-full"
        />
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showSaveDialog = false" />
      <Button label="Save" :disabled="!newPresetName.trim()" @click="saveCurrentAsPreset" />
    </template>
  </Dialog>
  
  <!-- Manage Dialog -->
  <Dialog
    v-model:visible="showManageDialog"
    header="Manage Presets"
    :modal="true"
    :style="{ width: '600px' }"
    :dismissableMask="true"
  >
    <div class="manage-dialog-content">
      <div class="manage-toolbar">
        <Button
          label="Import from Clipboard"
          icon="pi pi-download"
          size="small"
          severity="secondary"
          @click="importFromClipboard"
        />
      </div>
      
      <div v-if="presets.length === 0" class="no-presets">
        No presets saved yet. Save your first preset to get started.
      </div>
      
      <div v-else class="preset-list">
        <div
          v-for="preset in presets"
          :key="preset.id"
          class="preset-item"
          :class="{ 'is-selected': preset.id === selectedPresetId }"
        >
          <div v-if="editingPreset?.id === preset.id" class="preset-edit">
            <InputText v-model="editingPreset.name" class="edit-name" />
            <InputText v-model="editingPreset.description" placeholder="Description..." class="edit-desc" />
            <Button icon="pi pi-check" size="small" @click="saveEdit" />
            <Button icon="pi pi-times" size="small" severity="secondary" @click="cancelEdit" />
          </div>
          <div v-else class="preset-info">
            <div class="preset-header">
              <span class="preset-name">{{ preset.name }}</span>
              <span class="preset-date">{{ formatDate(preset.updatedAt) }}</span>
            </div>
            <div v-if="preset.description" class="preset-description">
              {{ preset.description }}
            </div>
            <div class="preset-meta">
              <span>{{ preset.columns.filter(c => c.visible).length }} columns</span>
              <span v-if="preset.extendedFields">• Extended fields</span>
              <span v-if="Object.keys(preset.fieldQueries).length">• {{ Object.keys(preset.fieldQueries).length }} filters</span>
              <span v-if="countPresetColors(preset) > 0">• {{ countPresetColors(preset) }} colors</span>
            </div>
          </div>
          <div class="preset-actions">
            <Button icon="pi pi-pencil" size="small" text @click.stop="startEdit(preset)" v-tooltip.top="'Edit'" />
            <Button icon="pi pi-copy" size="small" text @click.stop="exportPresetToClipboard(preset)" v-tooltip.top="'Copy to clipboard'" />
            <Button icon="pi pi-trash" size="small" text severity="danger" @click.stop="removePreset(preset.id)" v-tooltip.top="'Delete'" />
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.preset-selector {
  display: flex;
  align-items: center;
  gap: 4px;
}

.preset-dropdown {
  width: 180px;
  font-size: 0.85rem;
}

:deep(.preset-dropdown .p-select-label) {
  padding: 4px 8px;
}

.save-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--tdv-text-secondary);
}

.w-full {
  width: 100%;
}

.manage-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.manage-toolbar {
  display: flex;
  justify-content: flex-end;
}

.no-presets {
  text-align: center;
  padding: 32px;
  color: var(--tdv-text-muted);
  font-style: italic;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.preset-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius-sm);
  background: var(--tdv-surface-light);
}

.preset-item.is-selected {
  border-color: var(--tdv-primary);
  background: var(--tdv-primary-light, rgba(59, 130, 246, 0.1));
}

.preset-info {
  flex: 1;
  min-width: 0;
}

.preset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.preset-name {
  font-weight: 600;
  color: var(--tdv-text-primary);
}

.preset-date {
  font-size: 0.75rem;
  color: var(--tdv-text-muted);
}

.preset-description {
  font-size: 0.85rem;
  color: var(--tdv-text-secondary);
  margin-top: 4px;
}

.preset-meta {
  font-size: 0.75rem;
  color: var(--tdv-text-muted);
  margin-top: 4px;
  display: flex;
  gap: 8px;
}

.preset-actions {
  display: flex;
  gap: 2px;
}

.preset-edit {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
}

.edit-name {
  flex: 1;
}

.edit-desc {
  flex: 2;
}
</style>
