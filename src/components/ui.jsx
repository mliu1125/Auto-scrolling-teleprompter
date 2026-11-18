import { motion } from 'framer-motion'

/** 通用图标按钮：细腻的 hover 缩放反馈（scale 0.95） */
export function IconButton({
  icon: Icon,
  label,
  active = false,
  onClick,
  size = 'md',
  disabled = false,
  className = '',
}) {
  const box = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16

  return (
    <motion.button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 0.95 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 460, damping: 26 }}
      className={[
        'grid place-items-center rounded-xl transition-colors duration-200',
        box,
        active
          ? 'bg-accent text-white shadow-[0_6px_18px_rgba(10,132,255,0.38)]'
          : 'text-white/65 hover:bg-white/10 hover:text-white',
        disabled ? 'pointer-events-none opacity-35' : '',
        className,
      ].join(' ')}
    >
      <Icon size={iconSize} strokeWidth={1.8} />
    </motion.button>
  )
}

/** 分隔线 */
export function Divider({ className = '' }) {
  return <div className={`h-6 w-px bg-white/12 ${className}`} />
}

/** 玻璃质感容器 */
export function GlassPanel({ children, className = '' }) {
  return (
    <div
      className={[
        'rounded-2xl border border-white/12 bg-white/[0.07] backdrop-blur-2xl',
        'shadow-[0_18px_50px_rgba(0,0,0,0.55)]',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}
