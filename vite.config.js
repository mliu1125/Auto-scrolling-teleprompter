import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 打包后由 Electron 通过 file:// 加载，必须使用相对路径
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      // 开发模式需要允许内联脚本（React Fast Refresh 的注入代码）
      name: 'csp-script-src',
      transformIndexHtml(html, ctx) {
        const scriptSrc = ctx.server ? "'self' 'unsafe-inline'" : "'self'"
        return html.replace('%CSP_SCRIPT_SRC%', scriptSrc)
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome120',
    chunkSizeWarningLimit: 1500,
  },
})
