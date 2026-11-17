# TreeDoc Viewer v2

A modern, feature-rich viewer for hierarchical data formats (JSON, YAML, XML, CSV) built with Vue 3, PrimeVue, and TypeScript.

![TreeDoc Viewer Screenshot](screenshot.png)

## Features

### Three Synchronized Views
- **Source View**: Syntax-highlighted editor with CodeMirror 6
- **Tree View**: Collapsible tree structure with expand/collapse controls  
- **Table View**: Full-featured data table with filtering, sorting, and pagination

### Flexible Navigation
- Breadcrumb navigation to parent nodes
- Back/forward history navigation
- Support for `$ref` navigation (OpenAPI, Google Discovery API style)
- Synchronized selection across all views

### Multiple Format Support
- JSON / JSON5 / JSONEX
- YAML (including multi-document)
- XML / HTML
- CSV / TSV / SSV (space-separated)
- Java `Map.toString()` format
- Lombok `toString()` format

### Modern UI/UX
- Beautiful dark theme with glass-morphism effects
- Responsive split panes (resizable)
- Keyboard shortcuts for power users
- Full-screen mode for each pane

## Tech Stack

- **Vue 3** - Composition API with TypeScript
- **PrimeVue 4** - Modern UI components
- **Pinia** - State management
- **CodeMirror 6** - Source code editor
- **Splitpanes** - Resizable split panes
- **Vite** - Fast build tooling
- **treedoc** - Tree document parsing library

## Getting Started

### Installation

```bash
cd v2
npm install
```

### Development

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Usage

### As a Standalone App

Simply open the application in your browser after running the dev server. You can:
- Open local files
- Load data from URLs
- Paste content directly
- Select from sample data

### Open a local file with chart configuration (macOS)

The installed PWA can receive a local file and viewer configuration without a
browser file picker. Link the bundled CLI once from the `v2` directory:

```bash
npm link
```

Then open a file using the same `option`, `preset`, `initialPath`, and `title`
parameters accepted by the web app:

```bash
treedoc-open ./report.csv \
  --option '{maxPane:table,globalRule:{chartState:{showStatus:maximized,timeColumn:timestamp,valueColumns:[amount],groupColumns:[category],valueAgg:sum}}}' \
  --initialPath /
```

The option and preset values use TreeDoc's existing JSONEx syntax and are placed
directly in the launch URL (normal URL percent-encoding is applied; no Base64
wrapper is used). Run with `--dry-run` to inspect the file and configuration URL
that would be sent to the installed `TreeDoc Viewer` app.

The CLI invokes the PWA once with the local file and a temporary configuration
sidecar containing that URL. The sidecar is deleted automatically after 30
seconds. Each invocation opens a new PWA window, so multiple files can remain
open and the configuration is scoped to the file opened by that invocation.

### URL Parameters

The application supports URL parameters for embedding and configuration:

| Parameter | Description |
|-----------|-------------|
| `data` | JSON string to display |
| `dataUrl` | URL to fetch data from |
| `initialPath` | Initial node path to navigate to |
| `title` | Custom title for the app. Prefer `option.title` for new links. |
| `option` | JSONEx encoded viewer options, such as `{title:My Data,maxPane:table}` |
| `preset` | JSONEx encoded table preset |
| `embeddedId` | Enable embedded mode for iframe communication |

Example:
```
http://localhost:5173/?data={"name":"test"}&initialPath=/name&title=My Data
```

Time-series table and maximized chart example:
```
https://www.treedoc.org/?data=[{ts:"2026-06-01T00:00:00Z",service:api,count:8},{ts:"2026-06-01T00:00:00Z",service:web,count:5},{ts:"2026-06-01T01:00:00Z",service:api,count:12},{ts:"2026-06-01T01:00:00Z",service:web,count:7}]&initialPath=/&option={title:"Time Series Demo",maxPane:table,globalRule:{chartState:{showStatus:maximized,timeColumn:ts,valueColumns:[count],groupColumns:[service],showCount:true,bucketSize:hour}}}#/
```

In that URL, `maxPane:table` opens the table pane maximized, and `globalRule.chartState.showStatus:maximized` opens the chart inside the table in its maximized state. `globalRule` is a shortcut for a preset path rule with `pathPattern:"**"`; only provide the attributes you want to override. The example is intentionally unencoded for readability; encode `data` and `option` values when generating production links.

### Embedded Mode (iframe)

```html
<iframe 
  id="tdvFrame" 
  src="http://localhost:5173?embeddedId=tdv_1" 
  width="100%" 
  height="600">
</iframe>

<script>
  window.addEventListener('message', (event) => {
    if (event.data.type === 'tdv-ready') {
      // Viewer is ready, send data and optional view configuration.
      document.getElementById('tdvFrame').contentWindow.postMessage({
        type: 'tdv-setData',
        loading: false,
        data: [
          { ts: "2026-06-01T00:00:00Z", service: "api", count: 8 },
          { ts: "2026-06-01T00:00:00Z", service: "web", count: 5 },
          { ts: "2026-06-01T01:00:00Z", service: "api", count: 12 },
          { ts: "2026-06-01T01:00:00Z", service: "web", count: 7 }
        ],
        initialPath: '/',
        options: {
          title: 'Time Series Demo',
          maxPane: 'table',
          globalRule: {
            chartState: {
              showStatus: 'maximized',
              timeColumn: 'ts',
              valueColumns: ['count'],
              groupColumns: ['service'],
              showCount: true,
              bucketSize: 'hour'
            }
          }
        }
      }, '*');
    }
  });
</script>
```

