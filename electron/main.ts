import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'

const isDev = !app.isPackaged

let win: BrowserWindow | null

function createWindow(): void {
  const preload = path.join(__dirname, 'preload.js')

  win = new BrowserWindow({
    title: '剧本杀快速凑桌助手',
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0f172a',
  })

  win.once('ready-to-show', () => {
    win?.show()
  })

  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    if (openUrl.startsWith('http:') || openUrl.startsWith('https:')) {
      shell.openExternal(openUrl)
    }
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    win.loadFile(indexPath)
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(createWindow)
}

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
