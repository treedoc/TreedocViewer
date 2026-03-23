<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import type { QueryPreset, Column } from '@/models/types'
import { cleanColumnForSave } from '@/models/types'
import {
  getAllPresets,
  savePreset,
  updatePreset,
  deletePreset,
  exportPreset,
  importPreset,
  getPresetByName,
  getPreset,
} from '@/utils/PresetService'
import { TD } from 'treedoc'
import { useToast } from 'primevue/usetoast'
import { getFieldValueColors } from '@/utils/ValueColorService'
import {
  TDJSONParser,
  TDJSONWriter,
  TDJSONWriterOption,
  TDObjectCoder,
  TDObjectCoderOption,
} from 'treedoc'
import { onMounted } from 'vue'

export interface CurrentState {
  columns: Column[]
  jsQuery: string
  expandLevel?: number
}

const props = defineProps<{
  currentState: CurrentState
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'load': [preset: QueryPreset]
  'update:modelValue': [value: string | null]
}>()

const toast = useToast()

// State
const presets = ref<QueryPreset[]>(getAllPresets())
const showSaveDialog = ref(false)
const showManageDialog = ref(false)
const newPresetName = ref('')
const newPresetDescription = ref('')
const editingPreset = ref<QueryPreset | null>(null)
const showOverwriteConfirm = ref(false)
const existingPresetToOverwrite = ref<QueryPreset | null>(null)

// Import from URL state
const showImportDialog = ref(false)
const sharedPreset = ref<QueryPreset | null>(null)
const importConflict = ref(false)

// File import conflict state
const showFileImportConflictDialog = ref(false)
const fileImportConflicts = ref<Array<{ name: string; data: any }>>([])
const currentConflictIndex = ref(0)

// Multi-select state for export (uses preset names)
const selectedPresetNames = ref<Set<string>>(new Set())
const fileInputRef = ref<HTMLInputElement | null>(null)

// Remembered export folder (File System Access API)
const savedDirHandle = ref<any>(null)
const savedDirName = ref<string | null>(null)

// Computed - bind to parent via v-model (now uses preset name as key)
const selectedPresetName = computed({
  get: () => props.modelValue ?? null,
  set: (value: string | null) => emit('update:modelValue', value)
})

// Computed
const selectedPreset = computed(() => {
  if (!selectedPresetName.value) return null
  return presets.value.find(p => p.name.toLowerCase() === selectedPresetName.value?.toLowerCase()) || null
})

