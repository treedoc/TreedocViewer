# Treedoc Viewer

A feature rich viewer for Treedoc implemented with VueJS and typescript. Treedoc is an abstraction for all the tree structured document formats such as JSON, YAML, XML. This viewer has build in support of JSON/[JSONex](https://github.com/eBay/jsonex/blob/master/JSONEX.md), YAML and XML. It provides an easy way to plugin any other format by implmementing the ParserPlugin interface.

## Features

* Three views: Source, Tree and Table and they are togglable
* Flexible nagivation
  * Back/forward navigation between tree nodes
  * Support breadcurm view of the node path for easy navigation to parent nodes
  * Navigation through *$ref* node as defined in [OpenAPI](https://openapis.org/) or [Google Discovery Service](https://developers.google.com/discovery)
  * Navigation is synchronized between tree view and table view
* Treeview
  * Support expand / clapse one level or all levels.
  * Tree is also embedded in table views
* Table view (Based on [vue2-datatable-component](https://www.npmjs.com/package/vue2-datatable-component))
  * Expand attribtes for the child nodes as table columns
  * Support column filtering and sorting
  * Support pagingation
  * Support column selection
* Source View (Based on [CodeMirror](https://codemirror.net/))
  * Syntax source highlighting
  * Synchronized highlighing in the source code when navigating through nodes
* Support multiple file formats 
  * different sources of the document: open local file, open url or copy/paste
  * Auto-detect format to choose the right parser
  * Support JSONEX format (extension of JSON)
  * Support text protobuf which is support by JSONEX parser
  * Pluggable parser, so that more format can be easily added.
* Implemented as VueJS component, so it's easy to be reused in different applications

## Live Demo

<https://treedoc.github.io/>
