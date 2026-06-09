<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import Popover from 'primevue/popover'
import ColumnFilterBasicControls from './ColumnFilterBasicControls.vue'

const props = withDefaults(defineProps<{
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
  popoverClass?: string
  width?: number
  baseZIndex?: number
}>(), {
  showAdvanced: false,
  showJs: true,
  showHideColumn: true,
  popoverClass: 'column-filter-popover',
  width: 420,
  baseZIndex: 1100,
})

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

const popoverRef = ref<InstanceType<typeof Popover> | null>(null)
const isPopoverVisible = ref(false)
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null
let autoCloseOnShow = false

const localQuery = computed({
  get: () => props.query,
  set: (value: string) => emit('update:query', value),
})

const localIsRegex = computed({
  get: () => !!props.isRegex,
  set: (value: boolean) => emit('update:isRegex', value),
})

const localIsExact = computed({
  get: () => !!props.isExact,
  set: (value: boolean) => emit('update:isExact', value),
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

function getPopoverElement(): HTMLElement | null {
  const fromInstance = (popoverRef.value as any)?.container as HTMLElement | undefined
  if (fromInstance) return fromInstance
  const candidates = document.querySelectorAll(`.${props.popoverClass}.p-popover`)
  return (candidates[candidates.length - 1] as HTMLElement) || null
}

function cancelAutoClose() {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
    autoCloseTimer = null
  }
}

function scheduleAutoClose() {
  if (!isPopoverVisible.value) return
  cancelAutoClose()
  autoCloseTimer = setTimeout(() => {
    hide()
    autoCloseTimer = null
  }, 2000)
}

function handleDocumentMouseMove(event: MouseEvent) {
  if (!isPopoverVisible.value) return
  const popoverEl = getPopoverElement()
  if (!popoverEl) return

  const target = event.target as Node | null
  const isInside = !!target && popoverEl.contains(target)
  if (isInside) cancelAutoClose()
  else scheduleAutoClose()
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!isPopoverVisible.value) return
  const popoverEl = getPopoverElement()
  const target = event.target as Node | null
  if (!popoverEl || !target || popoverEl.contains(target)) return

  hide()
}

function focusInput() {
  setTimeout(() => {
    const popoverContent = getPopoverElement()?.querySelector('.p-popover-content')
    const inputEl = popoverContent?.querySelector('input') as HTMLInputElement | null
    inputEl?.focus()
  }, 50)
}

function onPopoverShow() {
  isPopoverVisible.value = true
  cancelAutoClose()
  document.addEventListener('mousemove', handleDocumentMouseMove)
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  if (autoCloseOnShow) {
    scheduleAutoClose()
    autoCloseOnShow = false
  }
  focusInput()
}

function onPopoverHide() {
  isPopoverVisible.value = false
  autoCloseOnShow = false
  cancelAutoClose()
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
}

function show(event: Event, options: { autoClose?: boolean } = {}) {
  autoCloseOnShow = !!options.autoClose
  popoverRef.value?.show(event)
}

function hide() {
  cancelAutoClose()
  autoCloseOnShow = false
  isPopoverVisible.value = false
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  popoverRef.value?.hide()
}

function toggle(event: Event) {
  popoverRef.value?.toggle(event)
}

onBeforeUnmount(() => {
  hide()
})

defineExpose({ show, hide, toggle })
</script>

<template>
  <Popover
    ref="popoverRef"
    appendTo="body"
    :baseZIndex="baseZIndex"
    :style="{ width: `${width}px` }"
    :class="popoverClass"
    @show="onPopoverShow"
    @hide="onPopoverHide"
  >
    <div class="basic-filter-popover-content">
      <ColumnFilterBasicControls
        v-model:query="localQuery"
        v-model:is-regex="localIsRegex"
        v-model:is-exact="localIsExact"
        v-model:is-negate="localIsNegate"
        v-model:is-array="localIsArray"
        v-model:is-disabled="localIsDisabled"
        v-model:is-js="localIsJs"
        :field="field"
        :show-advanced="showAdvanced"
        :show-js="showJs"
        :show-hide-column="showHideColumn"
        @apply="emit('apply')"
        @clear="emit('clear')"
        @keydown="emit('keydown', $event)"
        @advanced="emit('advanced')"
        @hide-column="emit('hide-column')"
      />
    </div>
  </Popover>
</template>

<style scoped>
.basic-filter-popover-content {
  width: 100%;
}
</style>
