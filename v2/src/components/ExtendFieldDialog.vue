<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Textarea from 'primevue/textarea'
import type { TDNode } from 'treedoc'
import { TDNodeType, TDJSONWriter, TDJSONWriterOption } from 'treedoc'

export interface ExtendFieldResult {
  type: 'pattern' | 'jsonpath'
  pattern?: string
  extendedFields?: string
}

const props = defineProps<{
  visible: boolean
  cellValue: any
  columnField: string
  currentExtendedFields?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'apply': [result: ExtendFieldResult]
  'updateExtendedFields': [fields: string]
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Check if value is a TDNode (has specific TDNode properties)
function isTDNode(value: any): value is TDNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'number' &&
    'children' in value // TDNode always has children array (even if empty)
  )
}

// Determine if value is JSON-like and convert to plain JS object
function tryParseJson(value: any): any {
  if (value === null || value === undefined) return null
  
  console.log('[tryParseJson] Input type:', typeof value, 'isObject:', typeof value === 'object')
  
  // Handle TDNode (check with proper detection)
  if (isTDNode(value)) {
    const node = value
    console.log('[tryParseJson] TDNode type:', node.type, 'SIMPLE:', TDNodeType.SIMPLE, 'value type:', typeof node.value)
    
    if (node.type === TDNodeType.SIMPLE) {
      // Try to parse string value as JSON
      if (typeof node.value === 'string') {
        console.log('[tryParseJson] Trying to parse SIMPLE node.value:', node.value.substring(0, 100))
        try {
          const parsed = JSON.parse(node.value)
          console.log('[tryParseJson] Successfully parsed SIMPLE node.value, result type:', typeof parsed)
          return parsed
        } catch (e) {
          console.log('[tryParseJson] Failed to parse SIMPLE node.value:', e)
          return null
        }
      }
      return null
    }
    // Complex node - convert to plain object via JSON roundtrip to break circular refs
    try {
      const jsonStr = TDJSONWriter.get().writeAsString(node, new TDJSONWriterOption())
      console.log('[tryParseJson] Complex node converted to:', jsonStr.substring(0, 100))
      return JSON.parse(jsonStr)
    } catch (e) {
      console.log('[tryParseJson] Failed to convert complex node:', e)
      return null
    }
  }
  
  // Handle plain objects/arrays - clone via JSON to ensure no circular refs
  if (typeof value === 'object') {
    console.log('[tryParseJson] Plain object, cloning...')
    try {
      const cloned = JSON.parse(JSON.stringify(value))
      console.log('[tryParseJson] Successfully cloned object, keys:', Object.keys(cloned))
      return cloned
    } catch (e) {
      console.log('[tryParseJson] Failed to clone object:', e)
      return null
    }
  }
  
  // Handle string that might be JSON
  if (typeof value === 'string') {
    console.log('[tryParseJson] Trying to parse string:', value.substring(0, 100))
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && parsed !== null) {
        console.log('[tryParseJson] Successfully parsed string as JSON object')
        return parsed
      }
    } catch {
      console.log('[tryParseJson] String is not valid JSON')
    }
  }
  
  return null
}

function getStringValue(value: any): string {
  if (value === null || value === undefined) return ''
  
  // Handle TDNode
  if (typeof value === 'object' && 'type' in value && 'key' in value) {
    const node = value as TDNode
    if (node.type === TDNodeType.SIMPLE) {
      return String(node.value ?? '')
    }
    return TDJSONWriter.get().writeAsString(node, new TDJSONWriterOption())
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  
  return String(value)
}

// Extract all JSON paths from an object
interface JsonPathInfo {
  path: string
  name: string
  customName: string
  selected: boolean
  sampleValue: string
}

function extractJsonPaths(obj: any, prefix: string = '$', depth: number = 0, visited: WeakSet<object> = new WeakSet()): JsonPathInfo[] {
  const paths: JsonPathInfo[] = []
  const MAX_DEPTH = 10
  
  if (obj === null || obj === undefined) return paths
  if (depth > MAX_DEPTH) return paths
  
  // Skip internal properties that might cause circular refs
  const skipKeys = new Set(['__node', 'parent', '_parent', '__proto__'])
  
  if (Array.isArray(obj)) {
    // Prevent circular reference
    if (visited.has(obj)) return paths
    visited.add(obj)
    
    // For arrays, sample the first item
    if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
      const childPaths = extractJsonPaths(obj[0], `${prefix}[0]`, depth + 1, visited)
      paths.push(...childPaths)
    }
  } else if (typeof obj === 'object') {
    // Prevent circular reference
    if (visited.has(obj)) return paths
    visited.add(obj)
    
    for (const [key, value] of Object.entries(obj)) {
      // Skip internal/circular properties
      if (skipKeys.has(key)) continue
      
      const path = `${prefix}.${key}`
      const sampleValue = formatSampleValue(value)
      
      // Add this path as a leaf or branch
      if (value === null || typeof value !== 'object') {
        // Leaf node
        paths.push({
          path,
          name: key,
          customName: key,
          selected: false,
          sampleValue
        })
      } else if (Array.isArray(value)) {
        // Array - add the array itself and recurse into first item
        paths.push({
          path,
          name: key,
          customName: key,
          selected: false,
          sampleValue: `[${value.length} items]`
        })
        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
          if (!visited.has(value[0])) {
            const childPaths = extractJsonPaths(value[0], `${path}[0]`, depth + 1, visited)
            paths.push(...childPaths)
          }
        }
      } else {
        // Object - add the object itself and recurse
        paths.push({
          path,
          name: key,
          customName: key,
          selected: false,
          sampleValue: '{...}'
        })
        if (!visited.has(value)) {
          const childPaths = extractJsonPaths(value, path, depth + 1, visited)
          paths.push(...childPaths)
        }
      }
    }
  }
  
  return paths
}

