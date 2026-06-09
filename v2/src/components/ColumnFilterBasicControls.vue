<script setup lang="ts">
import { computed } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ToggleButton from 'primevue/togglebutton'

const props = defineProps<{
  field: string
  query: string
  isRegex?: boolean
  isExact?: boolean
  isNegate?: boolean
  isArray?: boolean
  isDisabled?: boolean
  isJs?: boolean
  showAdvanced?: boolean
  showJs?: boolean
  showHideColumn?: boolean
}>()

const emit = defineEmits<{
  'update:query': [value: string]
  'update:isRegex': [value: boolean]
  'update:isExact': [value: boolean]
  'update:isNegate': [value: boolean]
  'update:isArray': [value: boolean]
  'update:isDisabled': [value: boolean]
  'update:isJs': [value: boolean]
  apply: []
  clear: []
  keydown: [event: KeyboardEvent]
  advanced: []
  'hide-column': []
}>()

const localQuery = computed({
  get: () => props.query,
  set: (value: string) => emit('update:query', value),
})

const localIsRegex = computed({
  get: () => !!props.isRegex,
  set: (value: boolean) => {
    emit('update:isRegex', value)
    if (value) emit('update:isExact', false)
  },
})

const localIsExact = computed({
  get: () => !!props.isExact,
  set: (value: boolean) => {
    emit('update:isExact', value)
    if (value) emit('update:isRegex', false)
  },
})

const localIsNegate = computed({
  get: () => !!props.isNegate,
  set: (value: boolean) => emit('update:isNegate', value),
})

const localIsArray = computed({
  get: () => !!props.isArray,
  set: (value: boolean) => emit('update:isArray', value),
})

const localIsDisabled = computed({
  get: () => !!props.isDisabled,
  set: (value: boolean) => emit('update:isDisabled', value),
})

const localIsJs = computed({
  get: () => !!props.isJs,
  set: (value: boolean) => emit('update:isJs', value),
})
</script>

<template>
  <div class="filter-input-row" :class="{ 'filter-paused': localIsDisabled }">
    <div class="filter-input-wrapper">
      <InputText
        v-model="localQuery"
        :placeholder="localIsJs ? 'JS expression, e.g.: $.length > 10 ($ = field value)' : `Search ${field}...`"
        class="filter-input"
        :class="{ 'js-mode-input': localIsJs }"
        :disabled="localIsDisabled"
        @keydown="emit('keydown', $event)"
        @input="emit('apply')"
      />
      <button
        v-if="localQuery"
        class="input-clear-btn"
        @click="emit('clear')"
        type="button"
        tabindex="-1"
      >
        <i class="pi pi-times"></i>
      </button>
    </div>
  </div>

  <div class="filter-options" :class="{ 'filter-paused': localIsDisabled, 'filter-js-mode': localIsJs }">
    <ToggleButton
      v-model="localIsNegate"
      onLabel="!"
      offLabel="!"
      @change="emit('apply')"
      v-tooltip.top="'Negate filter (exclude matches)'"
      class="filter-option-btn"
      :class="{ 'is-active': localIsNegate && !localIsJs }"
      :style="localIsNegate && !localIsJs ? { background: '#3b82f6', borderColor: '#3b82f6', color: 'white' } : {}"
      :disabled="localIsDisabled || localIsJs"
    />
    <ToggleButton
      v-model="localIsRegex"
      onLabel=".*"
      offLabel=".*"
      @change="emit('apply')"
      v-tooltip.top="'Regex matching'"
      class="filter-option-btn"
      :class="{ 'is-active': localIsRegex && !localIsJs }"
      :style="localIsRegex && !localIsJs ? { background: '#3b82f6', borderColor: '#3b82f6', color: 'white' } : {}"
      :disabled="localIsDisabled || localIsJs"
    />
    <ToggleButton
      v-model="localIsExact"
      onLabel="="
      offLabel="="
      @change="emit('apply')"
      v-tooltip.top="'Exact match'"
      class="filter-option-btn"
      :class="{ 'is-active': localIsExact && !localIsJs }"
      :style="localIsExact && !localIsJs ? { background: '#3b82f6', borderColor: '#3b82f6', color: 'white' } : {}"
      :disabled="localIsDisabled || localIsJs"
    />
    <ToggleButton
      v-model="localIsArray"
      onLabel="[]"
      offLabel="[]"
      @change="emit('apply')"
      v-tooltip.top="'Array (comma-separated values)'"
      class="filter-option-btn"
      :class="{ 'is-active': localIsArray && !localIsJs }"
      :style="localIsArray && !localIsJs ? { background: '#3b82f6', borderColor: '#3b82f6', color: 'white' } : {}"
      :disabled="localIsDisabled || localIsJs"
    />
    <ToggleButton
      v-if="showJs !== false"
      v-model="localIsJs"
      onLabel="JS"
      offLabel="JS"
      @change="emit('apply')"
      v-tooltip.top="'JavaScript expression (use $ for field value)'"
      class="filter-option-btn"
      :class="{ 'is-js-active': localIsJs }"
      :style="localIsJs ? { background: '#0ea5e9', borderColor: '#0ea5e9', color: 'white' } : {}"
      :disabled="localIsDisabled"
    />
    <div class="filter-options-separator"></div>
    <ToggleButton
      v-model="localIsDisabled"
      onLabel="||"
      offLabel="||"
      @change="emit('apply')"
      v-tooltip.top="'Pause Filter'"
      class="filter-option-btn pause-btn"
      :class="{ 'is-paused-active': localIsDisabled }"
      :style="localIsDisabled ? { background: '#f59e0b', borderColor: '#f59e0b', color: 'white' } : {}"
    />
    <div class="filter-options-spacer"></div>
    <Button
      v-if="showAdvanced"
      icon="pi pi-sliders-h"
      label="Advanced"
      size="small"
      outlined
      severity="secondary"
      class="advanced-filter-btn"
      @click="emit('advanced')"
      v-tooltip.top="'Open advanced filter'"
    />
    <Button
      v-if="showHideColumn !== false"
      icon="pi pi-eye-slash"
      size="small"
      text
      severity="secondary"
      @click="emit('hide-column')"
      v-tooltip.top="'Hide column'"
      class="hide-column-btn"
    />
  </div>