const presetOptions = computed(() => {
  return presets.value.map(p => ({
    label: p.name,
    value: p.name,  // Use name as value
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

function onPresetChange(presetName: string | null) {
  selectedPresetName.value = presetName
  if (presetName) {
    const preset = presets.value.find(p => p.name.toLowerCase() === presetName.toLowerCase())
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

// Build columns array with value colors merged in (from ValueColorService)
function buildColumnsWithColors(): Column[] {
  return props.currentState.columns.map(col => {
    const colors = getFieldValueColors(col.field)
    if (colors && Object.keys(colors).length > 0) {
      return { ...col, valueColors: colors }
    }
    return { ...col }
  })
}

function saveCurrentAsPreset() {
  if (!newPresetName.value.trim()) return
  
  // Check if a preset with the same name already exists
  const existingPreset = getPresetByName(newPresetName.value.trim())
  if (existingPreset) {
    existingPresetToOverwrite.value = existingPreset
    showOverwriteConfirm.value = true
    return
  }
  
  doSavePreset(false)
}

function doSavePreset(overwrite: boolean) {
  const name = newPresetName.value.trim()
  const description = newPresetDescription.value.trim() || undefined
  
  let preset: QueryPreset | null
  
  if (overwrite && existingPresetToOverwrite.value) {
    // Update the existing preset (use original name to find it)
    const updated = updatePreset(existingPresetToOverwrite.value.name, {
      name,
      description,
      columns: buildColumnsWithColors().map(cleanColumnForSave) as Column[],
      jsQuery: props.currentState.jsQuery,
      expandLevel: props.currentState.expandLevel,
    })
    
    if (updated) {
      preset = updated
      toast.add({
        severity: 'warn',
        summary: 'Preset Overwritten',
        detail: `Preset "${name}" has been updated`,
        life: 3000,
      })
    } else {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to overwrite preset',
        life: 3000,
      })
      return
    }
  } else {
    // Create new preset
    preset = savePreset({
      name,
      description,
      columns: buildColumnsWithColors().map(cleanColumnForSave) as Column[],
      jsQuery: props.currentState.jsQuery,
      expandLevel: props.currentState.expandLevel,
    })
    
    if (preset) {
      toast.add({
        severity: 'success',
        summary: 'Preset Created',
        detail: `Preset "${name}" has been saved`,
        life: 3000,
      })
    } else {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `Preset "${name}" already exists`,
        life: 3000,
      })
      return
    }
  }
  
  refreshPresets()
  selectedPresetName.value = preset.name
  showSaveDialog.value = false
  showOverwriteConfirm.value = false
  existingPresetToOverwrite.value = null
}

function cancelOverwrite() {
  showOverwriteConfirm.value = false
  existingPresetToOverwrite.value = null
}

function updateCurrentPreset() {
  if (!selectedPresetName.value) return

  console.log('[PresetSelector] Saving preset, currentState columns:', props.currentState.columns.length)
  
  const updated = updatePreset(selectedPresetName.value, {
    columns: buildColumnsWithColors().map(cleanColumnForSave) as Column[],
    jsQuery: props.currentState.jsQuery,
    expandLevel: props.currentState.expandLevel,
  })
  
  if (updated) {
    toast.add({
      severity: 'success',
      summary: 'Preset Saved',
      detail: `Preset "${selectedPresetName.value}" has been updated`,
      life: 3000,
    })
  } else {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to update preset',
      life: 3000,
    })
  }
  
  refreshPresets()
}

function openManageDialog() {
  refreshPresets()
  showManageDialog.value = true
}

// Track original name when editing (for rename detection)
const editingOriginalName = ref<string | null>(null)

function startEdit(preset: QueryPreset) {
  editingPreset.value = { ...preset }
  editingOriginalName.value = preset.name
}

function saveEdit() {
  if (!editingPreset.value || !editingOriginalName.value) return
  
  const updated = updatePreset(editingOriginalName.value, {
    name: editingPreset.value.name,
    description: editingPreset.value.description,
  })
  
  if (!updated) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `A preset with name "${editingPreset.value.name}" already exists`,
      life: 3000,
    })
    return
  }
  
  // Update selected preset name if we renamed the currently selected preset
  if (selectedPresetName.value?.toLowerCase() === editingOriginalName.value.toLowerCase()) {
    selectedPresetName.value = updated.name
  }
  
  refreshPresets()
  editingPreset.value = null
  editingOriginalName.value = null
}

function cancelEdit() {
  editingPreset.value = null
  editingOriginalName.value = null
}

function removePreset(name: string) {
  if (!confirm(`Delete preset "${name}"?`)) return
  
  const success = deletePreset(name)
  if (success) {
    if (selectedPresetName.value?.toLowerCase() === name.toLowerCase()) {
      selectedPresetName.value = null
    }
    refreshPresets()
    toast.add({
      severity: 'info',
      summary: 'Deleted',
      detail: `Preset "${name}" has been deleted`,
      life: 3000,
    })
  } else {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to delete preset',
      life: 3000,
    })
  }
}

function deleteSelectedPresets() {
  const count = selectedPresetNames.value.size
  if (count === 0) return
  
  if (!confirm(`Delete ${count} selected preset(s)?`)) return
  
  let deletedCount = 0
  for (const name of selectedPresetNames.value) {
    if (deletePreset(name)) {
      deletedCount++
      if (selectedPresetName.value?.toLowerCase() === name.toLowerCase()) {
        selectedPresetName.value = null
      }
    }
  }
  
  deselectAllPresets()
  refreshPresets()
  
  toast.add({
    severity: 'info',
    summary: 'Deleted',
    detail: `${deletedCount} preset(s) deleted`,
    life: 3000,
  })
}

