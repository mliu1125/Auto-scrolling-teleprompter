import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

export const SPEED_PRESETS = { slow: 30, medium: 62, fast: 115 }
export const SPEED_MIN = 12
export const SPEED_MAX = 240
export const SPEED_STEP = 12

export const FONT_MIN = 18
export const FONT_MAX = 72
export const FONT_STEP = 2
export const FONT_DEFAULT = 32

const SAMPLE_SCRIPT = `欢迎使用提词器。

这是一段示例文本，用来演示自动滚动与当前行高亮的效果。

当前正在朗读的这一行会以纯白高亮显示，未读的部分会降低到百分之四十的透明度，
已经读过的部分则进一步淡出，视线始终聚焦在屏幕上方三分之一的位置。

把鼠标移到屏幕上，控制条会浮现；静止两秒后，界面自动淡出，只留下文字本身。
用滚轮可以随时手动上下滚动，手动滚动会自动暂停播放。

试试按 Ctrl 加空格键切换播放与暂停，Ctrl 加上下方向键调整滚动速度。

现在，把你自己的稿子粘贴进来，然后点击左下角的播放按钮。`

/* ------------------------------------------------------------------ *
 * 安全存储（file:// 协议下 localStorage 可能被禁用）
 * ------------------------------------------------------------------ */

const memoryStore = new Map()

const safeStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch (_) {
      return memoryStore.get(name) ?? null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (_) {
      memoryStore.set(name, value)
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch (_) {
      memoryStore.delete(name)
    }
  },
}

/* ------------------------------------------------------------------ *
 * 滚动命令总线
 * 把「跳到顶部 / 底部」这类指令从快捷键层送到阅读区控制器
 * ------------------------------------------------------------------ */

let scrollCommandHandler = null

export function registerScrollHandler(handler) {
  scrollCommandHandler = handler
  return () => {
    if (scrollCommandHandler === handler) scrollCommandHandler = null
  }
}

export function emitScrollCommand(command) {
  scrollCommandHandler?.(command)
}

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

export const useStore = create(
  persist(
    (set, get) => ({
      /* 内容 */
      script: SAMPLE_SCRIPT,
      draft: SAMPLE_SCRIPT,

      /* 播放状态 */
      playing: false,
      activeLine: 0,

      /* 参数 */
      speed: SPEED_PRESETS.medium,
      fontSize: FONT_DEFAULT,
      mirrored: false,
      alwaysOnTop: false,
      opacity: 1, // 背景不透明度（1 = 纯黑，0.25 = 可透出下层页面）
      contentProtection: true, // 防录屏：录制时该窗口不被捕获

      /* 界面 */
      chromeVisible: true,
      drawerOpen: false,
      fullscreen: false,
      toast: null,

      /* ---------------- actions ---------------- */

      setScript: (text) => set({ script: text ?? '', draft: text ?? '', activeLine: 0 }),

      setDraft: (text) => set({ draft: text }),

      applyDraft: () => {
        const { draft } = get()
        set({ script: draft, activeLine: 0 })
      },

      setPlaying: (playing) => set({ playing: Boolean(playing) }),

      togglePlay: () => set((s) => ({ playing: !s.playing })),

      stop: () => set({ playing: false }),

      setActiveLine: (activeLine) => {
        if (get().activeLine !== activeLine) set({ activeLine })
      },

      setSpeed: (speed) => set({ speed: clamp(Math.round(speed), SPEED_MIN, SPEED_MAX) }),

      speedUp: () => set((s) => ({ speed: clamp(s.speed + SPEED_STEP, SPEED_MIN, SPEED_MAX) })),

      speedDown: () => set((s) => ({ speed: clamp(s.speed - SPEED_STEP, SPEED_MIN, SPEED_MAX) })),

      setFontSize: (fontSize) => set({ fontSize: clamp(Math.round(fontSize), FONT_MIN, FONT_MAX) }),

      fontUp: () => set((s) => ({ fontSize: clamp(s.fontSize + FONT_STEP, FONT_MIN, FONT_MAX) })),

      fontDown: () => set((s) => ({ fontSize: clamp(s.fontSize - FONT_STEP, FONT_MIN, FONT_MAX) })),

      toggleMirror: () => set((s) => ({ mirrored: !s.mirrored })),

      setOpacity: (opacity) =>
        set({ opacity: Math.min(1, Math.max(0.15, Number(opacity))) }),

      setContentProtection: (enabled) => set({ contentProtection: Boolean(enabled) }),

      toggleContentProtection: async () => {
        const next = !get().contentProtection
        set({ contentProtection: next })
        try {
          await window.prompter?.window?.setContentProtection?.(next)
        } catch (_) {
          /* 浏览器预览模式下忽略 */
        }
        get().showToast(
          next
            ? '防录屏已开启：录制时本窗口不会被录进去'
            : '防录屏已关闭：本窗口可被屏幕录制捕获',
        )
      },

      setAlwaysOnTop: (alwaysOnTop) => set({ alwaysOnTop: Boolean(alwaysOnTop) }),

      togglePin: async () => {
        const next = !get().alwaysOnTop
        set({ alwaysOnTop: next })
        try {
          await window.prompter?.window?.setAlwaysOnTop?.(next)
        } catch (_) {
          /* 浏览器预览模式下忽略 */
        }
        get().showToast(next ? '窗口已置顶' : '已取消置顶')
      },

      setChromeVisible: (chromeVisible) => {
        if (get().chromeVisible !== chromeVisible) set({ chromeVisible })
      },

      setDrawerOpen: (drawerOpen) => set({ drawerOpen: Boolean(drawerOpen) }),

      toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),

      setFullscreen: (fullscreen) => set({ fullscreen: Boolean(fullscreen) }),

      toggleFullscreen: async () => {
        const next = !get().fullscreen
        try {
          await window.prompter?.window?.setFullscreen?.(next)
        } catch (_) {
          /* 浏览器预览模式下忽略 */
        }
        set({ fullscreen: next })
      },

      showToast: (message) => {
        set({ toast: { message, id: Date.now() } })
      },

      clearToast: () => set({ toast: null }),
    }),
    {
      name: 'prompter-state-v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        script: state.script,
        speed: state.speed,
        fontSize: state.fontSize,
        mirrored: state.mirrored,
        alwaysOnTop: state.alwaysOnTop,
        opacity: state.opacity,
      }),
    },
  ),
)

/** 工具：把脚本文本切分为行（保留空行，忽略 CRLF） */
export function splitLines(text) {
  if (!text) return []
  return String(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
}

/** 工具：统计字数与预估朗读时长（中文按字，英文按词） */
export function analyzeScript(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  const cjk = (clean.match(/[\u4e00-\u9fa5]/g) || []).length
  const words = (clean.match(/[A-Za-z0-9]+/g) || []).length
  const chars = clean.length
  const lines = text ? String(text).replace(/\r\n?/g, '\n').split('\n').length : 0
  // 中文约 240 字/分钟，英文约 130 词/分钟
  const minutes = cjk / 240 + words / 130
  return { chars, cjk, words, lines, minutes, seconds: Math.round(minutes * 60) }
}
