# TreeDoc Viewer

A powerful JSON/YAML/XML viewer with tree view, table view, and advanced filtering capabilities.

**Live Demo:** [https://treedoc.github.io](https://treedoc.github.io)

## Versions

### v2 (Current - Vue 3 + PrimeVue)
The latest version built with Vue 3, TypeScript, PrimeVue 4, and Vite.

```bash
cd v2
yarn install
yarn dev      # Development server
yarn build    # Production build
yarn deploy   # Deploy to GitHub Pages
```

### VS Code Extension

The VS Code extension lives in `vscode-extension` and uses the v2 Vue viewer as its webview UI.

```bash
cd v2
yarn install
cd ../vscode-extension
npm install
npm run build
```

The extension build reuses the local v2 viewer source and toolchain. Launch the extension from VS Code with `F5`, then use **Open with TreeDoc Viewer** for `.json` or `.jsonc` files.

```bash
cd vscode-extension
npm run package
```

### v1 (Legacy - Vue 2 + Bootstrap)
The original version built with Vue 2, Bootstrap, and Vue CLI.

```bash
cd v1
yarn install
yarn serve    # Development server
yarn build    # Production build
```

## Features

- **Tree View**: Navigate JSON/YAML/XML documents as an expandable tree
- **Table View**: View array data in a powerful table with sorting, filtering, and column management
- **Pattern Matching**: Extract fields from string values using pattern expressions
- **Extended Fields**: Add computed columns using JSONPath-like expressions
- **Presets**: Save and load query configurations
- **Multiple Formats**: Support for JSON, YAML, XML, CSV, and more

## License

MIT License - see [LICENSE.txt](v1/LICENSE.txt)
