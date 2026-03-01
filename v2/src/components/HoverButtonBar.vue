<script setup lang="ts">
/**
 * HoverButtonBar - A reusable hover-activated button bar component
 * 
 * Usage modes:
 * 1. CSS hover mode (default): Parent element uses .hover-parent class, bar appears on parent hover
 * 2. JS hover mode: Pass isVisible prop, controlled via @mouseenter/@mouseleave
 * 
 * Positioning:
 * - 'absolute' (default): Positioned absolutely within parent, good for table cells
 * - 'inline': Flows inline with content, good for tree nodes
 */

export interface HoverButton {
  /** Unique identifier for the button */
  id: string
  /** PrimeIcons icon class (e.g., 'pi-copy', 'pi-filter') */
  icon: string
  /** Tooltip title */
  title: string
  /** Whether the button should be visible (default: true) */
  visible?: boolean
  /** Custom style for the button (e.g., for color picker) */
  style?: Record<string, string>
  /** Additional CSS class for hover color: 'copy', 'filter-in', 'filter-out', 'extend', 'color' */
  variant?: 'copy' | 'filter-in' | 'filter-out' | 'extend' | 'color' | 'link'
}

const props = withDefaults(defineProps<{
  /** Array of button configurations */
  buttons: HoverButton[]
  /** Whether to show the bar (for JS-controlled visibility via v-show) */
  isVisible?: boolean
  /** Positioning mode: 'absolute' (default) or 'inline' */
  layout?: 'absolute' | 'inline'
}>(), {
  layout: 'absolute'
})

const emit = defineEmits<{
  (e: 'click', buttonId: string): void
}>()

function handleClick(buttonId: string, event: MouseEvent) {
  event.stopPropagation()
  emit('click', buttonId)
}

const visibleButtons = () => props.buttons.filter(b => b.visible !== false)
</script>

<template>
  <!-- For inline layout: use v-show (JS-controlled visibility)
       For absolute layout: always render, CSS handles visibility via opacity -->
  <div 
    class="hover-button-bar"
    :class="{ 
      'layout-inline': layout === 'inline',
      'layout-absolute': layout === 'absolute'
    }"
    v-show="layout === 'absolute' || isVisible"
  >
    <button
      v-for="btn in visibleButtons()"
      :key="btn.id"
      class="hover-btn"
      :class="btn.variant ? `hover-btn--${btn.variant}` : ''"
      :title="btn.title"
      :style="btn.style"
      @click="handleClick(btn.id, $event)"
    >
      <i :class="['pi', btn.icon]"></i>
    </button>
  </div>
</template>

<style scoped>
/* Base button bar styles */
.hover-button-bar {
  display: flex;
  gap: 2px;
  padding: 2px 4px;
  background: rgba(var(--tdv-surface-rgb, 255, 255, 255), 0.5);
  backdrop-filter: blur(4px);
  border: 1px solid var(--tdv-surface-border);
  border-radius: 4px;
  z-index: 100; /* High z-index to appear above table cells */
}

/* Absolute positioning (for table cells, statistics rows) */
.hover-button-bar.layout-absolute {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
}

/* 
 * Visibility styles - unscoped so parent components can override via hover rules.
 * Parents should add: .parent:hover .my-button-bar { opacity: 1; pointer-events: auto; }
 */
:global(.hover-button-bar.layout-absolute) {
  opacity: 0;
  transition: opacity 0.15s;
  transition-delay: 0s;
  pointer-events: none;
}

/* Inline positioning (for tree nodes) */
.hover-button-bar.layout-inline {
  position: relative;
  margin-left: 8px;
  background: var(--tdv-surface-light);
}

/* Base button styles */
.hover-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--tdv-text-muted);
  padding: 3px 5px;
  border-radius: 3px;
  font-size: 0.85rem;
  transition: color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hover-btn:hover {
  background: var(--tdv-hover-bg);
}

.hover-btn i {
  font-size: 11px;
}

/* Button variants - hover colors */
.hover-btn--copy:hover,
.hover-btn--link:hover {
  color: var(--tdv-primary);
}

.hover-btn--filter-in:hover {
  color: var(--tdv-success, #22c55e);
}

.hover-btn--filter-out:hover {
  color: var(--tdv-danger, #ef4444);
}

.hover-btn--extend:hover,
.hover-btn--color:hover {
  color: var(--tdv-info, #3b82f6);
}

/* Dark mode adjustments for inline layout */
:global(.dark-mode) .hover-button-bar.layout-inline {
  background: #374151;
  border-color: #6b7280;
}

:global(.dark-mode) .hover-button-bar.layout-inline .hover-btn {
  color: #f3f4f6;
}

:global(.dark-mode) .hover-button-bar.layout-inline .hover-btn:hover {
  background: #6b7280;
}

/* Dark mode adjustments for absolute layout */
:global(.dark-mode) .hover-button-bar.layout-absolute {
  background: rgba(55, 65, 81, 0.8);
  border-color: #6b7280;
}
</style>
