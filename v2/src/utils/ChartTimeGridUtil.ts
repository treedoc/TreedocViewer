export type ChartTimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month'

export interface ChartDaySpan {
  start: number
  end: number
  isWeekend: boolean
}

export interface ChartCalendarAdapter {
  startOf(timestamp: number, unit: 'day'): number | Date
  add(timestamp: number, amount: number, unit: 'day'): number | Date
  format(timestamp: number, format: string): string
}

export function isTimeUnitFinerThanDay(unit: ChartTimeUnit | undefined): boolean {
  return unit === 'second' || unit === 'minute' || unit === 'hour'
}

export function alignTimeRangeToGrid(
  range: { min?: number; max?: number },
  unit: ChartTimeUnit,
  stepSize = 1,
): { min?: number; max?: number } {
  if (!isTimeUnitFinerThanDay(unit) || range.min === undefined || range.max === undefined) return range
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.max <= range.min) return range

  const step = Math.max(1, Math.floor(stepSize))
  const oneLocalDayLater = new Date(range.min)
  oneLocalDayLater.setDate(oneLocalDayLater.getDate() + 1)
  const shouldAnchorToMidnight = range.max >= oneLocalDayLater.getTime()
  const localMidnight = new Date(range.min)
  localMidnight.setHours(0, 0, 0, 0)
  const align = (value: number, roundUp: boolean): number => {
    const date = new Date(value)
    if (unit === 'second') {
      date.setMilliseconds(0)
      if (roundUp && date.getTime() < value) date.setSeconds(date.getSeconds() + step)
    } else if (unit === 'minute') {
      date.setMinutes(Math.floor(date.getMinutes() / step) * step, 0, 0)
      if (roundUp && date.getTime() < value) date.setMinutes(date.getMinutes() + step)
    } else {
      date.setHours(Math.floor(date.getHours() / step) * step, 0, 0, 0)
      if (roundUp && date.getTime() < value) date.setHours(date.getHours() + step)
    }
    return date.getTime()
  }

  const alignedMin = shouldAnchorToMidnight
    ? localMidnight.getTime()
    : align(range.min, false)

  return {
    min: alignedMin,
    max: align(range.max, true),
  }
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
