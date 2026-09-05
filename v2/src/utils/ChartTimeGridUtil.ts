export type ChartTimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month'

export interface ChartDaySpan {
  start: number
  end: number
  isWeekend: boolean
}

export interface ChartCalendarAdapter {
  startOf(timestamp: number, unit: 'day'): number | Date
  add(timestamp: number, amount: number, unit: ChartTimeUnit): number | Date
  format(timestamp: number, format: string): string
}

export interface ChartGridTick {
  value: number
  major: boolean
}

export function isTimeUnitFinerThanDay(unit: ChartTimeUnit | undefined): boolean {
  return unit === 'second' || unit === 'minute' || unit === 'hour'
}

export function getAdapterGridTicks(
  min: number,
  max: number,
  unit: ChartTimeUnit,
  stepSize: number,
  adapter: ChartCalendarAdapter,
): ChartGridTick[] {
  if (!isTimeUnitFinerThanDay(unit) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return []

  const step = Math.max(1, Math.floor(stepSize))
  const unitMilliseconds = unit === 'second' ? 1_000 : unit === 'minute' ? 60_000 : 3_600_000
  const dayStart = Number(adapter.startOf(min, 'day'))
  if (!Number.isFinite(dayStart)) return []

  const estimatedSteps = Math.max(0, Math.floor((min - dayStart) / (unitMilliseconds * step)))
  let cursor = Number(adapter.add(dayStart, estimatedSteps * step, unit))
  if (!Number.isFinite(cursor)) return []

  while (cursor > min) {
    const previous = Number(adapter.add(cursor, -step, unit))
    if (!Number.isFinite(previous) || previous >= cursor) return []
    cursor = previous
  }
  while (cursor < min) {
    const next = Number(adapter.add(cursor, step, unit))
    if (!Number.isFinite(next) || next <= cursor) return []
    cursor = next
  }

  const ticks: ChartGridTick[] = []
  while (cursor <= max && ticks.length < 100_000) {
    ticks.push({
      value: cursor,
      major: cursor === Number(adapter.startOf(cursor, 'day')),
    })
    const next = Number(adapter.add(cursor, step, unit))
    if (!Number.isFinite(next) || next <= cursor) break
    cursor = next
  }

  return ticks
}

export function getAdapterDaySpans(
  min: number,
  max: number,
  adapter: ChartCalendarAdapter,
): ChartDaySpan[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return []

  let cursor = Number(adapter.startOf(min, 'day'))
  if (!Number.isFinite(cursor)) return []
  const spans: ChartDaySpan[] = []

  while (cursor < max) {
    const start = cursor
    const end = Number(adapter.add(start, 1, 'day'))
    if (!Number.isFinite(end) || end <= start) break
    const isoDayOfWeek = Number(adapter.format(start, 'i'))
    spans.push({
      start,
      end,
      isWeekend: isoDayOfWeek === 6 || isoDayOfWeek === 7,
    })
    cursor = end
  }

  return spans
}
