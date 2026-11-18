# 提词器 · Prompter

一个 Apple 风格的 Windows 桌面提词器。`Electron + React + Vite + Tailwind CSS v4 + Framer Motion + lucide-react`，最终打包为独立 `.exe`。

---

## 1. 快速开始

```bash
npm install          # 安装依赖
npm run dev          # 启动开发环境（Vite + Electron）
npm run build        # 仅构建渲染层 → dist/
npm run dist         # 打包 Windows 安装包 + 免安装版 → release/
```

> 国内网络请保留项目根目录的 `.npmrc`，其中已配置 Electron / electron-builder 的国内镜像，
> 否则 `electron` 的二进制会卡在 GitHub 直连上（实测下载 0 字节）。

---

## 2. 目录结构

```
提词器-workbuddy/
├── electron/
│   ├── main.js               # 主进程：窗口、全局快捷键、IPC、文件读写
│   └── preload.js            # 预加载：contextBridge 安全桥接
├── src/
│   ├── main.jsx              # React 入口
│   ├── App.jsx               # 组合根：快捷键订阅、拖拽载入、Toast
│   ├── store.js              # zustand 全局状态 + 持久化 + 滚动命令总线
│   ├── index.css             # Tailwind v4 主题、玻璃拟态、速度滑块样式
│   ├── hooks/
│   │   ├── useAutoScroll.js   # ★ 滚动内核：rAF 循环 / 缓动 / 行高亮定位
│   │   └── useIdleChrome.js   # 鼠标静止 2s 自动隐藏界面
│   └── components/
│       ├── TitleBar.jsx       # 顶部玻璃控制栏（置顶 / 标题 / 最小化 / 关闭）
│       ├── PrompterStage.jsx  # 核心阅读区（当前行高亮 + 渐变透明）
│       ├── ControlDock.jsx    # 底部悬浮控制台
│       ├── ScriptDrawer.jsx   # 脚本编辑抽屉
│       └── ui.jsx             # IconButton / Divider / GlassPanel
├── build/icon.ico            # 应用图标（由 scripts/make_icon.py 生成）
├── scripts/
│   ├── dev-electron.cjs       # 开发启动包装器（剥离 ELECTRON_RUN_AS_NODE）
│   └── make_icon.py           # 图标生成脚本（Pillow）
├── electron-builder.yml      # 打包配置
├── vite.config.js
└── index.html
```

---

## 3. 架构：三个进程各司其职

```
┌────────────────── 主进程 (main.js) ──────────────────┐
│  BrowserWindow(frame:false)  全局快捷键  文件对话框  置顶  │
└───────────────┬──────────────────────────────────────┘
                │ contextBridge（白名单 IPC）
┌───────────────▼──────────────┐      ┌──────────────────────┐
│      preload.js              │      │  渲染进程 (React)     │
│  exposeInMainWorld('prompter')│─────▶│  store / hooks / UI   │
└──────────────────────────────┘      └──────────────────────┘
```

主进程只做「系统能力」，不碰业务；渲染进程只做「界面」，不碰 Node API。
两者之间只有 preload 白名单里的 `invoke` / `on` 通道，杜绝 `nodeIntegration` 风险。

### IPC 通道清单

| 通道 | 方向 | 说明 |
| --- | --- | --- |
| `window:minimize` / `window:close` / `window:toggle-maximize` | invoke | 窗口控制 |
| `window:set-always-on-top` | invoke | 窗口置顶 |
| `window:set-fullscreen` | invoke | 全屏 |
| `window:set-content-protection` | invoke | 防录屏开关（录屏时窗口被排除） |
| `script:open` | invoke | 打开文件对话框（主进程读文件 → `script:opened` 回传） |
| `script:read` | invoke | 读取指定路径文本 |
| `clipboard:read-text` | invoke | 读取剪贴板 |
| `app:info` | invoke | 版本信息 |
| `shortcut:*` | on | 全局快捷键事件（见下表） |
| `script:opened` | on | 脚本加载完成 |

---

## 4. 快捷键

全局快捷键通过 Electron `globalShortcut` 注册，**应用未聚焦时也生效**。
渲染层同时保留一份键位监听作为兜底（当快捷键被其他软件抢占时仍可用），
并用 250ms 时间窗去重，避免主进程与渲染层重复响应。

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Space` | 播放 / 暂停 |
| `Ctrl + ↑` / `Ctrl + ↓` | 加速 / 减速 |
| `Ctrl + =` / `Ctrl + -` | 增大 / 减小字号 |
| `Ctrl + M` | 镜像翻转（分光镜提词） |
| `Ctrl + O` | 打开脚本文件 |
| `Ctrl + Shift + F` | 全屏 |
| `Ctrl + Shift + P` | 窗口置顶开关 |
| `Ctrl + Home` / `Ctrl + End` | 跳到开头 / 结尾 |
| `空格`（焦点不在输入框时） | 播放 / 暂停 |
| 鼠标滚轮 | 手动上下滚动（自动暂停） |

> ⚠️ Electron 的 accelerator **不接受** `Plus` / `Minus` / `Equal` 这类名字，
> 键盘符号必须写成单字符形式（`CmdOrControl+=`、`CmdOrControl+-`），否则注册时会抛
> `conversion failure` 并中断整个注册流程。

---

## 5. 关键实现

### 5.1 滚动内核（`src/hooks/useAutoScroll.js`）

整个提词滚动由**单一 `requestAnimationFrame` 循环**驱动，没有 `setInterval`，没有 `scroll-behavior: smooth`：

```
目标位置 target  ──每帧累加 speed × dt──▶  目标
     │                                        │
     └──── 指数缓动逼近 ────▶ 实际位置 current ──▶ el.scrollTop
