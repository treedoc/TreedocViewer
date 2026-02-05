import type { ParserPlugin, ParseResult, ParserSyntax } from '../models/types'
import { ParseStatus } from '../models/types'
import type { TDNode } from 'treedoc'
import { TDObjectCoder, TDJSONWriter, TDJSONWriterOption } from 'treedoc'

export interface XMLParserOption {
  compact?: boolean
  mimeType?: DOMParserSupportedType
}

export default class XMLParserPlugin implements ParserPlugin<XMLParserOption> {
  syntax: ParserSyntax = 'xml'
  option: XMLParserOption = {}

  constructor(
    public name = 'XML',
    public mimeType: DOMParserSupportedType = 'text/xml',
    public compact = false
  ) {
    this.option = { compact, mimeType }
  }

  looksLike(str: string): boolean {
    const trimmed = str.trim()
    return trimmed.startsWith('<?xml') || 
           (trimmed.startsWith('<') && trimmed.endsWith('>') && !trimmed.startsWith('<!DOCTYPE html'))
  }

  parse(str: string): ParseResult {
    const result: ParseResult = {
      status: ParseStatus.SUCCESS,
      message: '',
    }
    
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(str, this.mimeType)
      
      // Check for parsing errors
      const parseError = doc.querySelector('parsererror')
      if (parseError) {
        result.message = `Error: ${parseError.textContent}`
        result.status = ParseStatus.ERROR
        return result
      }
      
      const obj = this.compact 
        ? this.xmlToCompactJson(doc.documentElement)
        : this.xmlToJson(doc.documentElement)
      
      result.result = TDObjectCoder.get().encode(obj)
      result.message = 'DOMParser.parseFromString()'
      return result
    } catch (e) {
      result.message = `Error: ${(e as Error).message}`
      result.status = ParseStatus.ERROR
      console.error(e)
      return result
    }
  }

  private xmlToJson(node: Element): Record<string, unknown> {
    const obj: Record<string, unknown> = {}
    
    // Add attributes
    if (node.attributes.length > 0) {
      const attrs: Record<string, string> = {}
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i]
        attrs[`@${attr.name}`] = attr.value
      }
      Object.assign(obj, attrs)
    }
    
    // Add child elements
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i]
      
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim()
        if (text) {
          if (Object.keys(obj).length === 0) {
            return text as unknown as Record<string, unknown>
          }
          obj['#text'] = text
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const childObj = this.xmlToJson(child as Element)
        const tagName = (child as Element).tagName
        
        if (obj[tagName]) {
          // Convert to array if multiple children with same name
          if (!Array.isArray(obj[tagName])) {
            obj[tagName] = [obj[tagName]]
          }
          (obj[tagName] as unknown[]).push(childObj)
        } else {
          obj[tagName] = childObj
        }
      }
    }
    
    return obj
  }

  private xmlToCompactJson(node: Element): Record<string, unknown> {
    // Compact representation: {tagName: {attrs..., children...}}
    const result: Record<string, unknown> = {}
    result[node.tagName] = this.xmlToJson(node)
    return result
  }

  stringify(obj: TDNode): string {
    return TDJSONWriter.get().writeAsString(obj, new TDJSONWriterOption().setIndentFactor(2))
  }
}
