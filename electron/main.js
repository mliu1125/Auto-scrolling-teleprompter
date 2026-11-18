'use strict'

const { app, BrowserWindow, ipcMain, globalShortcut, dialog, shell, Menu, clipboard } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')

const isDev = !app.isPackaged
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

/**
 * 是否在录屏 / 截屏时隐藏本窗口。
 * Windows 下走 WDA_EXCLUDEFROMCAPTURE，录制软件（OBS / Teams / Zoom 等）
 * 抓取桌面时会直接跳过这个窗口，人眼在屏幕上仍可见。
 */
const DEFAULT_CONTENT_PROTECTION = true

/** @type {BrowserWindow | null} */
let mainWindow = null

/* ------------------------------------------------------------------ *
 * 窗口
 * ------------------------------------------------------------------ */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 680,
    minHeight: 480,
    show: false,
    frame: false, // 无边框
    titleBarStyle: 'hidden',
    transparent: true, // 允许调节界面背景透明度
    backgroundColor: '#00000000',
    contentProtection: DEFAULT_CONTENT_PROTECTION, // 录屏时不会被录进去
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  })

  Menu.setApplicationMenu(null)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })
  })

  // 外部链接走系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  // 阻止应用内导航（拖拽文件、误点链接）
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(DEV_SERVER_URL) && !url.startsWith('file://')) {
      event.preventDefault()
    }
  })

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/* ------------------------------------------------------------------ *
 * 全局快捷键（应用未聚焦时同样生效）
 * ------------------------------------------------------------------ */

const SHORTCUTS = [
  { accelerator: 'CmdOrControl+Space', channel: 'shortcut:play-pause' },
  { accelerator: 'CmdOrControl+Up', channel: 'shortcut:speed-up' },
  { accelerator: 'CmdOrControl+Down', channel: 'shortcut:speed-down' },
  // 注意：Electron 的 accelerator 不接受 "Plus/Minus/Equal" 这类名字，
  // 键盘符号必须用单字符形式（+ / - / =），否则注册时会抛错。
  { accelerator: 'CmdOrControl+=', channel: 'shortcut:font-up' },
  { accelerator: 'CmdOrControl+-', channel: 'shortcut:font-down' },
  { accelerator: 'CmdOrControl+M', channel: 'shortcut:mirror' },
  { accelerator: 'CmdOrControl+O', channel: 'shortcut:open-script' },
  { accelerator: 'CmdOrControl+Shift+F', channel: 'shortcut:fullscreen' },
  { accelerator: 'CmdOrControl+Shift+P', channel: 'shortcut:pin' },
  { accelerator: 'CmdOrControl+Home', channel: 'shortcut:scroll-top' },
  { accelerator: 'CmdOrControl+End', channel: 'shortcut:scroll-bottom' },
]

function registerShortcuts() {
  for (const { accelerator, channel } of SHORTCUTS) {
    try {
      const ok = globalShortcut.register(accelerator, () => {
        if (channel === 'shortcut:open-script') {
          openScriptDialog()
          return
        }
        mainWindow?.webContents.send(channel)
      })
      if (!ok) {
        console.warn(`[shortcut] 注册失败（可能已被其他软件占用）: ${accelerator}`)
      }
    } catch (err) {
      console.warn(`[shortcut] 无效的快捷键 ${accelerator}: ${err?.message || err}`)
    }
  }
}

function unregisterShortcuts() {
  globalShortcut.unregisterAll()
}

/* ------------------------------------------------------------------ *
 * 脚本文件读取
 * ------------------------------------------------------------------ */

/** 读取文本文件，自动兼容 UTF-8 / GBK（避免中文乱码） */
async function readTextFile(filePath) {
  const buf = await fs.readFile(filePath)
  let text = buf.toString('utf8')
  if (text.includes('\uFFFD')) {
    try {
      text = new TextDecoder('gbk').decode(buf)
    } catch (_) {
      /* 环境不支持 gbk 解码时保留 utf8 结果 */
    }
  }
  return text
}

async function openScriptDialog() {
  if (!mainWindow) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '打开提词脚本',
    properties: ['openFile'],
    filters: [
      { name: '文本脚本', extensions: ['txt', 'md', 'markdown', 'text'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (canceled || !filePaths.length) return null

  try {
    const content = await readTextFile(filePaths[0])
    const payload = { path: filePaths[0], name: path.basename(filePaths[0]), content }
    mainWindow.webContents.send('script:opened', payload)
    return payload
  } catch (err) {
    console.error('[script] 读取失败', err)
    return null
  }
}

/* ------------------------------------------------------------------ *
 * IPC
 * ------------------------------------------------------------------ */

ipcMain.handle('window:minimize', () => mainWindow?.minimize())

ipcMain.handle('window:close', () => mainWindow?.close())

ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow) return false
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
  return mainWindow.isMaximized()
})

ipcMain.handle('window:set-always-on-top', (_e, value) => {
  if (!mainWindow) return false
  mainWindow.setAlwaysOnTop(Boolean(value), 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(Boolean(value), { visibleOnFullScreen: true })
  return mainWindow.isAlwaysOnTop()
})

ipcMain.handle('window:is-always-on-top', () => Boolean(mainWindow?.isAlwaysOnTop()))

ipcMain.handle('window:set-fullscreen', (_e, value) => {
  if (!mainWindow) return false
  mainWindow.setFullScreen(Boolean(value))
  return mainWindow.isFullScreen()
})

/** 防录屏开关：开启后录制软件抓取桌面时会跳过本窗口 */
ipcMain.handle('window:set-content-protection', (_e, value) => {
  if (!mainWindow) return false
  const enabled = Boolean(value)
  mainWindow.setContentProtection(enabled)
  return enabled
})

ipcMain.handle('script:open', () => openScriptDialog())

ipcMain.handle('script:read', async (_e, filePath) => {
  try {
    const content = await readTextFile(filePath)
    return { ok: true, name: path.basename(filePath), content }
  } catch (err) {
    return { ok: false, error: String(err?.message || err) }
  }
})

ipcMain.handle('clipboard:read-text', () => clipboard.readText())

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  platform: process.platform,
}))

/* ------------------------------------------------------------------ *
 * 生命周期
 * ------------------------------------------------------------------ */

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    createWindow()
    registerShortcuts()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', unregisterShortcuts)
}