```

* **目标 / 实际分离**：变速、起播时不会出现瞬移，缓动系数 `min(1, dt × 10)`（时间常数约 100ms）。
* **行度量缓存**：每行 `offsetTop / offsetHeight` 只在「脚本变化 / 字号变化 / 窗口缩放」时重算，
  用 `ResizeObserver` 兜底；行高亮通过**二分查找**定位，O(log n)。
* **字号变化锚定**：改字号后重新度量，并把当前朗读行重新拉回阅读线（屏幕上方 34% 处），阅读位置不漂。
* **手动滚动不打架**：滚轮事件先同步 `playing=false`（zustand 订阅是同步的），
  循环进入「以 DOM 为准」分支，不再回写 `scrollTop`。

### 5.2 高亮与渐变透明

当前朗读行 `opacity: 1`（纯白 + 柔光 `text-shadow`），**未读 0.40**，已读随距离递减到 0.26。
行元素用 `React.memo` 包裹，每次只有高亮行附近几行的 props 变化，长脚本（数百行）依然稳定 60fps。

DOM 实测值（13 行示例脚本，播放中）：

```
#2 已读  opacity=0.30     #4 当前行 opacity=1.00
#3 已读  opacity=0.32     #5 未读  opacity=0.40
                          #6 未读  opacity=0.38   #7 未读 opacity=0.36
```

### 5.3 无边框 + 毛玻璃

* 窗口 `frame: false` + `backgroundColor: '#000000'`，纯黑底、纯白字。
* 顶栏与底部控制台用 `backdrop-blur` 毛玻璃，元素 `position: absolute` 浮在阅读区之上，
  被模糊的正是**正在滚动的正文**，玻璃质感随内容实时变化。
* 可拖拽区：`-webkit-app-region: drag` 铺满顶栏，按钮逐个标 `no-drag`。
* 想用 Windows 11 系统级亚克力，把 `electron/main.js` 里的 `USE_SYSTEM_ACRYLIC` 改成 `true` 即可
  （会启用 `backgroundMaterial: 'acrylic'`，但整体兼容性略差）。

### 5.4 沉浸式隐藏

`useIdleChrome` 监听 `mousemove`，静止 2s 后顶栏与控制台淡出（Framer Motion 位移 + 透明度）。
指针停留在控件上时不隐藏（靠 `event.target.closest('[data-chrome]')` 判定），
避免调节参数时控件「跑了」。

### 5.5 脚本文件

* 支持 `.txt / .md`，**自动识别 UTF-8 与 GBK**（读到 `U+FFFD` 替换字符时回退 GBK 解码），中文不乱码。
* 拖拽 `.txt` 到窗口即可直接载入；也可用「打开文件」按钮或 `Ctrl + O`。
* 脚本、字号、速度、镜像状态写入 `localStorage`，下次启动自动恢复。

---

## 6. 防录屏 + 背景透明度

### 6.1 防录屏（录制时不被录进去）

标题栏左侧的 **盾牌图标** 控制这个开关，**默认开启**。

实现：Electron 的 `contentProtection`（Windows 底层是 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`）。
开启后，基于 DWM / Windows Graphics Capture 的录制与截图会**直接跳过这个窗口**：

* OBS、Streamlabs、Teams、Zoom 的「共享屏幕」
* Xbox Game Bar、Win + Alt + R 屏幕录制
* 剪映 / Premiere 的「屏幕采集」

而**屏幕上的显示完全正常**，不影响你本人阅读提词内容。

几个必须知道的边界：

| 场景 | 受影响？ | 说明 |
| --- | --- | --- |
| OBS / Teams / Zoom 录屏 | ✅ 不会被录到 | 走 WGC / DWM 捕获 |
| Win + Shift + S 截图 | ✅ 截不到 | 同样走系统捕获接口 |
| 应用内部 `capturePage()` | ❌ 仍能截到 | 属于 Chromium 内部合成器抓取，不受系统显示亲和性影响 |
| 显示器直接翻拍 / 摄像头拍屏 | ❌ 仍能看到 | 物理层面无法屏蔽 |

> 如果需要给自己留一张截图（比如做教程），先把盾牌图标关掉再截。
> 盾牌关闭时会有 Toast 提示当前状态，避免「忘了自己关掉了」的尴尬。

### 6.2 背景透明度（边看稿边观察页面）

