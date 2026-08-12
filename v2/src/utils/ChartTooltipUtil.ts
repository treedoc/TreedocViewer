export interface TooltipPoint {
  x: number | null
  y: number | null
}

export interface TooltipSize {
  width: number
  height: number
}

export interface TooltipPosition {
  left: number
  top: number
}

export interface TooltipDataset {
  label?: string
  tooltipLabel?: string
}

export function getTooltipDatasetLabel(dataset: TooltipDataset | undefined): string {
  return dataset?.tooltipLabel ?? dataset?.label ?? ''
}

export function getHtmlTooltipPosition(
  container: TooltipSize,
  pointer: TooltipPoint,
  tooltip: TooltipSize,
  gap = 12,
): TooltipPosition | false {
  if (pointer.x == null || pointer.y == null) return false

  const preferredLeft = pointer.x <= container.width / 2
    ? pointer.x + gap
    : pointer.x - tooltip.width - gap

  return {
    left: Math.max(0, Math.min(preferredLeft, container.width - tooltip.width)),
    top: Math.max(0, Math.min(pointer.y - tooltip.height / 2, container.height - tooltip.height)),
  }
}
