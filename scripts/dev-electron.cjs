/**
 * Electron 开发启动包装器
 *
 * 某些终端 / CI 环境会预设 ELECTRON_RUN_AS_NODE=1，
 * 这会让 Electron 以纯 Node 模式启动（app 为 undefined）而无法渲染窗口。
 * 这里在 spawn 之前把它从子进程环境中移除。
 */
const { spawn } = require('node:child_process')
const path = require('node:path')
const electronPath = require('electron')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(
  electronPath,
  [process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..'), ...process.argv.slice(3)],
  {
    stdio: 'inherit',
    env,
  },
)

child.on('exit', (code) => process.exit(code ?? 0))

process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
