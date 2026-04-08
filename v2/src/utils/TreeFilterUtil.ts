import type { TDNode } from 'treedoc'
import { TDNodeType } from 'treedoc'

export interface FilterOptions {
  caseSensitive: boolean
  wholeWord: boolean
  isRegex: boolean
}

export const defaultFilterOptions: FilterOptions = {
  caseSensitive: false,
  wholeWord: false,
  isRegex: false,
}

/**
 * Build a RegExp from the query string based on filter options.
 * Returns null if the query is empty or the regex is invalid.
 */
export function buildFilterRegex(query: string, options: FilterOptions): RegExp | null {
  if (!query) return null

  try {
    let pattern: string
    if (options.isRegex) {
      pattern = query
    } else {
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    if (options.wholeWord) {
      pattern = `\\b${pattern}\\b`
    }

    const flags = options.caseSensitive ? 'g' : 'gi'
    return new RegExp(pattern, flags)
  } catch {
    return null
  }
}

export function textMatchesQuery(text: string, query: string, options: FilterOptions): boolean {
  if (!query || !text) return false
  const regex = buildFilterRegex(query, options)
  if (!regex) return false
  return regex.test(text)
}

/**
 * Check if this node's own key or value matches the filter (not children).
 */
export function nodeDirectlyMatches(node: TDNode, query: string, options: FilterOptions): boolean {
  if (!query) return false

  if (node.key && textMatchesQuery(node.key, query, options)) {
    return true
  }

  if (node.type === TDNodeType.SIMPLE && node.value !== null) {
    if (textMatchesQuery(String(node.value), query, options)) {
      return true
    }
  }

  return false
}

/**
 * Check if this node or any descendant matches the filter.
 */
export function nodeOrDescendantMatches(node: TDNode, query: string, options: FilterOptions): boolean {
  if (!query) return true
  if (nodeDirectlyMatches(node, query, options)) return true

  if (node.children) {
    for (const child of node.children) {
      if (nodeOrDescendantMatches(child, query, options)) return true
    }
  }

  return false
}

/**
 * Collect all nodes that directly match for prev/next navigation.
 */
export function collectMatches(node: TDNode, query: string, options: FilterOptions, results: TDNode[]): void {
  if (!query) return

  if (nodeDirectlyMatches(node, query, options)) {
    results.push(node)
  }

  if (node.children) {
    for (const child of node.children) {
      collectMatches(child, query, options, results)
    }
  }
}

export function escapeHtml(text: string): string {
  if (!text) return text
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Highlight all matches in text by wrapping them in <mark> tags.
 * Returns HTML-escaped text with highlights.
 */
export function highlightText(text: string, query: string, options: FilterOptions): string {
  if (!query || !text) return escapeHtml(text)

  const regex = buildFilterRegex(query, options)
  if (!regex) return escapeHtml(text)

  regex.lastIndex = 0
  const parts: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex++
      continue
    }
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.substring(lastIndex, match.index)))
    }
    parts.push('<mark class="highlight">' + escapeHtml(match[0]) + '</mark>')
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.substring(lastIndex)))
  }

  return parts.length > 0 ? parts.join('') : escapeHtml(text)
}