</template>

<style scoped>
.filter-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.filter-input {
  flex: 1;
  padding-right: 28px;
  width: 100%;
}

.input-clear-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--tdv-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  padding: 0;
  transition: all 0.15s ease;
}

.input-clear-btn:hover {
  background: var(--tdv-surface-hover);
  color: var(--tdv-text);
}

.input-clear-btn i {
  font-size: 10px;
}

.filter-options {
  display: flex;
  gap: 4px;
  align-items: center;
}

.filter-option-btn {
  width: 32px;
  min-width: 32px;
  max-width: 32px;
  height: 26px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  font-size: 0.7rem;
  padding: 0;
  background: var(--tdv-surface-light);
  border: 1px solid var(--tdv-surface-border);
  color: var(--tdv-text);
}

:global(.dark-mode) .filter-option-btn {
  background: #4b5563 !important;
  border: 1.5px solid #9ca3af !important;
  color: #f3f4f6 !important;
}

:global(.dark-mode) .filter-option-btn:hover {
  background: #6b7280 !important;
  border-color: #d1d5db !important;
}

.filter-option-btn :deep(.p-togglebutton-content) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.filter-option-btn :deep(.p-togglebutton-label) {
  font-size: 0.7rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

:global(.filter-option-btn.is-active),
:global(.filter-option-btn.is-active.p-togglebutton),
:global(.filter-option-btn.is-active.p-togglebutton-checked),
:global(button.p-togglebutton.filter-option-btn.is-active) {
  background: #3b82f6 !important;
  background-color: #3b82f6 !important;
  border-color: #3b82f6 !important;
  color: white !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

:global(.filter-option-btn.is-active .p-togglebutton-label),
:global(.filter-option-btn.is-active span),
:global(.filter-option-btn.is-active .p-togglebutton-content),
:global(.filter-option-btn.is-js-active .p-togglebutton-label),
:global(.filter-option-btn.is-js-active span),
:global(.filter-option-btn.is-js-active .p-togglebutton-content),
:global(.filter-option-btn.is-paused-active .p-togglebutton-label),
:global(.filter-option-btn.is-paused-active span),
:global(.filter-option-btn.is-paused-active .p-togglebutton-content) {
  color: white !important;
}

:global(.filter-option-btn.is-active .p-togglebutton-content) {
  background: #3b82f6 !important;
  background-color: #3b82f6 !important;
}

:global(.filter-option-btn.is-js-active),
:global(.filter-option-btn.is-js-active.p-togglebutton),
:global(.filter-option-btn.is-js-active.p-togglebutton-checked),
:global(button.p-togglebutton.filter-option-btn.is-js-active) {
  background: #0ea5e9 !important;
  background-color: #0ea5e9 !important;
  border-color: #0ea5e9 !important;
  color: white !important;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.3);
}

:global(.filter-option-btn.is-js-active .p-togglebutton-content) {
  background: #0ea5e9 !important;
  background-color: #0ea5e9 !important;
}

:global(.filter-option-btn.is-paused-active),
:global(.filter-option-btn.is-paused-active.p-togglebutton),
:global(.filter-option-btn.is-paused-active.p-togglebutton-checked),
:global(button.p-togglebutton.filter-option-btn.is-paused-active) {
  background: #f59e0b !important;
  background-color: #f59e0b !important;
  border-color: #f59e0b !important;
  color: white !important;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3);
}

:global(.filter-option-btn.is-paused-active .p-togglebutton-content) {
  background: #f59e0b !important;
  background-color: #f59e0b !important;
}

.filter-paused .filter-option-btn:not(.pause-btn),
.filter-js-mode .filter-option-btn:not(.is-js-active):not(.pause-btn) {
  opacity: 0.5;
}

.filter-paused .filter-option-btn:not(.pause-btn) {
  pointer-events: none;
}

.filter-paused .filter-input,
.filter-paused .input-clear-btn {
  opacity: 0.5;
}

.filter-paused .input-clear-btn {
  pointer-events: none;
}

.filter-options-separator {
  width: 1px;
  height: 20px;
  background: var(--tdv-surface-border);
  margin: 0 2px;
}

.filter-options-spacer {
  flex: 1;
}

.pause-btn {
  width: 32px;
  min-width: 32px;
}

.advanced-filter-btn {
  height: 26px;
  padding: 0 8px;
}

.hide-column-btn {
  padding: 0.25rem;
}

.hide-column-btn :deep(.p-button-icon) {
  font-size: 0.85rem;
}

.js-mode-input {
  font-family: var(--tdv-font-mono);
}
</style>
