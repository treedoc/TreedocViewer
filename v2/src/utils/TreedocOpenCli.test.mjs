import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('treedoc-open', () => {
  it('combines the local file and URL-style config into one PWA launch', () => {
    const cli = resolve(process.cwd(), 'bin/treedoc-open.mjs')
    const input = resolve(process.cwd(), 'package.json')
    const output = execFileSync(process.execPath, [
      cli,
      input,
      '--option',
      '{maxPane:table}',
      '--title',
      'Package',
      '--dry-run',
    ], { encoding: 'utf8' })

    const result = JSON.parse(output)
    expect(result.localFile).toBe(input)
    expect(result.launches).toEqual([{
      files: [input, '<temporary>/.treedoc-launch-config.json'],
    }])

    const configUrl = new URL(result.configUrl)
    expect(configUrl.searchParams.get('dataUrl')).toBeNull()
    expect(configUrl.searchParams.get('option')).toBe('{maxPane:table}')
    expect(configUrl.searchParams.get('title')).toBe('Package')
  })
})
