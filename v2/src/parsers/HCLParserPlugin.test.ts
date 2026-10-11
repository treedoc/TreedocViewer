import { describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import HCLParserPlugin from './HCLParserPlugin'
import { ParseStatus } from '../models/types'
import { useTreeStore } from '../stores/treeStore'
import { hclStr, jsonStr, yamlStr, xmlStr, csvStr, prometheusStr } from '../data/sampleData'

const parser = new HCLParserPlugin()
function parse(text: string) {
  const result = parser.parse(text)
  expect(result.status).toBe(ParseStatus.SUCCESS)
  return JSON.parse(parser.stringify(result.result!))
}

describe('HCL parser', () => {
  test('parses attributes, collections, comments, and primitive values', () => {
    expect(parse(`# comment
// another comment
/* block comment */
name = "demo"
count = -2.5
enabled = true
missing = null
ports = [80, 443]
tags = { Name = "web", "env" : "test" }
`)).toEqual({ name: 'demo', count: -2.5, enabled: true, missing: null, ports: [80, 443], tags: { Name: 'web', env: 'test' } })
  })

  test('preserves labeled, repeated, and nested blocks', () => {
    expect(parse(`resource "server" "web" {
  network { port = 80 }
  network { port = 443 }
}
resource "server" "worker" {}
locals { enabled = true }
`)).toEqual({
      resource: { server: { web: [{ network: [{ port: 80 }, { port: 443 }] }], worker: [{}] } },
      locals: [{ enabled: true }],
    })
  })

  test('preserves expressions and parses templates and heredocs', () => {
    expect(parse('reference = var.region\ncomputed = upper(var.name)\nname = "web-${var.env}"\nscript = <<EOF\nhello\nEOF\n')).toEqual({
      reference: '${var.region}', computed: '${upper(var.name)}', name: 'web-${var.env}', script: 'hello\n',
    })
    expect(parse('values = [for x in var.items : x.name]\n')).toEqual({ values: '${[for x in var.items : x.name]}' })
  })

  test.each(['a = [', 'resource "x" {', 'a = 1\na = 2', 'a = "unterminated'])('rejects malformed HCL: %s', text => {
    const result = parser.parse(text)
    expect(result.status).toBe(ParseStatus.ERROR)
    expect(result.result).toBeUndefined()
    expect(result.message).toContain('Invalid HCL')
  })

  test('accepts empty documents', () => {
    expect(parse('')).toEqual({})
    expect(parse('# only a comment')).toEqual({})
  })

  test.each([hclStr, '# comment\nlocals {}', '/* comment */\nregion = "us-west-2"', '// comment\nresource "x" "y" {}', 'resource x y {}'])('detects HCL declarations', text => {
    expect(parser.looksLike(text)).toBe(true)
  })

  test.each([jsonStr, yamlStr, xmlStr, csvStr, prometheusStr, '{K1=v1}', 'TestBean(key=value)', '', '# comment'])('does not claim other formats', text => {
    expect(parser.looksLike(text)).toBe(false)
  })

  test('store detects HCL before permissive JSON, map, and CSV parsers', () => {
    setActivePinia(createPinia())
    const store = useTreeStore()
    for (const text of [hclStr, 'locals {}', 'ports = [80, 443]', 'tags = { Name = "web" }']) {
      store.setTextImmediate(text)
      expect(store.selectedParser.name).toBe('HCL')
      expect(store.parseStatus).toBe(ParseStatus.SUCCESS)
      expect(store.tree).toBeTruthy()
    }
    store.setTextImmediate('{"name":"json"}')
    expect(store.selectedParser.name).toBe('JSON/JSONEX')
    store.setTextImmediate('a = [')
    expect(store.parseStatus).toBe(ParseStatus.ERROR)
    expect(store.tree).toBeNull()
  })
})
