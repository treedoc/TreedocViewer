import { tryParseDate } from './DateUtil'
import type { ChartThreshold } from '@/models/types'

// Each threshold colors the band from its value to the next higher active value.
// Time bounds are optional, inclusive start and exclusive end.
export function thresholdBands(thresholds: ChartThreshold[], min: number, max: number) {
  const valid = thresholds.map(threshold => ({
    ...threshold,
    startMs: threshold.start ? (tryParseDate(threshold.start)?.getTime() ?? NaN) : min,
    endMs: threshold.end ? (tryParseDate(threshold.end)?.getTime() ?? NaN) : max,
  })).filter(t => Number.isFinite(t.value) && Number.isFinite(t.startMs) && Number.isFinite(t.endMs)
    && t.endMs > t.startMs && t.startMs < max && t.endMs > min)
  const boundaries = [...new Set([min, max, ...valid.flatMap(t => [Math.max(min, t.startMs), Math.min(max, t.endMs)])])].sort((a, b) => a - b)
  return boundaries.slice(0, -1).flatMap((start, index) => {
    const end = boundaries[index + 1]
    const active = valid.filter(t => t.startMs <= start && t.endMs > start).sort((a, b) => a.value - b.value)
    return active.map((t, i) => ({ start, end, value: t.value, upper: active[i + 1]?.value, color: t.color }))
  })
}
