<a href="https://github.com/treedoc/TreedocViewer"><img alt="GitHub Actions status" src="https://github.com/treedoc/TreedocViewer/workflows/Node%20CI/badge.svg"></a><a href='https://www.npmjs.com/package/treedoc-viewer' target="_blank"><img alt="npm" src="https://img.shields.io/npm/v/treedoc-viewer"></a>

# Treedoc Viewer

A feature-rich viewer for Treedoc implemented with VueJS and typescript. Treedoc is an abstraction for all the tree-structured document formats such as JSON, YAML, XML. This viewer has built-in support of JSON/[JSONex](https://github.com/eBay/jsonex/blob/master/JSONEX.md), YAML and XML. It provides an easy way to plugin any other format by implementing the ParserPlugin interface.

## Features

* Three views: Source, Tree and Table and they are toggleable
* Flexible navigation
  * Back/forward navigation between tree nodes
  * Support breadcrumb view of the node path for easy navigation to parent nodes
  * Navigation through *$ref* node as defined in [OpenAPI](https://openapis.org/) or [Google Discovery Service](https://developers.google.com/discovery)
  * Navigation is synchronized between tree view and table view
* Treeview
  * Support expand / collapse one level or all levels.
  * Tree is also embedded in table views
* Table view (Based on [vue2-datatable-component](https://www.npmjs.com/package/vue2-datatable-component))
  * Expand attributes for the child nodes as table columns
  * Support column filtering and sorting
  * Support pagination
  * Support column selection
* Source View (Based on [CodeMirror](https://codemirror.net/))
  * Syntax source highlighting
  * Synchronized highlighting in the source code when navigating through nodes
* Support multiple file formats
  * different sources of the document: open local file, open URL or copy/paste
  * Auto-detect format to choose the right parser
  * Support JSONex format (extension of JSON) (Based on [treedoc](https://www.npmjs.com/package/treedoc))
  * Support text protobuf which is support by JSONex parser
  * Plugable parser, so that more format can be easily added.
* Implemented as VueJS component, so it's easy to be reused in different applications

## Usage
### As a Vue component

```shell
yarn add treedoc-viewer
```

```js
// main.js
import TreedocViewer from 'treedoc-viewer'

Vue.use(TreedocViewer);
```

In `public/index.html`
```html
<link href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css" rel="stylesheet">
```

In component template
```html
<json-tree-table :data='jsonData'>
```

### As embedded iframe
If you are not using VueJs or don't want to introduce heavy dependencies, you can use embedded mode either through iframe or open a new window (tab)
```html
<iframe id='jttFrame' src="https://www.treedoc.org?embeddedId=jtt_1" width="100%" height="100%"></iframe>
<script>
  function setJttData(target, data) {
    target.postMessage({type:'jtt-setData', data}, '*');
  }
  setTimeout(() => setJttData(frame, {message:"after timeout"}), 1000);
</script>
```
For a working example, please refer to [sample/embedded.html](https://github.com/treedoc/TreedocViewer/blob/master/sample/embedded.html) in github repo.

## Development
```shell
yarn install
yarn serve
```

## Live Demo

<http://treedoc.org>

## License

Copyright 2019-2020 Jianwu Chen <BR>
Author/Developer: Jianwu Chen

Use of this source code is governed by an MIT-style license that can be found in the LICENSE file or at <https://opensource.org/licenses/MIT>.
