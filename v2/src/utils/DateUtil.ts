/**
 * Date/time utilities for timestamp detection and formatting
 */

const START_TIME = new Date('1980-01-01').getTime()
const END_TIME = new Date('2040-01-01').getTime()

/**
 * Date string patterns for recognition
 * Each pattern has a regex and an optional parser function
 * Add new patterns here to extend date recognition
 */
export interface DatePattern {
  name: string
  regex: RegExp
  parse?: (match: RegExpMatchArray) => Date | null
}

/**
 * Built-in date patterns - add more patterns here
 */
export const DATE_PATTERNS: DatePattern[] = [
  {
    // ISO 8601: 2026-03-23T18:51:07.318254Z or 2026-03-23T18:51:07Z
    name: 'ISO 8601',
    regex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/,
  },
  {
    // ISO date with space: 2026-03-23 18:51:07
    name: 'ISO with space',
    regex: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/,
  },
  {
    // Date only: 2026-03-23
    name: 'Date only',
    regex: /^\d{4}-\d{2}-\d{2}$/,
  },
  {
    // US format: 03/23/2026 or 03-23-2026
    name: 'US date',
    regex: /^\d{2}[/-]\d{2}[/-]\d{4}$/,
    parse: (match) => {
      const str = match[0]
      const sep = str.includes('/') ? '/' : '-'
      const [month, day, year] = str.split(sep).map(Number)
      const d = new Date(year, month - 1, day)
      return isValidDate(d) ? d : null
    },
  },
  {
    // US format with time: 03/23/2026 18:51:07
    name: 'US date with time',
    regex: /^\d{2}[/-]\d{2}[/-]\d{4} \d{2}:\d{2}:\d{2}$/,
    parse: (match) => {
      const str = match[0]
      const [datePart, timePart] = str.split(' ')
      const sep = datePart.includes('/') ? '/' : '-'
      const [month, day, year] = datePart.split(sep).map(Number)
      const [hour, minute, second] = timePart.split(':').map(Number)
      const d = new Date(year, month - 1, day, hour, minute, second)
      return isValidDate(d) ? d : null
    },
  },
  {
    // RFC 2822: Mon, 23 Mar 2026 18:51:07 GMT
    name: 'RFC 2822',
    regex: /^[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}/,
  },
  {
    // Unix timestamp as string (10 or 13 digits)
    name: 'Unix timestamp string',
    regex: /^\d{10}(\d{3})?$/,
    parse: (match) => {
      const num = Number(match[0])
      return tryDateFromNumber(num)
    },
  },
]

/**
 * Check if a Date object is valid
 */
function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime())
}

/**
 * Try to parse a number as a valid date within reasonable bounds
 */
export function tryDate(val: number): Date | null {
  return tryDateFromNumber(val)
}

/**
 * Try to parse a number as a valid date, handling ms, seconds, and microseconds
 */
export function tryDateFromNumber(val: number): Date | null {
  // Try as milliseconds
  if (val > START_TIME && val < END_TIME) {
    return new Date(val)
  }
  // Try as seconds
  const asMs = val * 1000
  if (asMs > START_TIME && asMs < END_TIME) {
    return new Date(asMs)
  }
  // Try as microseconds
  const fromMicro = val / 1000
  if (fromMicro > START_TIME && fromMicro < END_TIME) {
    return new Date(fromMicro)
  }
  return null
}

/**
 * Try to parse a string as a date using registered patterns
 */
export function tryDateFromString(val: string): Date | null {
  if (!val || typeof val !== 'string') return null
  
  const trimmed = val.trim()
  if (!trimmed) return null

  for (const pattern of DATE_PATTERNS) {
    const match = trimmed.match(pattern.regex)
    if (match) {
      if (pattern.parse) {
        const d = pattern.parse(match)
        if (d) return d
      } else {
        // Default: use Date constructor
        const d = new Date(trimmed)
        if (isValidDate(d)) return d
      }
    }
  }
  
  return null
}

/**
 * Try to parse any value (number or string) as a date
 */
export function tryParseDate(val: unknown): Date | null {
  if (val === null || val === undefined) return null
  
  // Try as number first
  if (typeof val === 'number') {
    return tryDateFromNumber(val)
  }
  
  // Try as string
  if (typeof val === 'string') {
    // First try as a numeric string
    const num = Number(val)
    if (!isNaN(num)) {
      const fromNum = tryDateFromNumber(num)
      if (fromNum) return fromNum
    }
    // Then try date patterns
    return tryDateFromString(val)
  }
  
  return null
}

/**
 * Check if a value looks like a date/timestamp
 */
export function looksLikeDate(val: unknown): boolean {
  return tryParseDate(val) !== null
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
 * Handles milliseconds, seconds, microseconds, and date strings
 */
export function getTimestampHint(val: unknown): string | null {
  const d = tryParseDate(val)
  return d ? formatDate(d) : null
}
