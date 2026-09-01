export type ChartTimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month'

export interface ChartDaySpan {
  start: number
  end: number
  isWeekend: boolean
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
  const oneUtcDayLater = new Date(range.min)
  oneUtcDayLater.setUTCDate(oneUtcDayLater.getUTCDate() + 1)
  const shouldAnchorToMidnight = range.max >= oneUtcDayLater.getTime()
  const utcMidnight = new Date(range.min)
  utcMidnight.setUTCHours(0, 0, 0, 0)
  const align = (value: number, roundUp: boolean): number => {
    const date = new Date(value)
    if (unit === 'second') {
      date.setUTCMilliseconds(0)
      if (roundUp && date.getTime() < value) date.setUTCSeconds(date.getUTCSeconds() + step)
    } else if (unit === 'minute') {
      date.setUTCMinutes(Math.floor(date.getUTCMinutes() / step) * step, 0, 0)
      if (roundUp && date.getTime() < value) date.setUTCMinutes(date.getUTCMinutes() + step)
    } else {
      date.setUTCHours(Math.floor(date.getUTCHours() / step) * step, 0, 0, 0)
      if (roundUp && date.getTime() < value) date.setUTCHours(date.getUTCHours() + step)
    }
    return date.getTime()
  }

  const alignedMin = shouldAnchorToMidnight
    ? utcMidnight.getTime()
    : align(range.min, false)

  return {
    min: alignedMin,
    max: align(range.max, true),
  }
}

export function getUtcDaySpans(min: number, max: number): ChartDaySpan[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return []

  const cursor = new Date(min)
  cursor.setUTCHours(0, 0, 0, 0)
  const spans: ChartDaySpan[] = []

  while (cursor.getTime() < max) {
    const start = cursor.getTime()
    const dayOfWeek = cursor.getUTCDay()
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    spans.push({
      start,
      end: cursor.getTime(),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    })
  }

  return spans
}
