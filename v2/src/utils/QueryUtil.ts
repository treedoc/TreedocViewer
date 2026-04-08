/**
 * Query and filter utilities
 */

import type { FieldQuery } from '@/models/types'
import { TDJSONParser, TDJSONWriter, TDJSONWriterOption, TDObjectCoder, TDNodeType } from 'treedoc'

/**
 * Serialize an array of patterns to a compact string.
 * Uses TDJSONWriter for compact output - values are only quoted when necessary.
 * Single patterns without special characters are stored as-is for readability.
 */
export function serializePatterns(patterns: string[]): string {
  if (patterns.length === 0) return ''

  // For a single pattern without special chars, just return it directly
  if (patterns.length === 1 && !needsQuoting(patterns[0])) {
    return patterns[0]
  }

  // Use TDJSONWriter with optional quotes for compact output
  // setQuoteChars enables smart quoting - only quote when value contains special chars
  const opt = new TDJSONWriterOption()
    .setAlwaysQuoteKey(false)
    .setAlwaysQuoteValue(false)
    .setIndentFactor(1)
    .setQuoteChars("\"\'")
  const node = TDObjectCoder.get().encode(patterns)
  return TDJSONWriter.get().writeAsString(node, opt)
}

/**
 * Check if a pattern string needs to be quoted (contains newlines, commas, brackets, etc.)
 */