Embedded messages support:

| Message field | Description |
|---------------|-------------|
| `type` | Use `tdv-setData` to send data and optional config, `tdv-setOptions` to update config without replacing data, or `tdv-setLoading` to control the embedded loading overlay. |
| `data` | Data payload for `tdv-setData`. |
| `initialPath` | Node path to select after loading or updating config. |
| `options` / `option` | Viewer options as an object or JSONEx string. Supports `title`, `maxPane`, and `globalRule`. |
| `preset` / `initialPreset` | Table preset as an object or JSONEx string. |
| `loading` / `isLoading` | Boolean loading overlay state. Also accepts string values such as `"true"` / `"false"`. |
| `loadingMessage` / `message` | Optional loading overlay text. |

`globalRule` in event options works the same as the URL `option.globalRule`: it is applied as a catch-all preset rule with `pathPattern:"**"` and only needs the attributes you want to override.

To control only the loading overlay, send `tdv-setLoading`:

```js
const frame = document.getElementById('tdvFrame').contentWindow

frame.postMessage({
  type: 'tdv-setLoading',
  loading: true,
  message: 'Loading report...'
}, '*')

frame.postMessage({
  type: 'tdv-setLoading',
  loading: false
}, '*')
```

`loading` and `loadingMessage` can also be included on `tdv-setData` or `tdv-setOptions` messages, so a host app can show the overlay before a report switch and hide it with the data/config update.

### As a Vue Component

```bash
npm install treedoc-viewer-v2
```

```vue
<script setup>
import { JsonTreeTable } from 'treedoc-viewer-v2'
import 'treedoc-viewer-v2/dist/style.css'
</script>

<template>
  <JsonTreeTable :data="myData" />
</template>
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `f` | Toggle fullscreen for current pane |
| `w` | Toggle text wrap |
| `[` | Navigate back |
| `]` | Navigate forward |
| `,` | Collapse one level |
| `.` | Expand one level |
| `<` | Collapse all |
| `>` | Expand all |
| `s` | Toggle children summary |

## Project Structure

```
v2/
├── src/
│   ├── components/          # Vue components
│   │   ├── JsonTreeTable.vue    # Main component
│   │   ├── TreeView.vue         # Tree panel
│   │   ├── TableView.vue        # Table panel
│   │   ├── SourceView.vue       # Source panel
│   │   └── ...                  # Support components
│   ├── models/              # TypeScript types
│   ├── parsers/             # Format parsers
│   ├── stores/              # Pinia stores
│   ├── views/               # Page views
│   └── data/                # Sample data
├── public/                  # Static assets
└── index.html
```

## License

MIT License - See [LICENSE](../LICENSE.txt) for details.

Copyright 2019-2026 Jianwu Chen

### Chart thresholds and legend columns

Pass thresholds through `option.globalRule.chartState.thresholds` (also supported
by embedded `tdv-setOptions` and saved chart state):

```json
{
  "thresholds": [
    { "name": "Commitment", "value": 13272, "color": "#f59e0b", "start": "2026-10-04", "end": "2029-09-30", "valueColumn": "Cost", "bucketSize": "day", "valueAgg": "sum", "groupColumn": "PricingModel" },
    { "name": "High", "value": 15000, "color": "#ef4444" }
  ]
}
```

Each threshold draws a dashed line and a translucent band up to the next higher
active threshold (or the top of the value axis). The axis includes the thresholds.
Name, color and value appear below the series legend. Optional start/end bounds
are inclusive/exclusive; date-only bounds use the same local calendar as date-only
chart data, while timestamps retain their explicit timezone. Optional metric,
bucket, aggregation and grouping guards hide overlays when their units no longer
match the chart. A guarded valueColumn requires it to be the sole selected metric.
Thresholds use the value axis, not the row-count axis.

The legend defaults to **Max** and **Last**. Its toolbar settings icon offers **Mean**,
**Increase**, and all key columns. Increase excludes the latest observation
(which may be partial), then subtracts the first observed value from the last
remaining value within the selected range. Last still shows the latest observation.
Increase uses the original units; gaps are not zero-filled and counter resets are
not adjusted. Fewer than three observations produce zero Increase.
Single-valued key columns are hidden by default and omitted from hover labels.
The header hover filter popup includes **Hide column**; use the toolbar picker to
restore it. Column choices survive chart remounts and can be supplied as
`chartState.legendColumns` (`name`, `group:0`, `group:1`, `max`, `last`, `mean`,
`increase`; pie metrics use their `pie:*` keys).

The **Legend settings** toolbar popup also adds, edits and removes threshold
entries. **Apply thresholds** validates names and numeric values before updating
the chart; existing date bounds and unit guards are retained. Click any series,
pie-slice or threshold color swatch to open the color selector, with a hex input
for exact colors. Colors update immediately and persist in chart state
(`seriesColors` maps stable series keys to CSS colors). These viewer edits do not
change the upstream Azure plan configuration. Bar charts automatically size bars
to occupy available category space, leaving a small gap between neighboring bars.

Each threshold has an eye toggle in its legend row and in Legend settings. Hidden
thresholds retain their name, color, value, bounds and guards, and remain listed
so they can be shown again. Hiding a threshold removes its line, band and axis
range contribution. Visibility persists as `thresholds[].visible` (default true).

Series palette assignments follow stable keys from the full dataset, so zooming
or changing legend rankings preserves each series' color. Custom colors update
line points, lines, bars and pie slices together with their legend swatches.
