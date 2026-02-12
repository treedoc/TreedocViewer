/**
 * Date/time utilities for timestamp detection and formatting
 */

const START_TIME = new Date('1980-01-01').getTime()
const END_TIME = new Date('2040-01-01').getTime()

/**
 * Try to parse a number as a valid date within reasonable bounds
 */
export function tryDate(val: number): Date | null {
  if (val > START_TIME && val < END_TIME) {
    return new Date(val)
  }
  return null
}

/**
 * Format a Date object as a locale string with 24-hour time
 */
export function formatDate(d: Date): string {
  const date = d.toLocaleDateString()
  const time = d.toLocaleTimeString(undefined, { hour12: false })
  return `${date},${time}`
}

/**
 * Try to get a formatted timestamp hint from a value
 * Handles milliseconds, seconds, and microseconds
 */
export function getTimestampHint(val: unknown): string | null {
  const num = Number(val)
  if (isNaN(num)) return null
  const d = tryDate(num) || tryDate(num * 1000) || tryDate(num / 1000_000)
  return d ? formatDate(d) : null
}
