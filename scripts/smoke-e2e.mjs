/**
 * smoke-e2e.mjs —— 构建产物冒烟测试（可选，需要本机有 Edge/Chrome）
 *
 * 为什么需要它：
 *   设置面板与编辑弹窗被拆成异步 chunk，这类改动最容易「构建通过、点开白屏」。
 *   这个脚本用无头浏览器打开 dist，依次点击「设置」和「编辑模式 → 新增链接」，
 *   断言面板/弹窗真的渲染出来了。
 *
 * 用法：
 *   npm run build
 *   npm run smoke            # 默认找 Edge（Windows），可用 EDGE_PATH 指定其它浏览器
 *
 * 说明：它只是本地自检，不进入 `npm test`，也不需要联网。
 */
import { createServer } from 'node:http'
import { readFile, mkdtemp, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const PORT = 4173
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
}

// 浏览器可执行文件：优先环境变量，其次 Windows 上常见的 Edge 安装位置
const CANDIDATES = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean)

async function findBrowser() {
  for (const candidate of CANDIDATES) {
    try {
      await access(candidate)
      return candidate
    } catch {}
  }
  throw new Error('没找到 Edge/Chrome，可用 EDGE_PATH 指定浏览器路径')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 极简静态服务：未知路径回落 index.html，模拟 Cloudflare Pages 的 SPA 规则
const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0])
  const file = join(DIST, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''))
  try {
    const data = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    const html = await readFile(join(DIST, 'index.html'))
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  }
})

async function main() {
  const browserPath = await findBrowser()
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve))

  const profile = await mkdtemp(join(tmpdir(), 'mynav-smoke-'))
  // 端口写 0 让浏览器自己挑，真实端口记录在 profile 的 DevToolsActivePort 里
  const browser = spawn(browserPath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0',
    `http://127.0.0.1:${PORT}/`
  ], { stdio: 'ignore' })

  let devtoolsPort = 0
  for (let i = 0; i < 60 && !devtoolsPort; i++) {
    try {
      const [line] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')
      devtoolsPort = Number(line.trim())
    } catch {}
    if (!devtoolsPort) await sleep(250)
  }
  if (!devtoolsPort) throw new Error('浏览器没有写出 DevToolsActivePort')

  let page = null
  for (let i = 0; i < 40 && !page; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`)).json()
      page = list.find((t) => t.type === 'page' && t.url.includes(`:${PORT}`))
    } catch {}
    if (!page) await sleep(250)
  }
  if (!page) throw new Error('找不到可调试的页面')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve) => (ws.onopen = resolve))

  let seq = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    pending.get(msg.id)?.(msg)
    pending.delete(msg.id)
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++seq
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails))
    return res.result?.result?.value
  }

  await send('Runtime.enable')
  await sleep(2200)

  const initial = await evaluate(`({
    cards: document.querySelectorAll('.mynav-link-card').length,
    icons: document.querySelectorAll('svg').length,
    panelMounted: !!document.querySelector('.mynav-settings-panel')
  })`)

  const panel = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.title === '设置')
    if (!btn) return { ok: false, reason: '找不到设置按钮' }
    btn.click()
    await new Promise((r) => setTimeout(r, 1500))
    const el = document.querySelector('.mynav-settings-panel')
    if (el) el.querySelector('.panel-close')?.click()
    await new Promise((r) => setTimeout(r, 300))
    return { ok: !!el, closed: !document.querySelector('.mynav-settings-panel') }
  })()`)

  const modal = await evaluate(`(async () => {
    const editBtn = [...document.querySelectorAll('button')].find((b) => b.title === '进入编辑模式')
    if (!editBtn) return { ok: false, reason: '找不到编辑模式开关' }
    editBtn.click()
    await new Promise((r) => setTimeout(r, 500))
    const addBtn = [...document.querySelectorAll('button')].find((b) => b.title === '新增链接')
    if (!addBtn) return { ok: false, reason: '找不到新增按钮' }
    addBtn.click()
    await new Promise((r) => setTimeout(r, 1600))
    const el = document.querySelector('.mynav-edit-modal')
    return {
      ok: !!el && getComputedStyle(el).display !== 'none',
      fields: el ? el.querySelectorAll('input, select, textarea').length : 0
    }
  })()`)

  const result = { initial, panel, modal }
  console.log(JSON.stringify(result, null, 2))

  ws.close()
  browser.kill()
  server.close()
  await rm(profile, { recursive: true, force: true }).catch(() => {})

  const passed = initial.cards > 0 && panel.ok && modal.ok && modal.fields > 0
  process.exit(passed ? 0 : 1)
}

main().catch((error) => {
  console.error('[smoke] 失败：', error.message)
  server.close()
  process.exit(1)
})
