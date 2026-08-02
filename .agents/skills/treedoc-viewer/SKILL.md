---
name: treedoc-viewer
description: Open local JSON, JSONEX, CSV, TSV, YAML, XML, log, text, or Prometheus files in the installed TreeDoc Viewer PWA with URL-compatible viewer, table, preset, path, title, and chart configuration. Use when an agent needs to inspect a local structured-data file in TreeDoc, launch a configured table or chart, verify or install the TreeDoc PWA on macOS, or translate a requested visualization such as group-by/value/time columns into TreeDoc's option parameter.
---

# TreeDoc Viewer

Open a local file directly in the standalone TreeDoc Viewer and apply the same
configuration accepted by the web app. Do not use an iframe or browser file
picker for this workflow.

## Resolve inputs

1. Resolve the requested file to an absolute path and verify it is a regular
   file. Do not upload, copy, or embed its contents in a URL.
2. Resolve the repository root from this skill directory (`../../..`). The
   launcher is `v2/bin/treedoc-open.mjs` under that root.
3. Require macOS and Node.js. The launcher intentionally uses macOS Launch
   Services to address the installed PWA.
4. Translate the requested view into TreeDoc's existing URL parameters:
   `option`, `preset`, `initialPath`, and `title`. Preserve JSONEx syntax and
   pass each value directly; never Base64-encode it. Normal URL percent-encoding
   performed by the launcher is expected.

For a maximized chart grouped by `service`, use an option shaped like:

```text
{maxPane:table,globalRule:{chartState:{showStatus:maximized,timeColumn:timestamp,valueColumns:[amount],groupColumns:[service],valueAgg:sum}}}
```

Only include fields the user requested. Do not invent column names. If the
needed columns cannot be determined safely from the request or a small,
read-only inspection of the file header/schema, ask for them.

## Ensure the PWA is installed

Use the `computer-use` skill to inspect installed applications. Treat either of
these as an installed TreeDoc PWA:

- Display name `TreeDoc Viewer`.
- Bundle identifier beginning with `com.google.Chrome.app.` and display name
  `TreeDoc Viewer`.

If it is installed, do not reinstall it.

If it is missing:

1. Use the Chrome-control skill to open `https://www.treedoc.org/` in Chrome.
2. Use Computer Use for Chrome's toolbar UI when page automation cannot reach
   the PWA install command.
3. Open Chrome's **Cast, Save, and Share** submenu and choose **Install TreeDoc
   Viewer**. If Chrome instead shows **Open in TreeDoc Viewer**, the PWA is
   already installed; open it and continue.
4. Installing software requires action-time confirmation even when the original
   request asked for automatic setup. Prepare the install dialog, state that
   TreeDoc Viewer from `www.treedoc.org` will be installed, ask for confirmation,
   and pause. Resume from the dialog after confirmation.
5. Verify `TreeDoc Viewer` appears in the installed-application list and can be
   opened as a standalone window.

Do not bypass Chrome or macOS security dialogs. Do not substitute a generated
native wrapper for the actual PWA.

## Launch the configured file

Prefer invoking the checked-in launcher directly; do not require a global
`npm link`:

```bash
node <repo-root>/v2/bin/treedoc-open.mjs \
  <absolute-file-path> \
  --option '<jsonex-option>' \
  --preset '<jsonex-preset>' \
  --initialPath '<path>' \
  --title '<title>'
```

Omit unused parameters. Always pass each value as one shell argument and quote
it safely. The launcher sends the local file and a temporary configuration
sidecar in one PWA launch. Each invocation opens a new PWA window, so existing
files remain open and the configuration applies only to the file opened by that
invocation. The launcher removes the sidecar automatically.

Before the live launch, use `--dry-run` when the generated configuration is
complex or derived from natural language. Confirm that:

- `localFile` is the intended absolute local file.
- `configUrl` is `https://www.treedoc.org/` with only the requested `option`,
  `preset`, `initialPath`, and `title` parameters.
- There is one file-launch batch containing the local file and a temporary
  `.treedoc-launch-config.json` sidecar.
- The URL contains no file contents, credentials, or unrelated data.

Then rerun without `--dry-run`.

## Verify the result

Use Computer Use to inspect the `TreeDoc Viewer` application after launch.
Verify all observable requested outcomes:

- A standalone TreeDoc Viewer window is running.
- The document parsed without an error indication.
- The requested title, initial path, pane, table, or chart is visible.
- Requested group, time, value, aggregation, or preset settings are reflected
  in the chart/table controls when those controls expose the state.

If the file opens but configuration launches in an ordinary Chrome tab, the
installed production PWA likely lacks the repository's `launch_handler` update
or Chrome link capture is disabled. Report that concrete condition; do not claim
the configured launch succeeded. Reinstall only if inspection shows the app is
stale and installation has been reconfirmed.
