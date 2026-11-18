import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardPaste, FolderOpen, Check, Eraser } from 'lucide-react'
import { useStore, analyzeScript } from '../store'

/** 底部脚本编辑抽屉 */
export default function ScriptDrawer() {
  const open = useStore((s) => s.drawerOpen)
  const draft = useStore((s) => s.draft)
  const setDraft = useStore((s) => s.setDraft)
  const applyDraft = useStore((s) => s.applyDraft)
  const setDrawerOpen = useStore((s) => s.setDrawerOpen)
  const showToast = useStore((s) => s.showToast)
  const textareaRef = useRef(null)

  const stats = useMemo(() => analyzeScript(draft), [draft])

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 120)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [open])

  const handlePaste = async () => {
    try {
      const text = await window.prompter?.clipboard?.readText?.()
      if (text) {
        setDraft(text)
        showToast('已从剪贴板粘贴')
      } else {
        showToast('剪贴板为空')
      }
    } catch (_) {
      showToast('无法读取剪贴板')
    }
  }

  const handleOpenFile = async () => {
    try {
      await window.prompter?.script?.open()
    } catch (_) {
      showToast('打开文件失败')
    }
  }

  const handleApply = () => {
    applyDraft()
    setDrawerOpen(false)
    showToast('脚本已应用')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 34 }}
          className="absolute inset-x-0 bottom-0 z-40 p-3"
        >
          <div
            data-chrome
            className="rounded-3xl border border-white/12 bg-black/75 p-4 shadow-[0_-10px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenFile}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-white/65 transition-colors duration-200 hover:bg-white/10 hover:text-white"
                >
                  <FolderOpen size={14} strokeWidth={1.8} />
                  打开文件
                </button>
                <button
                  type="button"
                  onClick={handlePaste}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-white/65 transition-colors duration-200 hover:bg-white/10 hover:text-white"
                >
                  <ClipboardPaste size={14} strokeWidth={1.8} />
                  粘贴
                </button>
                <button
                  type="button"
                  onClick={() => setDraft('')}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-white/65 transition-colors duration-200 hover:bg-white/10 hover:text-white"
                >
                  <Eraser size={14} strokeWidth={1.8} />
                  清空
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] tabular-nums text-white/35">
                  {stats.chars} 字 · {stats.lines ?? 0} 行 · 约 {stats.seconds} 秒
                </span>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white shadow-[0_6px_18px_rgba(10,132,255,0.35)] transition-colors duration-200 hover:bg-accent-hover"
                >
                  <Check size={14} strokeWidth={2.2} />
                  应用
                </button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleApply()
                }
                e.stopPropagation()
              }}
              spellCheck={false}
              placeholder="在这里粘贴或输入提词脚本…（Ctrl+Enter 应用）"
              className="scroll-hidden h-[38vh] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-[15px] leading-[1.7] text-white/90 outline-none transition-colors duration-200 placeholder:text-white/25 focus:border-accent/60 focus:bg-white/[0.06]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
