import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('HCL parses in the browser and original source downloads as HCL', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const source = 'resource "server" "web" {\n  name = "hcl-browser-check"\n  ports = [80, 443]\n}\n'
  await page.locator('.cm-content').fill(source)
  await expect(page.locator('.parser-select')).toContainText('HCL')
  await expect(page.locator('.tree-view')).toContainText('resource')
  const downloadPromise = page.waitForEvent('download')
  await page.locator('.source-controls button').filter({ has: page.locator('.pi-save') }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('treedoc-data.hcl')
  expect(await readFile((await download.path())!, 'utf8')).toBe(source)
  expect(errors).toEqual([])
})