function exportPresetToClipboard(preset: QueryPreset) {
  const json = exportPreset(preset)
  navigator.clipboard.writeText(json)
  toast.add({
    severity: 'info',
    summary: 'Exported',
    detail: 'Preset JSON copied to clipboard',
    life: 2000
  })
}

function sharePreset(preset: QueryPreset) {
  try {
    const clean: QueryPreset = {
      ...preset,
      columns: preset.columns.map(cleanColumnForSave) as Column[],
    }
    // Remove timestamps for cleaner share
    const toShare = JSON.parse(JSON.stringify(clean))
    delete toShare.createdAt
    delete toShare.updatedAt

    const writeOption = new TDJSONWriterOption()
      .setAlwaysQuoteKey(false)
      .setAlwaysQuoteValue(false)
      .setIndentFactor(0)
    
    const encoded = TDJSONWriter.writeAsString(
      TDObjectCoder.encode(toShare, new TDObjectCoderOption()),
      writeOption
    )
    
    // For hash-based routing, it's safer to put params in the hash part
    const currentUrl = window.location.href
    let baseUrl = currentUrl.split('?')[0].split('#')[0]
    const hashPart = currentUrl.includes('#') ? currentUrl.split('#')[1].split('?')[0] : '/'
    
    // Ensure baseUrl doesn't have trailing slash if hashPart starts with one
    if (baseUrl.endsWith('/') && hashPart.startsWith('/')) {
      baseUrl = baseUrl.slice(0, -1)
    }
    
    const separator = hashPart.includes('?') ? '&' : '?'
    const newUrl = `${baseUrl}#${hashPart}${separator}sharePreset=${encodeURIComponent(encoded)}`
    
    navigator.clipboard.writeText(newUrl)
    toast.add({
      severity: 'success',
      summary: 'Link Copied',
      detail: 'Shareable link copied to clipboard',
      life: 3000
    })
  } catch (e) {
    console.error('Error sharing preset:', e)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to generate share link',
      life: 3000
    })
  }
}