function needsQuoting(pattern: string): boolean {
  return /[\n\r,\[\]"'\\]/.test(pattern)
}

/**
 * Parse a pattern expression string to an array of patterns.
 * Supports both:
 * - New format: JSON-like array (e.g., [pattern1, "pattern with\nnewline"])
 * - Legacy format: newline-separated patterns
 */
export function parsePatterns(patternExpr: string): string[] {
  if (!patternExpr) return []

  const trimmed = patternExpr.trim()

  // Check if it looks like a JSON array
  if (trimmed.startsWith('[')) {
    try {
      const node = TDJSONParser.get().parse(trimmed)
      if (node.type === TDNodeType.ARRAY) {
        const result = node.toObject() as any
        if (Array.isArray(result)) {
          return result.filter(p => typeof p === 'string' && p.trim())
        }
      }
    } catch (e) {
      // Fall through to legacy parsing
    }
  }

  // Legacy format: newline-separated
  return trimmed.split('\n').map(p => p.trim()).filter(p => p)
}

/**
 * Convert a pattern string to a regex with named capture groups
 * Supported syntax:
 * - ${name}: captures until next literal text (greedy for last, non-greedy otherwise)
 * - $name: same as ${name}, just shorter syntax
 * - asterisk (*): matches any characters (like glob wildcard)
 */
export function patternToRegex(pattern: string): RegExp | null {
  if (!pattern) return null

  try {
    // Track placeholder names
    const placeholders: string[] = []

    // First, temporarily replace ${...} placeholders with a unique marker
    let tempPattern = pattern.replace(/\$\{(\w+)\}/g, (match, name) => {
      placeholders.push(name)
      return `\x00PLACEHOLDER_${placeholders.length - 1}\x00`
    })

    // Then, replace $name placeholders (not followed by { which would be ${)
    // $name is terminated by non-word character or end of string
    tempPattern = tempPattern.replace(/\$(\w+)/g, (match, name) => {
      placeholders.push(name)
      return `\x00PLACEHOLDER_${placeholders.length - 1}\x00`
    })

    // Replace * wildcard with a unique marker before escaping
    const WILDCARD_MARKER = '\x00WILDCARD\x00'
    tempPattern = tempPattern.replace(/\*/g, WILDCARD_MARKER)

    // Normalize escape sequences so pattern matches JSON-parsed values
    // e.g. user types \n -> match actual newline (from JSON "\n")
    // Handle \\ first so literal backslash is preserved
    const BACKSLASH_PLACEHOLDER = '\u0001\u0002\u0003'  // unlikely to appear in patterns
    tempPattern = tempPattern.replace(/\\\\/g, BACKSLASH_PLACEHOLDER)
    tempPattern = tempPattern.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')

    // Now escape all regex special characters
    tempPattern = tempPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    tempPattern = tempPattern.replace(/\u0001\u0002\u0003/g, '\\\\')

    // Restore wildcard markers as .*
    tempPattern = tempPattern.replace(/\x00WILDCARD\x00/g, '.*')

    // Restore placeholders as named capture groups
    const endsWithPlaceholder = /(\$\{\w+\}|\$\w+)$/.test(pattern)
    let placeholderIndex = 0
    let regexStr = tempPattern.replace(/\x00PLACEHOLDER_(\d+)\x00/g, (match, idx) => {
      const name = placeholders[parseInt(idx)]
      const isLast = placeholderIndex === placeholders.length - 1
      placeholderIndex++

      // Use greedy .+ for last placeholder if pattern ends with placeholder, non-greedy .+? otherwise
      return isLast && endsWithPlaceholder ? `(?<${name}>.+)` : `(?<${name}>.+?)`
    })

    // Make it match the entire string or as a substring
    // Use 's' flag (dotAll) so . matches newlines, allowing patterns to span multiple lines
    return new RegExp(regexStr, 'is')
  } catch (e) {
    console.error('Error creating pattern regex:', e)
    return null
  }
}

/**
 * Match a value against a pattern and return extracted groups
 */
// Set to true in browser console: window.DEBUG_PATTERN = true
declare global {
  interface Window {
    DEBUG_PATTERN?: boolean
  }
}

export function matchPattern(value: string, pattern: string): Record<string, string> | null {
  const regex = patternToRegex(pattern)
  if (!regex) return null

  const match = value.match(regex)

  // Debug mode - enable in browser console: window.DEBUG_PATTERN = true
  if (typeof window !== 'undefined' && window.DEBUG_PATTERN && !match) {
    console.group('matchPattern debug')
    console.log('Pattern:', pattern)
    console.log('Regex:', regex)
    console.log('Value length:', value.length)
    console.log('Value:', JSON.stringify(value.slice(0, 300)))
    console.groupEnd()
  }

  if (!match) return null

  // Return groups if present, otherwise empty object (pattern matched but had no placeholders)
  return match.groups ?? {}
}

/**
 * Match a value against a field query
 */
export function matchFieldQuery(value: string, fq: FieldQuery): boolean {
  if (!fq.query) return true

  // Empty or whitespace-only values should not match positive filters (looking FOR something)
  // but should match negative filters (filtering OUT something - empty doesn't contain the excluded value)
  if (!value || !value.trim()) {
    return !!fq.isNegate
  }

  // Handle pattern matching mode
  if (fq.isPattern) {
    const groups = matchPattern(value, fq.query)
    return groups !== null
  }

  let queries: string[]
  if (fq.isArray) {
    // Parse as comma-separated array
    queries = fq.query.split(',').map(q => q.trim()).filter(q => q)
  } else {
    queries = [fq.query]
  }

  let matched = false
  for (const q of queries) {
    if (fq.isRegex) {
      try {
        const regex = new RegExp(q, 'i')
        if (regex.test(value)) {
          matched = true
          break
        }
      } catch {
        // Invalid regex, fall back to string match
        if (value.toLowerCase().includes(q.toLowerCase())) {
          matched = true
          break
        }
      }
    } else {
      if (value.toLowerCase().includes(q.toLowerCase())) {
        matched = true
        break
      }
    }
  }

  return fq.isNegate ? !matched : matched
}

/**
 * Create an evaluator function for extended fields expression
 */
/**
 * Create an evaluator function for extended fields expression
 * Treats the expression as a valid JS object literal expression
 */
export function createExtendedFieldsFunc(expression: string): ((obj: any) => Record<string, any>) | null {
  if (!expression || !expression.trim()) return null

  try {
    // Wrap the expression in {} to treat it as an object literal
    const exp = `
      with($) {
        return { ${expression} }
      }
    `
    const func = new Function('$', exp) as (obj: any) => any

    return (obj: any) => {
      try {
        const evaluated = func(obj)
        if (!evaluated || typeof evaluated !== 'object') return {}

        const result: Record<string, any> = {}
        for (const [key, value] of Object.entries(evaluated)) {
          // Support spread if the key ends with "_"
          if (key.endsWith('_') && typeof value === 'object' && value !== null) {
            Object.assign(result, value)
          } else {
            result[key] = value
          }
        }
        return result
      } catch (e) {
        console.warn('Error evaluating extended fields:', e)
        return {}
      }
    }
  } catch (e) {
    console.warn('Error creating extended fields function:', e, expression)
    return null
  }
}

/**
 * Create a JS query filter function
 */
export function createJsQueryFunc(query: string): ((obj: any) => boolean) | null {
  if (!query || query === '$') return null

  try {
    return new Function('$', `return ${query}`) as (obj: any) => boolean
  } catch (e) {
    console.warn('Invalid JS query:', e)
    return null
  }
}
