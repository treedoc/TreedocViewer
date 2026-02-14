/**
 * Query and filter utilities
 */

import type { FieldQuery } from '../components/ColumnFilterDialog.vue'

/**
 * Convert a pattern string with ${placeholder} syntax to a regex with named capture groups
 * e.g., "Order:${orderId}" -> /Order:(?<orderId>.+?)/
 */
export function patternToRegex(pattern: string): RegExp | null {
  if (!pattern) return null
  
  try {
    // Escape regex special characters except for ${...} placeholders
    let regexStr = pattern.replace(/[.*+?^${}()|[\]\\]/g, (match) => {
      // Don't escape $ when it's part of ${...}
      if (match === '$') return match
      if (match === '{' || match === '}') return match
      return '\\' + match
    })
    
    // Replace ${name} with named capture group (?<name>.+?)
    regexStr = regexStr.replace(/\$\{(\w+)\}/g, '(?<$1>.+?)')
    
    // Make it match the entire string or as a substring
    return new RegExp(regexStr, 'i')
  } catch (e) {
    console.error('Error creating pattern regex:', e)
    return null
  }
}

/**
 * Match a value against a pattern and return extracted groups
 */
export function matchPattern(value: string, pattern: string): Record<string, string> | null {
  const regex = patternToRegex(pattern)
  if (!regex) return null
  
  const match = value.match(regex)
  if (!match || !match.groups) return null
  
  return match.groups
}

/**
 * Match a value against a field query
 */
export function matchFieldQuery(value: string, fq: FieldQuery): boolean {
  if (!fq.query) return true
  
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
export function createExtendedFieldsFunc(expression: string): ((obj: any) => Record<string, any>) | null {
  if (!expression || !expression.trim()) return null
  
  const exp = `
    with($) {
      return {${expression}}
    }
  `
  try {
    return new Function('$', exp) as (obj: any) => Record<string, any>
  } catch (e) {
    console.error('Error parsing extended fields:', exp)
    console.error(e)
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
