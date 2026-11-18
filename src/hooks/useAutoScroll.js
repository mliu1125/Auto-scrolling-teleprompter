import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../store'

/**
 * 提词滚动内核
 *
 * · 全部滚动位移由 requestAnimationFrame 驱动，保证 60fps 丝滑
 * · 目标位置与实际位置分离，用指数缓动逼近，变速/起播不会出现跳变
 * · 行度量（每行 top/height）在内容或字号变化时重算，并二分定位当前朗读行
 */
export function useAutoScroll({
  containerRef,
  lineNodesRef,
  lines,
  fontSize,
  readingRatio = 0.34,
}) {
  const engineRef = useRef({ target: 0, current: 0, max: 0, metricsCache: [] })
  const activeRef = useRef(0)
  const [metrics, setMetrics] = useState([])

  // 立即同步播放状态与速度（zustand 订阅是同步的，能避免滚轮与自动滚动"打架"）
  useEffect(() => {
    const sync = (state, prev) => {
      const engine = engineRef.current
      engine.playing = state.playing
      engine.speed = state.speed

      // 从末尾起播 → 自动回到开头
      if (state.playing && !prev?.playing) {
        const el = containerRef.current
        if (el && engine.max > 0 && el.scrollTop >= engine.max - 1) {
          el.scrollTop = 0
          engine.current = 0
          engine.target = 0
        }
      }
    }
    sync(useStore.getState(), { playing: false })
    return useStore.subscribe(sync)
  }, [containerRef])

  /* -------------------- 度量与定位 -------------------- */

  const measure = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const nodes = lineNodesRef.current || []
    const next = []
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      if (!node || !node.isConnected) {
        next.push(null)
        continue
      }
      // 行元素位于 position:relative 的内容容器内，offsetTop 即内容内坐标
      next.push({ top: node.offsetTop, height: node.offsetHeight })
    }
    engineRef.current.metricsCache = next
    engineRef.current.max = Math.max(0, el.scrollHeight - el.clientHeight)
    setMetrics(next)
    return next
  }, [containerRef, lineNodesRef])

  /** 根据滚动位置二分查找当前朗读行 */
  const computeActive = useCallback(
    (scrollTop) => {
      const list = engineRef.current.metricsCache || []
      if (!list.length) return 0
      const el = containerRef.current
      const offset = (el?.clientHeight || 0) * readingRatio
      const target = scrollTop + offset

      let lo = 0
      let hi = list.length - 1
      let result = 0
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const m = list[mid]
        if (m && m.top <= target) {
          result = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
      return result
    },
    [readingRatio],
  )

  /* -------------------- rAF 主循环 -------------------- */

  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const tick = (now) => {
      const dt = Math.min(0.064, (now - last) / 1000)
      last = now

      const el = containerRef.current
      const engine = engineRef.current

      if (el) {
        if (engine.playing && engine.max <= 0) {
          // 内容不足一屏，没有可滚动空间
          useStore.getState().stop()
        } else if (engine.playing) {
          engine.target = Math.min(engine.max, engine.target + engine.speed * dt)
          // 指数缓动逼近目标：变速或起播时不会瞬移
          engine.current += (engine.target - engine.current) * Math.min(1, dt * 10)
          if (Math.abs(engine.target - engine.current) < 0.05) engine.current = engine.target
          el.scrollTop = engine.current

          if (engine.target >= engine.max - 0.5 && engine.current >= engine.max - 0.5) {
            useStore.getState().stop()
          }
        } else {
          // 手动滚动时以 DOM 为准，同步内部状态
          engine.current = el.scrollTop
          engine.target = el.scrollTop
        }

        const idx = computeActive(engine.current)
        if (idx !== activeRef.current) {
          activeRef.current = idx
          useStore.getState().setActiveLine(idx)
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [computeActive, containerRef])

  /* -------------------- 对外命令 -------------------- */

  /** 把指定行滚动到阅读线位置 */
  const anchorTo = useCallback(
    (index) => {
      const el = containerRef.current
      const list = engineRef.current.metricsCache || []
      const m = list[index]
      if (!el || !m) return
      const max = engineRef.current.max
      const target = Math.max(0, Math.min(max, m.top - el.clientHeight * readingRatio))
      el.scrollTop = target
      engineRef.current.current = target
      engineRef.current.target = target
    },
    [containerRef, readingRatio],
  )

  const reset = useCallback(() => {
    const el = containerRef.current
    if (el) el.scrollTop = 0
    engineRef.current.current = 0
    engineRef.current.target = 0
    activeRef.current = 0
    useStore.getState().setActiveLine(0)
  }, [containerRef])

  const scrollToTop = useCallback(() => {
    const el = containerRef.current
    if (el) el.scrollTop = 0
    engineRef.current.current = 0
    engineRef.current.target = 0
  }, [containerRef])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const max = engineRef.current.max
    el.scrollTop = max
    engineRef.current.current = max
    engineRef.current.target = max
  }, [containerRef])

  /** 手动滚动（滚轮 / 触控板）后同步内部状态 */
  const syncFromDom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    engineRef.current.current = el.scrollTop
    engineRef.current.target = el.scrollTop
  }, [containerRef])

  /* -------------------- 度量刷新时机 -------------------- */

  // 脚本文本变化 → 回到顶部重新开始
  useLayoutEffect(() => {
    measure()
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines])

  // 字号变化 → 重新度量并把当前朗读行重新锚定到阅读线，避免阅读位置漂移
  useLayoutEffect(() => {
    measure()
    anchorTo(activeRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize])

  // 窗口尺寸变化 → 重新度量并夹紧滚动位置
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => {
      const metrics = measure()
      const node = containerRef.current
      const engine = engineRef.current
      if (node && metrics) {
        node.scrollTop = Math.min(node.scrollTop, engine.max)
        engine.current = node.scrollTop
        engine.target = node.scrollTop
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, measure])

  const activeIndex = useStore((s) => s.activeLine)

  return {
    activeIndex,
    metrics,
    measure,
    anchorTo,
    reset,
    scrollToTop,
    scrollToBottom,
    syncFromDom,
  }
}
