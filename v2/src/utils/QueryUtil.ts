/**
 * Query and filter utilities
 */

import type { FieldQuery } from '../components/ColumnFilterDialog.vue'

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
    return new RegExp(regexStr, 'i')
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
 * Parse extended fields expression into individual field definitions
 * e.g., "fullName: $.first + ' ' + $.last, tags_: $.metadata.tags" 
 * -> [{ name: 'fullName', expr: "$.first + ' ' + $.last" }, { name: 'tags_', expr: '$.metadata.tags' }]
 */
function parseExtendedFields(expression: string): { name: string; expr: string }[] {
  if (!expression || !expression.trim()) return []
  
  const fields: { name: string; expr: string }[] = []
  let current = ''
  let depth = 0  // Track parentheses/brackets depth
  let inString = false
  let stringChar = ''
  
  for (let i = 0; i < expression.length; i++) {
    const char = expression[i]
    const prevChar = i > 0 ? expression[i - 1] : ''
    
    // Handle string boundaries
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
      }
    }
    
    // Track depth for nested structures
    if (!inString) {
      if (char === '(' || char === '[' || char === '{') depth++
      if (char === ')' || char === ']' || char === '}') depth--
    }
    
    // Split on comma only at top level
    if (char === ',' && depth === 0 && !inString) {
      if (current.trim()) {
        const parsed = parseFieldDefinition(current.trim())
        if (parsed) fields.push(parsed)
      }
      current = ''
    } else {
      current += char
    }
  }
  
  // Don't forget the last field
  if (current.trim()) {
    const parsed = parseFieldDefinition(current.trim())
    if (parsed) fields.push(parsed)
  }
  
  return fields
}

function parseFieldDefinition(def: string): { name: string; expr: string } | null {
  // Find the first colon that's not inside a string or ternary
  let colonIdx = -1
  let inString = false
  let stringChar = ''
  
  for (let i = 0; i < def.length; i++) {
    const char = def[i]
    const prevChar = i > 0 ? def[i - 1] : ''
    
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
      }
    }
    
    if (char === ':' && !inString) {
      colonIdx = i
      break
    }
  }
  
  if (colonIdx === -1) return null
  
  const name = def.slice(0, colonIdx).trim()
  const expr = def.slice(colonIdx + 1).trim()
  
  if (!name || !expr) return null
  return { name, expr }
}

export function createExtendedFieldsFunc(expression: string): ((obj: any) => Record<string, any>) | null {
  const fields = parseExtendedFields(expression)
  if (fields.length === 0) return null
  
  // Create individual functions for each field
  const fieldFuncs: { name: string; func: (obj: any) => any }[] = []
  
  for (const field of fields) {
    try {
      const exp = `
        with($) {
          return ${field.expr}
        }
      `
      const func = new Function('$', exp) as (obj: any) => any
      fieldFuncs.push({ name: field.name, func })
    } catch (e) {
      console.warn(`Error parsing extended field "${field.name}":`, field.expr, e)
      // Skip this field but continue with others
    }
  }
  
  if (fieldFuncs.length === 0) return null
  
  // Return a function that evaluates each field independently
  return (obj: any) => {
    const result: Record<string, any> = {}
    for (const { name, func } of fieldFuncs) {
      try {
        result[name] = func(obj)
      } catch (e) {
        // Silently ignore runtime errors for individual fields
        // The field simply won't be added to the result
      }
    }
    return result
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
