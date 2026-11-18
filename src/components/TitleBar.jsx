import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pin, PinOff, Minus, X, Eye, ShieldCheck, ShieldOff } from 'lucide-react'
import { useStore } from '../store'
import { IconButton } from './ui'

/**
 * 顶部控制栏（无边框窗口的可拖拽区）
 * 左：置顶 / 防录屏 / 背景透明度   中：标题 + 进度   右：最小化 / 关闭
 */
export default function TitleBar({ visible, lineCount = 0 }) {
  const [showOpacity, setShowOpacity] = useState(false)

  const alwaysOnTop = useStore((s) => s.alwaysOnTop)
  const togglePin = useStore((s) => s.togglePin)
  const activeLine = useStore((s) => s.activeLine)
  const opacity = useStore((s) => s.opacity)
  const setOpacity = useStore((s) => s.setOpacity)
  const contentProtection = useStore((s) => s.contentProtection)
  const toggleContentProtection = useStore((s) => s.toggleContentProtection)

  const progress = lineCount > 0 ? Math.min(activeLine + 1, lineCount) : 0

  return (
    <motion.header
      data-chrome
      initial={false}
      animate={{ y: visible ? 0 : -56, opacity: visible ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className="drag-region absolute inset-x-0 top-0 z-30 h-11 border-b border-white/10 bg-white/[0.055] backdrop-blur-xl"
    >
      <div className="flex h-full items-center justify-between px-3">
        {/* 左侧：窗口级开关 */}
        <div className="no-drag flex items-center gap-1">
          <IconButton
            icon={alwaysOnTop ? PinOff : Pin}
            label={alwaysOnTop ? '取消置顶 (Ctrl+Shift+P)' : '窗口置顶'}
            active={alwaysOnTop}
            size="sm"
            onClick={togglePin}
          />
          <IconButton
            icon={contentProtection ? ShieldCheck : ShieldOff}
            label="防录屏：录制时本窗口不会被录进去"
            active={contentProtection}
            size="sm"
            onClick={toggleContentProtection}
          />
          <IconButton
            icon={Eye}
            label="背景透明度"
            active={showOpacity}
            size="sm"
            onClick={() => setShowOpacity((v) => !v)}
          />
        </div>

        {/* 中间：标题 + 阅读进度 */}
        <div className="pointer-events-none flex items-baseline gap-2.5">
          <span className="text-[13px] font-medium tracking-[0.2em] text-white/85">提词器</span>
          {lineCount > 0 && (
            <span className="text-[11px] tabular-nums text-white/35">
              {progress} / {lineCount}
            </span>
          )}
        </div>

        {/* 右侧：窗口控制 */}
        <div className="no-drag flex items-center gap-1">
          <IconButton
            icon={Minus}
            label="最小化"
            size="sm"
            onClick={() => window.prompter?.window?.minimize()}
          />
          <IconButton
            icon={X}
            label="关闭"
            size="sm"
            onClick={() => window.prompter?.window?.close()}
            className="hover:bg-red-500/80 hover:text-white"
          />
        </div>
      </div>

      {/* 背景透明度浮层 */}
      <AnimatePresence>
        {showOpacity && (
          <motion.div
            data-chrome
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="absolute left-3 top-11 z-40 w-64 rounded-2xl border border-white/12 bg-black/85 p-3.5 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            <div className="mb-2.5 flex items-center justify-between text-[11px] text-white/60">
              <span>背景不透明度</span>
              <span className="tabular-nums text-white/90">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              className="speed-slider w-full"
              min={15}
              max={100}
              step={1}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            />
            <div className="mt-2 flex items-center justify-between text-[10px] text-white/35">
              <span>全透（观察下层页面）</span>
              <span>纯黑（专注阅读）</span>
            </div>
            <p className="mt-2.5 text-[10px] leading-relaxed text-white/35">
              调低后窗口变为半透明，可一边看稿一边观察下方浏览器页面的操作。
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
