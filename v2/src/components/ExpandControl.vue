<script setup lang="ts">
import { ref, reactive } from 'vue'
import Button from 'primevue/button'

export interface ExpandState {
  expandLevel: number
  minLevel: number
  fullyExpand: boolean
  moreLevel: boolean
  showChildrenSummary: boolean
}

const props = defineProps<{
  state: ExpandState
  active?: boolean
}>()

const emit = defineEmits<{
  update: [state: ExpandState]
}>()

function collapse() {
  if (props.state.expandLevel > props.state.minLevel) {
    props.state.expandLevel--
  }
  props.state.fullyExpand = false
}

function collapseAll() {
  props.state.expandLevel = props.state.minLevel
  props.state.fullyExpand = false
}

function canCollapse(): boolean {
  return props.state.expandLevel > props.state.minLevel || props.state.fullyExpand
}

function expand() {
  if (!canExpand()) return
  props.state.moreLevel = false
  props.state.expandLevel++
}

function expandAll() {
  props.state.moreLevel = false
  props.state.fullyExpand = true
}

function canExpand(): boolean {
  return props.state.moreLevel
}

function onKeyPress(e: KeyboardEvent) {
  switch (e.key) {
    case 's':
      props.state.showChildrenSummary = !props.state.showChildrenSummary
      break
    case ',':
      collapse()
      break
    case '.':
      expand()
      break
    case '<':
      collapseAll()
      break
    case '>':
      expandAll()
      break
  }
}

defineExpose({ onKeyPress })
</script>

<template>
  <div class="expand-control">
    <Button
      icon="pi pi-angle-double-left"
      size="small"
      text
      :disabled="!canCollapse()"
      @click="collapseAll"
      v-tooltip.top="'Collapse all [<]'"
    />
    <Button
      icon="pi pi-angle-left"
      size="small"
      text
      :disabled="!canCollapse()"
      @click="collapse"
      v-tooltip.top="'Collapse one level <,>'"
    />
    <span class="expand-level">{{ state.expandLevel }}</span>
    <Button
      icon="pi pi-angle-right"
      size="small"
      text
      :disabled="!canExpand()"
      @click="expand"
      v-tooltip.top="'Expand one level <.>'"
    />
    <Button
      icon="pi pi-angle-double-right"
      size="small"
      text
      :disabled="!canExpand()"
      @click="expandAll"
      v-tooltip.top="'Expand all [>]'"
    />
    <Button
      :icon="state.showChildrenSummary ? 'pi pi-eye' : 'pi pi-eye-slash'"
      size="small"
      :severity="state.showChildrenSummary ? 'primary' : 'secondary'"
      text
      @click="state.showChildrenSummary = !state.showChildrenSummary"
      v-tooltip.top="'Toggle show children summary <s>'"
    />
  </div>
</template>

<style scoped>
.expand-control {
  display: flex;
  align-items: center;
  gap: 2px;
}

.expand-level {
  min-width: 20px;
  text-align: center;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--tdv-accent);
}
</style>
