import { memo, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useStore, registerScrollHandler } from '../store'
import { useAutoScroll } from '../hooks/useAutoScroll'

/**
 * 行透明度：当前朗读行 1，未读 0.4（Apple HIG 的降级阅读态），已读进一步淡出。
 */
function lineOpacity(index, active) {
  const d = index - active
  if (d === 0) return 1
  if (d < 0) return Math.max(0.16, 0.34 - Math.abs(d) * 0.02)
  return Math.max(0.28, 0.4 - (d - 1) * 0.02)
}

const Line = memo(function Line({ text, opacity, isActive }) {
  return (
    <div
      className="px-10"
      style={{
        opacity,
        transition: 'opacity 240ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <p
        className={isActive ? 'font-medium' : 'font-normal'}
        style={{
          color: '#ffffff',
          lineHeight: 1.6,
          textShadow: isActive ? '0 0 48px rgba(255,255,255,0.16)' : 'none',
        }}
      >
        {text || '\u00A0'}
      </p>
    </div>
  )
})

/**
 * 核心阅读区：居中提词文本 + 当前行高亮 + 平滑自动滚动
 */
export default function PrompterStage({ lines, fontSize, mirrored }) {
  const containerRef = useRef(null)
  const lineNodesRef = useRef([])
  const refCallbacksRef = useRef(new Map())

  // 稳定的 ref 回调，避免每次渲染都触发 React 的 ref 解绑/重绑
  const getRefCallback = (index) => {
    const cache = refCallbacksRef.current
    if (!cache.has(index)) {
      cache.set(index, (node) => {
        lineNodesRef.current[index] = node
      })
    }
    return cache.get(index)
  }

  const stop = useStore((s) => s.stop)
  const { activeIndex, metrics, syncFromDom, scrollToTop, scrollToBottom } = useAutoScroll({
    containerRef,
    lineNodesRef,
    lines,
    fontSize,
  })

  /** 接收「跳到顶部 / 底部」命令 */
  useEffect(
    () =>
      registerScrollHandler((command) => {
        if (command === 'top') scrollToTop()
        else if (command === 'bottom') scrollToBottom()
      }),
    [scrollToTop, scrollToBottom],
  )

  /** 滚轮手动滚动 → 暂停自动播放 */
  const handleWheel = useCallback(() => {
    stop()
    syncFromDom()
  }, [stop, syncFromDom])

  const band = metrics[activeIndex]

  return (
    <div className="absolute inset-0 z-0">
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="scroll-hidden h-full w-full overflow-y-auto overscroll-contain"
      >
        <div
          className="relative mx-auto w-full max-w-[920px] px-6 pt-32 pb-64"
          style={{
            fontSize: `${fontSize}px`,
            transform: mirrored ? 'scaleX(-1)' : 'none',
            transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* 当前朗读行的柔光高亮带 */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-4 rounded-2xl"
            initial={false}
            animate={{
              y: band ? band.top : 0,
              height: band ? band.height : 0,
              opacity: band ? 1 : 0,
            }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
            style={{
              background:
                'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.075) 22%, rgba(255,255,255,0.075) 78%, rgba(255,255,255,0) 100%)',
              willChange: 'transform, height',
            }}
          />

          {lines.map((line, index) => (
            <div key={index} data-line={index} ref={getRefCallback(index)}>
              <Line
                text={line}
                opacity={lineOpacity(index, activeIndex)}
                isActive={index === activeIndex}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 上下渐隐，让文字自然地淡入淡出到黑色背景 */}
      <div className="pointer-events-none absolute inset-x-0 top-11 z-10 h-28 bg-gradient-to-b from-black/85 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-64 bg-gradient-to-t from-black/90 to-transparent" />
    </div>
  )
}
