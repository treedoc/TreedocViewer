#!/usr/bin/env node

import { existsSync, mkdtempSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

const CONFIG_SIDECAR_NAME = '.treedoc-launch-config.json'
const CONFIG_SIDECAR_TTL_MS = 30_000

const HELP = `Usage: treedoc-open <file> [options]

Open a local file in the installed TreeDoc Viewer PWA and apply the same
configuration parameters accepted by the web app.

Options:
  --option <jsonex>         Viewer options, matching the web app's option parameter
  --preset <jsonex>         Table/chart preset, matching the preset parameter
  --initialPath <path>      Initial node path, matching the initialPath parameter
  --title <title>           Viewer title, matching the title parameter
  --app <name>              Installed macOS PWA name (default: TreeDoc Viewer)
  --url <url>               TreeDoc base URL (default: https://www.treedoc.org/)
  --dry-run                 Print the launches without opening the app
  -h, --help                Show this help

Example:
  treedoc-open report.csv \\
    --option '{maxPane:table,globalRule:{chartState:{showStatus:maximized,groupColumns:[category]}}}'
`

function fail(message) {
  console.error(`treedoc-open: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = {
    app: 'TreeDoc Viewer',
    baseUrl: 'https://www.treedoc.org/',
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const nextValue = () => {
      const value = argv[++index]
      if (!value) fail(`${arg} requires a value`)
      return value
    }

    switch (arg) {
      case '-h':
      case '--help':
        console.log(HELP)
        process.exit(0)
        break
      case '--option':
        args.option = nextValue()
        break
      case '--preset':
        args.preset = nextValue()
        break
      case '--initialPath':
      case '--initial-path':
        args.initialPath = nextValue()
        break
      case '--title':
        args.title = nextValue()
        break
      case '--app':
        args.app = nextValue()
        break
      case '--url':
        args.baseUrl = nextValue()
        break
      case '--dry-run':
        args.dryRun = true
        break
      default:
        if (arg.startsWith('-')) fail(`unknown option: ${arg}`)
        if (args.file) fail(`unexpected argument: ${arg}`)
        args.file = arg
    }
  }

  if (!args.file) fail('a local file is required')
  return args
}

export function buildConfigUrl(baseUrl, args) {
  let url
  try {
    url = new URL(baseUrl)
  } catch {
    fail(`invalid TreeDoc URL: ${baseUrl}`)
  }

  for (const name of ['option', 'preset', 'initialPath', 'title']) {
    if (args[name] !== undefined) url.searchParams.set(name, args[name])
  }
  return url.toString()
}

function createConfigSidecar(configUrl) {
  const directory = mkdtempSync(join(tmpdir(), 'treedoc-open-'))
  const sidecar = join(directory, CONFIG_SIDECAR_NAME)
  writeFileSync(sidecar, configUrl, { encoding: 'utf8', mode: 0o600 })
  return { directory, sidecar }
}

function scheduleSidecarCleanup(directory) {
  const cleanupScript = `setTimeout(() => require('node:fs').rmSync(process.argv[1], { recursive: true, force: true }), ${CONFIG_SIDECAR_TTL_MS})`
  const cleanup = spawn(process.execPath, ['-e', cleanupScript, directory], {
    detached: true,
    stdio: 'ignore',
  })
  cleanup.unref()
}

function openWithApp(app, targets) {
  const result = spawnSync('/usr/bin/open', ['-a', app, ...targets], { stdio: 'inherit' })
  if (result.error) fail(`failed to launch ${app}: ${result.error.message}`)
  if (result.status !== 0) fail(`${app} exited with status ${result.status}`)
}

async function main(argv) {
  const args = parseArgs(argv)
  if (process.platform !== 'darwin' && !args.dryRun) {
    fail('automatic PWA launching is currently supported on macOS only')
  }

  const inputFile = resolve(args.file)
  if (!existsSync(inputFile) || !statSync(inputFile).isFile()) {
    fail(`file does not exist: ${inputFile}`)
  }

  if (args.dryRun) {
    const configUrl = buildConfigUrl(args.baseUrl, args)
    console.log(JSON.stringify({
      app: args.app,
      localFile: inputFile,
      configUrl,
      launches: [{ files: [inputFile, `<temporary>/${CONFIG_SIDECAR_NAME}`] }],
    }, null, 2))
  } else {
    // Opening the data and config sidecar in one batch produces one LaunchParams
    // delivery. navigate-new therefore creates one configured window per call.
    try {
      const { directory, sidecar } = createConfigSidecar(buildConfigUrl(args.baseUrl, args))
      openWithApp(args.app, [inputFile, sidecar])
      scheduleSidecarCleanup(directory)
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error))
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2))
}