function handleImport(overwrite: boolean) {
  if (!sharedPreset.value) return

  const name = sharedPreset.value.name
  const existing = getPresetByName(name)

  if (existing && overwrite) {
    updatePreset(existing.name, {
      description: sharedPreset.value.description,
      columns: sharedPreset.value.columns,
      jsQuery: sharedPreset.value.jsQuery,
      expandLevel: sharedPreset.value.expandLevel,
    })
    toast.add({
      severity: 'success',
      summary: 'Imported',
      detail: `Preset "${name}" overwritten`,
      life: 3000
    })
  } else if (existing && !overwrite) {
    // Save as new with renamed name
    const newName = `${name} (imported)`
    savePreset({
      ...sharedPreset.value,
      name: newName
    })
    toast.add({
      severity: 'success',
      summary: 'Imported',
      detail: `Preset saved as "${newName}"`,
      life: 3000
    })
  } else {
    // Simple save
    savePreset(sharedPreset.value)
    toast.add({
      severity: 'success',
      summary: 'Imported',
      detail: `Preset "${name}" saved`,
      life: 3000
    })
  }

  refreshPresets()
  showImportDialog.value = false
  sharedPreset.value = null
  
  // Clean up URL
  const url = new URL(window.location.href)
  if (url.searchParams.has('sharePreset')) {
    url.searchParams.delete('sharePreset')
    window.history.replaceState({}, '', url.toString())
  } else {
    // Clean up hash params
    const hash = window.location.hash
    if (hash.includes('sharePreset')) {
       const [baseHash, query] = hash.split('?')
       const params = new URLSearchParams(query)
       params.delete('sharePreset')
       const newQuery = params.toString()
       window.history.replaceState({}, '', window.location.pathname + baseHash + (newQuery ? '?' + newQuery : ''))
    }
  }
}

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const hash = window.location.hash
  const hashQuery = hash.includes('?') ? hash.split('?')[1] : ''
  const hashParams = new URLSearchParams(hashQuery)
  
  const sharedData = urlParams.get('sharePreset') || hashParams.get('sharePreset')
  
  if (sharedData) {
    if (import.meta.env.DEV) {
      console.log('[PresetSelector] Received sharedData:', sharedData)
    }
    
    try {
      let dataObject: any
      
      // Try TDJSONParser first (handles JSONEx)
      try {
        const node = TDJSONParser.get().parse(sharedData)
        dataObject = node.toObject(false)
        if (import.meta.env.DEV) console.log('[PresetSelector] Parsed via TDJSONParser:', dataObject)
      } catch (tdError) {
        if (import.meta.env.DEV) console.warn('[PresetSelector] TDJSONParser failed, trying JSON.parse', tdError)
        // Fallback to plain JSON
        dataObject = JSON.parse(sharedData)
      }

      if (dataObject && dataObject.name && dataObject.columns) {
        sharedPreset.value = dataObject
        importConflict.value = !!getPresetByName(dataObject.name)
        showImportDialog.value = true
      } else {
        const structure = dataObject ? Object.keys(dataObject).join(', ') : 'null'
        throw new Error(`Invalid preset structure. Keys found: ${structure}`)
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      console.error('[PresetSelector] Import failed:', e)
      toast.add({
        severity: 'error',
        summary: 'Import Error',
        detail: `The shared link is invalid: ${errorMsg}`,
        life: 10000
      })
    }
  }
})

function importFromClipboard() {
  navigator.clipboard.readText().then(text => {
    const preset = importPreset(text)
    if (preset) {
      refreshPresets()
      selectedPresetName.value = preset.name
      toast.add({
        severity: 'success',
        summary: 'Imported',
        detail: `Preset "${preset.name}" imported successfully`,
        life: 3000
      })
    } else {
      toast.add({
        severity: 'error',
        summary: 'Import Failed',
        detail: 'Invalid preset format or name already exists',
        life: 3000
      })
    }
  }).catch(() => {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to read clipboard',
      life: 3000
    })
  })
}