标题栏左侧的 **眼睛图标** 打开透明度浮层，滑块范围 15% ~ 100%：

* **100%（默认）**：纯黑背景 `#000000`，纯白文字，专注阅读。
* **调低**：窗口背景变为半透明，**可以直接透出下方的浏览器页面 / 操作界面**，
  一边看稿一边观察页面操作，两不误。

实现方式：主窗口 `transparent: true` + `backgroundColor: '#00000000'`，
渲染层用一层 `rgba(0, 0, 0, α)` 铺底，滑块直接改这个 α 值：

```jsx
<div style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }}>
```

顶栏 / 控制台的毛玻璃（`backdrop-blur`）在半透明模式下会模糊**桌面或下层页面**，
而不是窗内的文字，质感更接近真正的 macOS 材质层。

> 注意：背景越透明，白色文字与下层内容的对比度越低。
> 建议「边操作页面时调低，操作完调回 100%」，或者把窗口挪到屏幕另一侧。

---

## 7. 打包成 .exe

配置见 `electron-builder.yml`，产物在 `release/`：

| 产物 | 说明 |
| --- | --- |
| `Prompter-1.0.0-Setup.exe` | NSIS 安装包（可改安装目录、创建桌面快捷方式） |
| `Prompter-1.0.0-x64.exe` | Portable 免安装单文件版 |
| `Prompter-1.0.0-win-unpacked/` | 未压缩目录（便于排查问题） |

```bash
npm run dist            # 完整打包
npm run dist:dir        # 只出目录版，最快，用于验证
npm run dist:portable   # 只出免安装版
```

关键配置说明：

* `files` 只包含 `electron/**`、`dist/**`、`package.json` —— 渲染层必须先 `vite build`，
  所以 `dist` 脚本是 `vite build && electron-builder --win`。
* `base: './'`（vite.config.js）：产物用相对路径，Electron 才能通过 `file://` 正常加载。
* `asar: true`：源码打进 asar 包。
* `electronLanguages`：只保留 `zh-CN` / `en-US`，减少几十 MB 体积。
* **未做代码签名**：首次运行 Windows SmartScreen 会提示「未知发布者」，
  点「更多信息 → 仍要运行」即可。正式分发建议购买代码签名证书并在 `win` 下加
  `certificateFile` / `certificatePassword`。
* **防录屏默认开启**，因此打包后的 exe 运行时无法被 Win + Shift + S 截图，
  这是预期行为（需要截图请先关闭标题栏的盾牌图标）。

---

## 8. 常见问题

**Q：`npm run dev` 报 `Cannot read properties of undefined (reading 'isPackaged')`**
A：环境变量 `ELECTRON_RUN_AS_NODE=1` 会让 Electron 以纯 Node 模式启动。
项目已用 `scripts/dev-electron.cjs` 在 spawn 前剥离该变量；直接 `npx electron .` 则需自行清除。

**Q：安装依赖时 electron 二进制一直 0 字节**
A：GitHub 直连被阻塞。保留 `.npmrc` 中的 `electron_mirror`，或执行
`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js`。

**Q：开发模式下页面空白 / React Fast Refresh 不生效**
A：CSP 拦掉了 Vite 注入的内联脚本。`vite.config.js` 里的 `csp-script-src` 插件
会在 dev 模式自动放宽为 `script-src 'self' 'unsafe-inline'`，生产模式仍为严格 `'self'`。

**Q：打包时报 `directory rename failed ... EPERM` 或 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`**
A：electron-builder 会先把 Electron 解压到 `release\win-unpacked.tmp` 再改名，
这中间涉及大目录的改名 / 删除。若被杀毒软件或系统策略拦截（常见于含中文路径的目录），
换一个输出目录即可绕过：

```bash
npx electron-builder --win --config.directories.output=D:\build-output
```

**Q：全局快捷键按了没反应**
A：多半是被别的软件占用（QQ、微信等常占 `Ctrl+Space`）。主进程会在控制台打印
`[shortcut] 注册失败`，此时仍可用渲染层兜底键位，或在 `electron/main.js` 的
`SHORTCUTS` 数组里换成不冲突的组合键。

**Q：窗口不置顶 / 全屏无效**
A：无边框窗口的置顶由主进程 `setAlwaysOnTop` 实现；若被其他置顶窗口压住，
可改用 `screen-saver` 层级（当前已用）。

---

## 9. 设计取舍说明

* **文本左对齐、文本块整体居中**：Apple HIG 强调内容可读性与稳定的视觉锚点。
  提词场景下视线需要反复回到同一行首，因此**行内左对齐**比居中对齐更利于跟读；
  但整个文本列通过 `max-w-[920px] + mx-auto` 在屏幕上居中，符合「居中显示提词文本」的要求。
* **未读 0.40 / 已读 0.26~0.34**：已读内容略微更淡，形成「阅读过的痕迹」，
  但保留足够对比度以便回看。
* **顶部渐隐遮罩**：正文在顶栏 / 控制台附近做黑色渐隐，
  让文字自然消失在纯黑背景里，同时保证毛玻璃后面仍有内容可供模糊。
