import { useEffect, useRef, useState } from 'react'

/**
 * 鼠标静止 delay 毫秒后隐藏界面 chrome（顶栏 / 底部控制台）。
 * 指针停留在 chrome 元素上时不隐藏，避免控件在调整过程中消失。
 */
export function useIdleChrome(delay = 2000) {
  const [visible, setVisible] = useState(true)
  const timerRef = useRef(null)

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const schedule = () => {
      clear()
      timerRef.current = setTimeout(() => setVisible(false), delay)
    }

    const wake = (event) => {
      const target = event?.target
      const overChrome =
        target && typeof target.closest === 'function' && target.closest('[data-chrome]')
      setVisible(true)
      if (overChrome) {
        clear()
        return
      }
      schedule()
    }

    const onKey = () => {
      setVisible(true)
      schedule()
    }

    window.addEventListener('mousemove', wake, { passive: true })
    window.addEventListener('mousedown', wake, { passive: true })
    window.addEventListener('wheel', wake, { passive: true })
    window.addEventListener('keydown', onKey)
    schedule()

    return () => {
      clear()
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('mousedown', wake)
      window.removeEventListener('wheel', wake)
      window.removeEventListener('keydown', onKey)
    }
  }, [delay])

  return visible
}