function countPresetColors(preset: QueryPreset): number {
  let count = 0
  for (const col of preset.columns) {
    if (col.valueColors) {
      count += Object.keys(col.valueColors).length
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

// Multi-select functions
function togglePresetSelection(presetName: string) {
  if (selectedPresetNames.value.has(presetName)) {
    selectedPresetNames.value.delete(presetName)
  } else {
    selectedPresetNames.value.add(presetName)
  }
  selectedPresetNames.value = new Set(selectedPresetNames.value)
}

function isPresetSelected(presetName: string): boolean {
  return selectedPresetNames.value.has(presetName)
}

function selectAllPresets() {
  selectedPresetNames.value = new Set(presets.value.map(p => p.name))
}

function deselectAllPresets() {
  selectedPresetNames.value = new Set()
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'preset'
}

async function pickExportFolder() {
  if (!('showDirectoryPicker' in window)) {
    toast.add({
      severity: 'warn',
      summary: 'Not Supported',
      detail: 'Your browser does not support folder selection',
      life: 3000
    })
    return false
  }

  try {
    const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
    savedDirHandle.value = dirHandle
    savedDirName.value = dirHandle.name
    toast.add({
      severity: 'info',
      summary: 'Folder Selected',
      detail: `Export folder set to "${dirHandle.name}"`,
      life: 2000
    })
    return true
  } catch (e: any) {
    if (e.name === 'AbortError') return false
    console.error('Directory picker failed:', e)
    return false
  }
}

async function checkFileExists(dirHandle: any, fileName: string): Promise<boolean> {
  try {
    await dirHandle.getFileHandle(fileName)
    return true
  } catch {
    return false
  }
}

async function exportPresetsToFolder(presetsToExport: QueryPreset[]) {
  // Try to use File System Access API (modern browsers)
  if (!('showDirectoryPicker' in window)) {
    fallbackExportAsZip(presetsToExport)
    return
  }

  try {
    // Use saved directory handle or pick a new one
    let dirHandle = savedDirHandle.value
    if (!dirHandle) {
      dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
      savedDirHandle.value = dirHandle
      savedDirName.value = dirHandle.name
    }
    
    // Verify we still have permission
    const permission = await dirHandle.queryPermission({ mode: 'readwrite' })
    if (permission !== 'granted') {
      const requestResult = await dirHandle.requestPermission({ mode: 'readwrite' })
      if (requestResult !== 'granted') {
        // Permission denied, pick a new folder
        dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
        savedDirHandle.value = dirHandle
        savedDirName.value = dirHandle.name
      }
    }
    
    // Check for existing files
    const existingFiles: string[] = []
    for (const preset of presetsToExport) {
      const fileName = `${sanitizeFileName(preset.name)}.json`
      if (await checkFileExists(dirHandle, fileName)) {
        existingFiles.push(fileName)
      }
    }
    
    // Warn about overwriting
    if (existingFiles.length > 0) {
      const fileList = existingFiles.length <= 3 
        ? existingFiles.join(', ') 
        : `${existingFiles.slice(0, 3).join(', ')} and ${existingFiles.length - 3} more`
      if (!confirm(`The following file(s) will be overwritten:\n${fileList}\n\nContinue?`)) {
        return
      }
    }
    
    // Export files
    for (const preset of presetsToExport) {
      const json = exportPreset(preset)
      const fileName = `${sanitizeFileName(preset.name)}.json`
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(json)
      await writable.close()
    }
    
    toast.add({
      severity: 'success',
      summary: 'Exported',
      detail: `${presetsToExport.length} preset(s) saved to "${savedDirName.value}"`,
      life: 3000
    })
    
    deselectAllPresets()
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return
    }
    console.error('Directory picker failed:', e)
    // Clear saved handle if it's invalid
    savedDirHandle.value = null
    savedDirName.value = null
    fallbackExportAsZip(presetsToExport)
  }
}

async function exportSelectedToFiles() {
  const selectedPresets = presets.value.filter(p => selectedPresetNames.value.has(p.name))
  
  if (selectedPresets.length === 0) {
    toast.add({
      severity: 'warn',
      summary: 'No Selection',
      detail: 'Please select at least one preset to export',
      life: 3000
    })
    return
  }

  await exportPresetsToFolder(selectedPresets)
}

async function exportSinglePreset(preset: QueryPreset) {
  await exportPresetsToFolder([preset])
}

async function fallbackExportAsZip(selectedPresets: QueryPreset[]) {
  if (selectedPresets.length === 1) {
    const preset = selectedPresets[0]
    const json = exportPreset(preset)
    downloadFile(`${sanitizeFileName(preset.name)}.json`, json)
    toast.add({
      severity: 'success',
      summary: 'Exported',
      detail: `Preset "${preset.name}" downloaded`,
      life: 3000
    })
  } else {
    for (const preset of selectedPresets) {
      const json = exportPreset(preset)
      downloadFile(`${sanitizeFileName(preset.name)}.json`, json)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    toast.add({
      severity: 'success',
      summary: 'Exported',
      detail: `${selectedPresets.length} preset files downloaded`,
      life: 3000
    })
  }
  deselectAllPresets()
}

function downloadFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function triggerFileImport() {
  fileInputRef.value?.click()
}

async function handleFileImport(event: Event) {
  const input = event.target as HTMLInputElement
  const inputFiles = input.files
  
  if (!inputFiles || inputFiles.length === 0) return
  
  const files: Array<{ name: string; content: string }> = []
  for (const file of Array.from(inputFiles)) {
    const content = await file.text()
    files.push({ name: file.name, content })
  }
  
  await processImportFiles(files)
  input.value = ''
}

async function processImportFiles(files: Array<{ name: string; content: string }>) {
  let successCount = 0
  let failCount = 0
  const errors: string[] = []
  const conflicts: Array<{ name: string; data: any }> = []
  
  for (const file of files) {
    try {
      const data = TD.parse(file.content)
      
      if (!data || !data.name || !data.columns) {
        failCount++
        errors.push(`${file.name}: Invalid format`)
        continue
      }
      
      // Check if preset with same name exists
      const existing = getPreset(data.name)
      if (existing) {
        conflicts.push({ name: file.name, data })
      } else {
        const preset = importPreset(file.content)
        if (preset) {
          successCount++
        } else {
          failCount++
          errors.push(`${file.name}: Import failed`)
        }
      }
    } catch (e) {
      failCount++
      errors.push(`${file.name}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }
  
  refreshPresets()
  
  if (successCount > 0) {
    toast.add({
      severity: 'success',
      summary: 'Imported',
      detail: `${successCount} preset(s) imported successfully`,
      life: 3000
    })
  }
  
  if (failCount > 0) {
    toast.add({
      severity: 'error',
      summary: 'Import Errors',
      detail: errors.join('\n'),
      life: 5000
    })
  }
  
  // Handle conflicts
  if (conflicts.length > 0) {
    fileImportConflicts.value = conflicts
    currentConflictIndex.value = 0
    showFileImportConflictDialog.value = true
  }
}

function handleConflictOverwrite() {
  const conflict = fileImportConflicts.value[currentConflictIndex.value]
  if (!conflict) return
  
  const data = conflict.data
  updatePreset(data.name, {
    description: data.description,
    columns: data.columns,
    jsQuery: data.jsQuery,
    expandLevel: data.expandLevel,
  })
  
  toast.add({
    severity: 'success',
    summary: 'Overwritten',
    detail: `Preset "${data.name}" has been updated`,
    life: 2000
  })
  
  nextConflict()
}

function handleConflictRename() {
  const conflict = fileImportConflicts.value[currentConflictIndex.value]
  if (!conflict) return
  
  // Auto-generate unique name
  const data = conflict.data
  let newName = data.name
  let suffix = 1
  while (getPreset(newName)) {
    newName = `${data.name} (${suffix})`
    suffix++
  }
  
  savePreset({
    name: newName,
    description: data.description,
    columns: data.columns,
    jsQuery: data.jsQuery,
    expandLevel: data.expandLevel,
  })
  
  toast.add({
    severity: 'success',
    summary: 'Imported',
    detail: `Preset saved as "${newName}"`,
    life: 2000
  })
  
  nextConflict()
}

function handleConflictSkip() {
  nextConflict()
}

function nextConflict() {
  refreshPresets()
  
  if (currentConflictIndex.value < fileImportConflicts.value.length - 1) {
    currentConflictIndex.value++
  } else {
    showFileImportConflictDialog.value = false
    fileImportConflicts.value = []
    currentConflictIndex.value = 0
  }
}

const currentConflict = computed(() => {
  return fileImportConflicts.value[currentConflictIndex.value] || null
})
</script>

<template>
  <div class="preset-selector">
    <!-- Preset Dropdown -->
    <Select
      v-model="selectedPresetName"
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
      :severity="selectedPresetName ? 'primary' : 'secondary'"
      @click="selectedPresetName ? updateCurrentPreset() : openSaveDialog()"
      v-tooltip.top="selectedPresetName ? 'Update preset' : 'Save as new preset'"
    />
    
    <!-- Save As New Button (when preset selected) -->
    <Button
      v-if="selectedPresetName"
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
  
  <!-- Overwrite Confirmation Dialog -->
  <Dialog
    v-model:visible="showOverwriteConfirm"
    header="Overwrite Preset?"
    :modal="true"
    :style="{ width: '400px' }"
  >
    <div class="overwrite-confirm-content">
      <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: var(--orange-500);"></i>
      <p>
        A preset named <strong>"{{ existingPresetToOverwrite?.name }}"</strong> already exists.
        Do you want to overwrite it with the current settings?
      </p>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="cancelOverwrite" />
      <Button label="Overwrite" severity="warning" @click="doSavePreset(true)" />
    </template>
  </Dialog>
  
  <!-- Manage Dialog -->
  <Dialog
    v-model:visible="showManageDialog"
    header="Manage Presets"
    :modal="true"
    :style="{ width: '650px' }"
    :dismissableMask="true"
  >
    <div class="manage-dialog-content">
      <div class="manage-toolbar">
        <Button
          icon="pi pi-folder-open"
          size="small"
          severity="secondary"
          @click="triggerFileImport"
          v-tooltip.top="'Import from files'"
        />
        <Button
          icon="pi pi-clipboard"
          size="small"
          severity="secondary"
          @click="importFromClipboard"
          v-tooltip.top="'Import from clipboard'"
        />
        <div class="toolbar-separator" />
        <Button
          icon="pi pi-check-square"
          size="small"
          text
          severity="secondary"
          @click="selectAllPresets"
          v-tooltip.top="'Select all'"
          :disabled="presets.length === 0"
        />
        <Button
          icon="pi pi-times"
          size="small"
          text
          severity="secondary"
          @click="deselectAllPresets"
          v-tooltip.top="'Clear selection'"
          :disabled="selectedPresetNames.size === 0"
        />
        <div class="toolbar-separator" />
        <Button
          icon="pi pi-download"
          size="small"
          severity="secondary"
          @click="exportSelectedToFiles"
          v-tooltip.top="savedDirName ? `Export to '${savedDirName}'` : 'Export selected'"
          :disabled="selectedPresetNames.size === 0"
        />
        <Button
          icon="pi pi-folder"
          size="small"
          text
          :severity="savedDirName ? 'primary' : 'secondary'"
          @click="pickExportFolder"
          v-tooltip.top="savedDirName ? `Change folder (${savedDirName})` : 'Set export folder'"
        />
        <Button
          icon="pi pi-trash"
          size="small"
          severity="danger"
          @click="deleteSelectedPresets"
          v-tooltip.top="'Delete selected'"
          :disabled="selectedPresetNames.size === 0"
        />
      </div>
      
      <!-- Hidden file input for import -->
      <input
        ref="fileInputRef"
        type="file"
        accept=".json"
        multiple
        style="display: none"
        @change="handleFileImport"
      />
      
      <div v-if="presets.length === 0" class="no-presets">
        No presets saved yet. Save your first preset to get started.
      </div>
      
      <div v-else class="preset-list">
        <div
          v-for="preset in presets"
          :key="preset.name"
          class="preset-item"
          :class="{ 'is-selected': preset.name.toLowerCase() === selectedPresetName?.toLowerCase(), 'is-checked': isPresetSelected(preset.name) }"
        >
          <div class="preset-checkbox">
            <Checkbox
              :modelValue="isPresetSelected(preset.name)"
              :binary="true"
              @update:modelValue="togglePresetSelection(preset.name)"
            />
          </div>
          <div v-if="editingOriginalName?.toLowerCase() === preset.name.toLowerCase() && editingPreset" class="preset-edit">
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
              <span>{{ preset.columns.filter(c => c.visible !== false).length }} columns</span>
              <span v-if="preset.columns.some(c => c.extendedFields)">• Extended fields</span>
              <span v-if="preset.columns.some(c => c.query || c.jsExpression)">• {{ preset.columns.filter(c => c.query || c.jsExpression).length }} filters</span>
              <span v-if="countPresetColors(preset) > 0">• {{ countPresetColors(preset) }} colors</span>
            </div>
          </div>
          <div class="preset-actions">
            <Button icon="pi pi-pencil" size="small" text @click.stop="startEdit(preset)" v-tooltip.top="'Edit'" />
            <Button icon="pi pi-download" size="small" text @click.stop="exportSinglePreset(preset)" v-tooltip.top="'Export to file'" />
            <Button icon="pi pi-share-alt" size="small" text @click.stop="sharePreset(preset)" v-tooltip.top="'Share link'" />
            <Button icon="pi pi-copy" size="small" text @click.stop="exportPresetToClipboard(preset)" v-tooltip.top="'Copy to clipboard'" />
            <Button icon="pi pi-trash" size="small" text severity="danger" @click.stop="removePreset(preset.name)" v-tooltip.top="'Delete'" />
          </div>
        </div>
      </div>
    </div>
  </Dialog>

  <!-- Import Shared Preset Dialog -->
  <Dialog
    v-model:visible="showImportDialog"
    header="Import Shared Preset"
    :modal="true"
    :style="{ width: '450px' }"
  >
    <div class="import-dialog-content">
      <div v-if="sharedPreset">
        <p>You've opened a shared preset: <strong>{{ sharedPreset.name }}</strong></p>
        <p v-if="sharedPreset.description" class="preset-description">{{ sharedPreset.description }}</p>
        
        <div v-if="importConflict" class="import-warning">
          <i class="pi pi-exclamation-triangle"></i>
          <span>A preset with this name already exists.</span>
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showImportDialog = false" />
      <template v-if="importConflict">
        <Button label="Overwrite" severity="warning" @click="handleImport(true)" />
        <Button label="Save as New" @click="handleImport(false)" />
      </template>
      <template v-else>
        <Button label="Import" @click="handleImport(false)" />
      </template>
    </template>
  </Dialog>

  <!-- File Import Conflict Dialog -->
  <Dialog
    v-model:visible="showFileImportConflictDialog"
    header="Import Conflict"
    :modal="true"
    :closable="false"
    :style="{ width: '450px' }"
  >
    <div class="import-conflict-content" v-if="currentConflict">
      <div class="conflict-progress">
        <span>{{ currentConflictIndex + 1 }} of {{ fileImportConflicts.length }}</span>
      </div>
      <p>
        A preset named <strong>"{{ currentConflict.data.name }}"</strong> already exists.
      </p>
      <p class="conflict-file">
        <i class="pi pi-file"></i> {{ currentConflict.name }}
      </p>
    </div>
    <template #footer>
      <Button label="Skip" severity="secondary" text @click="handleConflictSkip" />
      <Button label="Rename" severity="secondary" @click="handleConflictRename" v-tooltip.top="'Save with auto-generated name'" />
      <Button label="Overwrite" severity="warning" @click="handleConflictOverwrite" />
    </template>
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
  align-items: center;
  gap: 4px;
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--tdv-surface-border);
  margin: 0 4px;
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

.preset-item.is-checked {
  background: var(--tdv-surface-hover, rgba(0, 0, 0, 0.04));
}

.preset-checkbox {
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
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

.overwrite-confirm-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 8px 0;
}

.overwrite-confirm-content p {
  margin: 0;
  line-height: 1.5;
}

.overwrite-confirm-content strong {
  color: var(--tdv-text-primary);
}

.import-dialog-content {
  padding: 8px 0;
}

.import-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  background: var(--tdv-surface-light);
  border-left: 4px solid var(--orange-500);
  color: var(--orange-700);
}

.import-warning i {
  font-size: 1.25rem;
}

.import-conflict-content {
  padding: 8px 0;
}

.import-conflict-content p {
  margin: 8px 0;
}

.conflict-progress {
  font-size: 0.85rem;
  color: var(--tdv-text-muted);
  margin-bottom: 8px;
}

.conflict-file {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--tdv-text-secondary);
  padding: 8px 12px;
  background: var(--tdv-surface-light);
  border-radius: var(--tdv-radius-sm);
}

.conflict-file i {
  color: var(--tdv-text-muted);
}
</style>