function formatSampleValue(value: any): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') {
    return value.length > 50 ? value.substring(0, 50) + '...' : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`
  }
  if (typeof value === 'object') {
    return '{...}'
  }
  return String(value)
}

// Parse existing extendedFields string to get a map of name -> path
function parseExistingExtendedFields(extendedFields: string | undefined): Map<string, string> {
  const map = new Map<string, string>()
  if (!extendedFields) return map
  
  // Parse comma or newline separated entries like "name: $.path, other: $.other.path"
  const entries = extendedFields.split(/[,\n]/).map(e => e.trim()).filter(e => e)
  for (const entry of entries) {
    const colonIdx = entry.indexOf(':')
    if (colonIdx > 0) {
      const name = entry.substring(0, colonIdx).trim()
      const path = entry.substring(colonIdx + 1).trim()
      map.set(path, name)
    }
  }
  return map
}

// Extract field names from pattern (same as ColumnFilterDialog)
function extractPatternFields(patternText: string): string[] {
  const fields: string[] = []
  const seen = new Set<string>()
  
  // Split by newlines to support multiple patterns
  const patterns = patternText.split('\n').map(p => p.trim()).filter(p => p)
  
  for (const pattern of patterns) {
    // First extract ${name} patterns
    const bracedMatches = pattern.matchAll(/\$\{(\w+)\}/g)
    for (const m of bracedMatches) {
      if (!seen.has(m[1])) {
        fields.push(m[1])
        seen.add(m[1])
      }
    }
    
    // Then extract $name patterns (not followed by {, and not already captured as ${name})
    // Remove ${...} first to avoid double-matching
    const withoutBraced = pattern.replace(/\$\{(\w+)\}/g, '')
    const simpleMatches = withoutBraced.matchAll(/\$(\w+)/g)
    for (const m of simpleMatches) {
      if (!seen.has(m[1])) {
        fields.push(m[1])
        seen.add(m[1])
      }
    }
  }
  
  return fields
}

// Mode: 'pattern' for text, 'jsonpath' for JSON
const mode = ref<'pattern' | 'jsonpath'>('pattern')
const patternText = ref('')
const jsonPaths = ref<JsonPathInfo[]>([])

// Initialize when dialog opens
watch(() => props.visible, (visible) => {
  if (visible) {
    const jsonObj = tryParseJson(props.cellValue)
    console.log('[ExtendFieldDialog] Opened, cellValue type:', typeof props.cellValue, 'jsonObj:', jsonObj)
    
    if (jsonObj && typeof jsonObj === 'object') {
      mode.value = 'jsonpath'
      const paths = extractJsonPaths(jsonObj)
      console.log('[ExtendFieldDialog] Extracted paths:', paths.length)
      
      // Parse existing extendedFields and pre-select matching paths
      const existingFields = parseExistingExtendedFields(props.currentExtendedFields)
      for (const pathInfo of paths) {
        if (existingFields.has(pathInfo.path)) {
          pathInfo.selected = true
          pathInfo.customName = existingFields.get(pathInfo.path) || pathInfo.name
        }
      }
      
      jsonPaths.value = paths
      // Also set pattern text for pattern mode
      patternText.value = getStringValue(props.cellValue)
    } else {
      mode.value = 'pattern'
      patternText.value = getStringValue(props.cellValue)
      // Clear jsonPaths when opening a non-JSON cell to avoid showing stale data
      jsonPaths.value = []
    }
  }
})

// Computed for extracted pattern fields (like ColumnFilterDialog)
const previewPatternFields = computed(() => {
  if (!patternText.value) return []
  return extractPatternFields(patternText.value)
})

// Computed for selected JSON paths
const selectedPaths = computed(() => jsonPaths.value.filter(p => p.selected))

// Sync selection to parent immediately when checkbox changes
function onPathSelectionChange() {
  // Use nextTick to ensure v-model has updated before calculating selection
  nextTick(() => {
    const fields = selectedPaths.value.map(p => `${p.customName}: ${p.path}`).join(', ')
    console.log('[ExtendFieldDialog] onPathSelectionChange emitting:', fields)
    emit('updateExtendedFields', fields)
  })
}

// Also sync when custom name changes
function onCustomNameChange() {
  if (selectedPaths.value.length > 0) {
    const fields = selectedPaths.value.map(p => `${p.customName}: ${p.path}`).join(', ')
    emit('updateExtendedFields', fields)
  }
}

function toggleAllPaths(selected: boolean) {
  jsonPaths.value.forEach(p => p.selected = selected)
  onPathSelectionChange()
}

function applyPattern() {
  if (mode.value === 'pattern' && patternText.value) {
    emit('apply', {
      type: 'pattern',
      pattern: patternText.value
    })
    dialogVisible.value = false
  }
}

const canApplyPattern = computed(() => {
  // Must have at least one variable or wildcard
  return patternText.value.includes('$') || patternText.value.includes('*')
})
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    modal
    dismissableMask
    :header="mode === 'pattern' ? 'Create Pattern' : 'Select JSON Fields'"
    :style="{ width: '600px', maxHeight: '80vh' }"
    class="extend-field-dialog"
  >
    <!-- Mode tabs -->
    <div class="mode-tabs">
      <Button
        :severity="mode === 'pattern' ? 'primary' : 'secondary'"
        :outlined="mode !== 'pattern'"
        size="small"
        @click="mode = 'pattern'"
      >
        <i class="pi pi-pencil"></i>
        Pattern Match
      </Button>
      <Button
        :severity="mode === 'jsonpath' ? 'primary' : 'secondary'"
        :outlined="mode !== 'jsonpath'"
        size="small"
        @click="mode = 'jsonpath'"
        :disabled="jsonPaths.length === 0"
      >
        <i class="pi pi-sitemap"></i>
        JSON Fields
      </Button>
    </div>

    <!-- Pattern Mode -->
    <div v-if="mode === 'pattern'" class="pattern-mode">
      <p class="help-text">
        Use <code>${"${"}name{"}"}</code> or <code>$name</code> to extract values, <code>*</code> for wildcard.
      </p>
      
      <Textarea
        v-model="patternText"
        rows="5"
        class="pattern-textarea"
        placeholder="Enter pattern with variables, e.g.: Request: $path $method"
      />
      
      <div v-if="previewPatternFields.length > 0" class="pattern-fields">
        <span class="pattern-fields-label">Extracted:</span>
        <span v-for="f in previewPatternFields" :key="f" class="pattern-field-tag">
          {{ f }}
        </span>
      </div>
      <div v-else-if="patternText" class="pattern-hint">
        Use ${"${"}name{"}"} or $name to extract values, * for wildcard
      </div>
      
      <div class="pattern-footer">
        <Button
          label="Apply Pattern"
          :disabled="!canApplyPattern"
          @click="applyPattern"
        />
      </div>
    </div>

    <!-- JSON Path Mode -->
    <div v-else-if="mode === 'jsonpath'" class="jsonpath-mode">
      <p class="help-text">
        Select fields to extract from this JSON value. Changes are applied immediately.
      </p>
      
      <div class="path-actions">
        <Button size="small" severity="secondary" @click="toggleAllPaths(true)">
          Select All
        </Button>
        <Button size="small" severity="secondary" @click="toggleAllPaths(false)">
          Deselect All
        </Button>
      </div>
      
      <div class="path-list">
        <div
          v-for="pathInfo in jsonPaths"
          :key="pathInfo.path"
          class="path-item"
        >
          <Checkbox
            v-model="pathInfo.selected"
            :inputId="pathInfo.path"
            :binary="true"
            @update:model-value="onPathSelectionChange"
          />
          <label :for="pathInfo.path" class="path-label">
            <span class="path-name">{{ pathInfo.path }}</span>
            <span class="path-sample">{{ pathInfo.sampleValue }}</span>
          </label>
          <InputText
            v-if="pathInfo.selected"
            v-model="pathInfo.customName"
            size="small"
            class="path-custom-name"
            placeholder="Field name"
            @input="onCustomNameChange"
          />
        </div>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.mode-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.help-text {
  color: var(--text-color-secondary);
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.help-text code {
  background: var(--surface-100);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}

.pattern-mode {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pattern-textarea {
  width: 100%;
  font-family: monospace;
  font-size: 0.9rem;
}

.pattern-fields {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pattern-fields-label {
  color: var(--text-color-secondary);
  font-size: 0.85rem;
}

.pattern-field-tag {
  background: var(--primary-100, #e3f2fd);
  color: var(--primary-700, #1976d2);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-family: monospace;
}

.pattern-hint {
  color: var(--text-color-secondary);
  font-size: 0.85rem;
  font-style: italic;
}

.pattern-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.jsonpath-mode {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.path-actions {
  display: flex;
  gap: 0.5rem;
}

.path-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--surface-200);
  border-radius: 4px;
  padding: 0.5rem;
}

.path-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--surface-100);
}

.path-item:last-child {
  border-bottom: none;
}

.path-label {
  flex: 1;
  display: flex;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.path-name {
  font-family: monospace;
  color: var(--primary-color);
}

.path-sample {
  color: var(--text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.path-custom-name {
  width: 120px;
}
</style>
