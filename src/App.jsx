import { useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, splitLines, emitScrollCommand } from './store'
import { useIdleChrome } from './hooks/useIdleChrome'
import TitleBar from './components/TitleBar'
import PrompterStage from './components/PrompterStage'
import ControlDock from './components/ControlDock'
import ScriptDrawer from './components/ScriptDrawer'

/** 记录最近一次全局快捷键触发时间，避免与渲染层监听重复响应 */
let lastGlobalActionAt = 0

function Toast() {
  const toast = useStore((s) => s.toast)
  const clearToast = useStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(clearToast, 2200)
    return () => clearTimeout(timer)
  }, [toast, clearToast])

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="pointer-events-none absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-full border border-white/12 bg-black/70 px-4 py-2 text-[12px] text-white/85 backdrop-blur-xl"
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function App() {
  const script = useStore((s) => s.script)
  const fontSize = useStore((s) => s.fontSize)
  const mirrored = useStore((s) => s.mirrored)
  const opacity = useStore((s) => s.opacity)

  const chromeVisible = useIdleChrome(2000)
  const lines = useMemo(() => splitLines(script), [script])

  /* ---------------- 全局快捷键（主进程 IPC） ---------------- */
  useEffect(() => {
    const api = window.prompter
    if (!api?.on) return undefined

    const mark = () => {
      lastGlobalActionAt = Date.now()
    }
    const store = () => useStore.getState()

    const offs = [
      api.on.playPause(() => {
        mark()
        store().togglePlay()
      }),
      api.on.speedUp(() => {
        mark()
        store().speedUp()
      }),
      api.on.speedDown(() => {
        mark()
        store().speedDown()
      }),
      api.on.fontUp(() => {
        mark()
        store().fontUp()
      }),
      api.on.fontDown(() => {
        mark()
        store().fontDown()
      }),
      api.on.mirror(() => {
        mark()
        store().toggleMirror()
      }),
      api.on.fullscreen(() => {
        mark()
        store().toggleFullscreen()
      }),
      api.on.pin(() => {
        mark()
        store().togglePin()
      }),
      api.on.scrollTop(() => {
        mark()
        emitScrollCommand('top')
      }),
      api.on.scrollBottom(() => {
        mark()
        emitScrollCommand('bottom')
      }),
      api.on.scriptOpened((payload) => {
        mark()
        if (!payload) return
        store().setScript(payload.content)
        store().setDrawerOpen(false)
        store().showToast(`已载入 ${payload.name}`)
      }),
    ]

    return () => offs.forEach((off) => off && off())
  }, [])

  /* ---------------- 渲染层快捷键兜底（全局注册失败时生效） ---------------- */
  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true

      const store = () => useStore.getState()
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      // 全局快捷键刚刚生效过，本次键盘事件不再重复处理
      if (Date.now() - lastGlobalActionAt < 250) return

      if (mod && event.code === 'Space') {
        event.preventDefault()
        store().togglePlay()
        return
      }
      if (mod && event.key === 'ArrowUp') {
        event.preventDefault()
        store().speedUp()
        return
      }
      if (mod && event.key === 'ArrowDown') {
        event.preventDefault()
        store().speedDown()
        return
      }
      if (mod && (event.key === '=' || event.key === '+')) {
        event.preventDefault()
        store().fontUp()
        return
      }
      if (mod && event.key === '-') {
        event.preventDefault()
        store().fontDown()
        return
      }
      if (mod && key === 'm') {
        event.preventDefault()
        store().toggleMirror()
        return
      }
      if (mod && key === 'o') {
        event.preventDefault()
        store().setDrawerOpen(true)
        return
      }
      if (mod && event.shiftKey && key === 'f') {
        event.preventDefault()
        store().toggleFullscreen()
        return
      }
      if (!typing && event.code === 'Space') {
        event.preventDefault()
        store().togglePlay()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  /* ---------------- 拖拽 .txt 到窗口直接载入 ---------------- */
  useEffect(() => {
    const prevent = (event) => {
      event.preventDefault()
      event.stopPropagation()
    }
    const onDrop = async (event) => {
      event.preventDefault()
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        useStore.getState().setScript(text)
        useStore.getState().showToast(`已载入 ${file.name}`)
      } catch (_) {
        useStore.getState().showToast('文件读取失败')
      }
    }
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <div
      className="relative h-screen w-screen overflow-hidden text-white"
      style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }}
    >
      <PrompterStage lines={lines} fontSize={fontSize} mirrored={mirrored} />
      <TitleBar visible={chromeVisible} lineCount={lines.length} />
      <ControlDock visible={chromeVisible} />
      <ScriptDrawer />
      <Toast />
    </div>
  )
}
