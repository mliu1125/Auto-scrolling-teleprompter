import { motion } from 'framer-motion'
import { Pause, Play, FlipHorizontal2, FileText, Maximize2, Trash2 } from 'lucide-react'
import { useStore, SPEED_MIN, SPEED_MAX, SPEED_PRESETS } from '../store'
import { Divider, IconButton } from './ui'

function speedLabel(speed) {
  if (speed <= 36) return '慢'
  if (speed <= 92) return '中'
  return '快'
}

/** 底部悬浮控制台 */
export default function ControlDock({ visible }) {
  const playing = useStore((s) => s.playing)
  const togglePlay = useStore((s) => s.togglePlay)
  const speed = useStore((s) => s.speed)
  const setSpeed = useStore((s) => s.setSpeed)
  const fontSize = useStore((s) => s.fontSize)
  const fontUp = useStore((s) => s.fontUp)
  const fontDown = useStore((s) => s.fontDown)
  const mirrored = useStore((s) => s.mirrored)
  const toggleMirror = useStore((s) => s.toggleMirror)
  const drawerOpen = useStore((s) => s.drawerOpen)
  const toggleDrawer = useStore((s) => s.toggleDrawer)
  const showToast = useStore((s) => s.showToast)

  const openFile = async () => {
    try {
      await window.prompter?.script?.open()
    } catch (_) {
      showToast('打开文件失败')
    }
  }

  const clearScript = () => {
    useStore.getState().setScript('')
    useStore.getState().setDraft('')
    showToast('已清空脚本')
  }

  return (
    <motion.div
      data-chrome
      initial={false}
      animate={{
        y: visible && !drawerOpen ? 0 : 150,
        opacity: visible && !drawerOpen ? 1 : 0,
      }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      style={{ x: '-50%' }}
      className="absolute bottom-6 left-1/2 z-30 flex flex-col items-center gap-2"
    >
      {/* 速度预设快捷点击区（位于控制台上方，避免超出窗口底部） */}
      <div className="flex items-center justify-center gap-1.5">
        {[
          { label: '慢', value: SPEED_PRESETS.slow },
          { label: '中', value: SPEED_PRESETS.medium },
          { label: '快', value: SPEED_PRESETS.fast },
        ].map((preset) => (
          <motion.button
            key={preset.label}
            type="button"
            onClick={() => setSpeed(preset.value)}
            whileHover={{ scale: 0.95 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 460, damping: 26 }}
            className={[
              'rounded-full px-3 py-1 text-[11px] transition-colors duration-200',
              speed === preset.value
                ? 'bg-white/15 text-white'
                : 'text-white/35 hover:bg-white/8 hover:text-white/70',
            ].join(' ')}
          >
            {preset.label}
          </motion.button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 rounded-[22px] border border-white/12 bg-white/[0.07] px-3 py-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        {/* 播放 / 暂停：亮蓝色主按钮 */}
        <motion.button
          type="button"
          title={playing ? '暂停 (Ctrl+Space)' : '播放 (Ctrl+Space)'}
          aria-label={playing ? '暂停' : '播放'}
          onClick={togglePlay}
          whileHover={{ scale: 0.95 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 460, damping: 24 }}
          className="grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-[0_8px_24px_rgba(10,132,255,0.45)] transition-colors duration-200 hover:bg-accent-hover"
        >
          {playing ? (
            <Pause size={20} strokeWidth={2} fill="currentColor" />
          ) : (
            <Play size={20} strokeWidth={2} fill="currentColor" className="ml-0.5" />
          )}
        </motion.button>

        <Divider className="mx-1.5" />

        {/* 字号 */}
        <div className="flex items-center gap-1">
          <motion.button
            type="button"
            title="减小字号 (Ctrl+-)"
            onClick={fontDown}
            whileHover={{ scale: 0.95 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 460, damping: 26 }}
            className="grid h-9 w-9 place-items-center rounded-xl text-[13px] font-medium text-white/65 transition-colors duration-200 hover:bg-white/10 hover:text-white"
          >
            A−
          </motion.button>
          <motion.button
            type="button"
            title="增大字号 (Ctrl++)"
            onClick={fontUp}
            whileHover={{ scale: 0.95 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 460, damping: 26 }}
            className="grid h-9 w-9 place-items-center rounded-xl text-[17px] font-medium text-white/65 transition-colors duration-200 hover:bg-white/10 hover:text-white"
          >
            A+
          </motion.button>
        </div>

        <Divider className="mx-1.5" />

        {/* 速度 */}
        <div className="flex items-center gap-2.5 px-1">
          <span className="whitespace-nowrap text-[11px] tracking-wide text-white/40">速度</span>
          <input
            type="range"
            className="speed-slider"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={1}
            value={speed}
            title="滚动速度 (Ctrl+↑ / Ctrl+↓)"
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
          <span className="w-6 text-center text-[11px] tabular-nums text-white/70">
            {speedLabel(speed)}
          </span>
        </div>

        <Divider className="mx-1.5" />

        {/* 镜像翻转 */}
        <IconButton
          icon={FlipHorizontal2}
          label="镜像翻转 (Ctrl+M)"
          active={mirrored}
          onClick={() => {
            toggleMirror()
            showToast(mirrored ? '已取消镜像' : '已开启镜像（适合分光镜提词）')
          }}
        />

        {/* 脚本 / 清空 / 全屏 */}
        <IconButton icon={FileText} label="编辑脚本 (Ctrl+O)" onClick={toggleDrawer} />
        <IconButton icon={Trash2} label="清空脚本" onClick={clearScript} />
        <IconButton
          icon={Maximize2}
          label="全屏 (Ctrl+Shift+F)"
          onClick={() => window.prompter?.window?.setFullscreen?.(true)}
        />
      </div>
    </motion.div>
  )
}
