# TreeDoc Viewer for VS Code

TreeDoc Viewer brings the TreeDoc web viewer experience into VS Code, so you can inspect JSON and JSONC files without leaving the editor.

Open a document in a dedicated viewer with synchronized source, tree, and table panes. It is built on the same Vue 3 TreeDoc Viewer used by the web app at [treedoc.org](https://www.treedoc.org).

## Features

- View JSON and JSONC files as an expandable tree.
- Browse array/object data in a table view with sorting, filtering, and column visibility controls.
- Keep the original source view available alongside structured tree and table panes.
- Open nested or long cell values in a separate TreeDoc Viewer tab.
- Use TreeDoc Viewer features such as pattern extraction, extended fields, presets, and time-series charting where supported by the data.

## Usage

Open any `.json`, `.jsonc`, `yaml`, `xml` or `log` file, then choose one of these options:

- Run **TreeDoc Viewer: Open with TreeDoc Viewer** from the Command Palette.
- Right-click a JSON file in Explorer and choose **Open with TreeDoc Viewer**.
- Use **Reopen Editor With...** and select **TreeDoc Viewer**.

The viewer updates when the underlying text document changes.

## Notes

This extension renders files locally inside a VS Code webview. The document content is not sent to TreeDoc servers.

External links opened from the viewer are passed through VS Code's external browser handling. Some advanced TreeDoc Viewer features dynamically evaluate expressions entered by the user, matching the behavior of the web viewer.

## Development

```bash
cd ../v2
yarn install
cd ../vscode-extension
npm install
npm run build
```

Open this folder in VS Code and press `F5` to launch an Extension Development Host.

Use **Open with TreeDoc Viewer** from the command palette, editor title context menu, explorer context menu, or **Reopen Editor With...**.

## Publishing

Create a Visual Studio Marketplace publisher, then create an Azure DevOps personal access token with the **Marketplace: Manage** scope.

```bash
cd vscode-extension
npm run build
npx vsce login <publisher-id>
npx vsce package
npx vsce publish
```

For version bumps, use:

```bash
npx vsce publish patch
npx vsce publish minor
npx vsce publish major
```
