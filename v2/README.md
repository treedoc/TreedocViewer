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
