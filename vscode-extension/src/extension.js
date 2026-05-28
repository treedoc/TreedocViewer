const path = require('path')
const vscode = require('vscode')

const VIEW_TYPE = 'treedocViewer.jsonViewer'

function activate(context) {
  const provider = new TreeDocJsonViewerProvider(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: true,
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('treedocViewer.openJsonViewer', async (uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri
      if (!targetUri) {
        vscode.window.showWarningMessage('Open a JSON file before launching TreeDoc Viewer.')
        return
      }

      await vscode.commands.executeCommand('vscode.openWith', targetUri, VIEW_TYPE)
    }),
  )
}

class TreeDocJsonViewerProvider {
  constructor(extensionUri) {
    this.extensionUri = extensionUri
  }

  async resolveCustomTextEditor(document, webviewPanel, token) {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media'),
      ],
    }

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview)

    const postDocument = () => {
      if (token.isCancellationRequested) return
      webviewPanel.webview.postMessage({
        type: 'setDocument',
        text: document.getText(),
        fileName: path.basename(document.uri.fsPath || document.uri.path),
      })
    }

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        postDocument()
      }
    })

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose()
    })

    webviewPanel.webview.onDidReceiveMessage((message) => {
      if (message?.type === 'ready') {
        postDocument()
      } else if (message?.type === 'openExternal' && typeof message.href === 'string') {
        openExternal(message.href)
      } else if (message?.type === 'openDocument' && typeof message.text === 'string') {
        this.openDocument(message.text, message.title)
      }
    })
  }

  openDocument(text, title) {
    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      typeof title === 'string' && title ? title : 'TreeDoc Viewer',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'media'),
        ],
      },
    )

    panel.webview.html = this.getHtml(panel.webview)
    panel.webview.onDidReceiveMessage((message) => {
      if (message?.type === 'ready') {
        panel.webview.postMessage({
          type: 'setDocument',
          text,
          fileName: typeof title === 'string' && title ? title : 'cell value',
        })
      } else if (message?.type === 'openExternal' && typeof message.href === 'string') {
        openExternal(message.href)
      } else if (message?.type === 'openDocument' && typeof message.text === 'string') {
        this.openDocument(message.text, message.title)
      }
    })
  }

  getHtml(webview) {
    const nonce = createNonce()
    const mediaUri = vscode.Uri.joinPath(this.extensionUri, 'media')
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'assets', 'main.js'))
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'assets', 'main.css'))
    const cspSource = webview.cspSource

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; font-src ${cspSource} https://fonts.gstatic.com data:; style-src ${cspSource} https://fonts.googleapis.com 'unsafe-inline'; script-src ${cspSource} 'nonce-${nonce}' 'unsafe-eval'; connect-src https:;" />
    <link rel="stylesheet" href="${styleUri}">
    <title>TreeDoc</title>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`
  }
}

function openExternal(href) {
  let uri
  try {
    uri = vscode.Uri.parse(href)
  } catch {
    return
  }

  if (uri.scheme !== 'http' && uri.scheme !== 'https') {
    return
  }

  vscode.env.openExternal(uri)
}

function createNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let value = ''
  for (let i = 0; i < 32; i++) {
    value += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return value
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
}
