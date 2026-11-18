'use strict'

const { contextBridge, ipcRenderer } = require('electron')

/** 允许渲染进程调用的 invoke 通道白名单 */
const INVOKE_CHANNELS = new Set([
  'window:minimize',
  'window:close',
  'window:toggle-maximize',
  'window:set-always-on-top',
  'window:is-always-on-top',
  'window:set-fullscreen',
  'window:set-content-protection',
  'script:open',
  'script:read',
  'clipboard:read-text',
  'app:info',
])

/** 允许渲染进程订阅的事件通道白名单 */
const EVENT_CHANNELS = new Set([
  'shortcut:play-pause',
  'shortcut:speed-up',
  'shortcut:speed-down',
  'shortcut:font-up',
  'shortcut:font-down',
  'shortcut:mirror',
  'shortcut:fullscreen',
  'shortcut:pin',
  'shortcut:scroll-top',
  'shortcut:scroll-bottom',
  'script:opened',
])

function subscribe(channel, callback) {
  if (!EVENT_CHANNELS.has(channel) || typeof callback !== 'function') return () => {}
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    close: () => ipcRenderer.invoke('window:close'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    setAlwaysOnTop: (value) => ipcRenderer.invoke('window:set-always-on-top', Boolean(value)),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:is-always-on-top'),
    setFullscreen: (value) => ipcRenderer.invoke('window:set-fullscreen', Boolean(value)),
    setContentProtection: (value) => ipcRenderer.invoke('window:set-content-protection', Boolean(value)),
  },
  script: {
    /** 打开系统文件选择框；主进程读取后通过 script:opened 事件回传 */
    open: () => ipcRenderer.invoke('script:open'),
    /** 直接读取指定路径的文本（UTF-8 / GBK 自动识别） */
    read: (filePath) => ipcRenderer.invoke('script:read', filePath),
  },
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:read-text'),
  },
  app: {
    info: () => ipcRenderer.invoke('app:info'),
  },
  on: {
    playPause: (cb) => subscribe('shortcut:play-pause', cb),
    speedUp: (cb) => subscribe('shortcut:speed-up', cb),
    speedDown: (cb) => subscribe('shortcut:speed-down', cb),
    fontUp: (cb) => subscribe('shortcut:font-up', cb),
    fontDown: (cb) => subscribe('shortcut:font-down', cb),
    mirror: (cb) => subscribe('shortcut:mirror', cb),
    fullscreen: (cb) => subscribe('shortcut:fullscreen', cb),
    pin: (cb) => subscribe('shortcut:pin', cb),
    scrollTop: (cb) => subscribe('shortcut:scroll-top', cb),
    scrollBottom: (cb) => subscribe('shortcut:scroll-bottom', cb),
    scriptOpened: (cb) => subscribe('script:opened', cb),
  },
}

contextBridge.exposeInMainWorld('prompter', api)
