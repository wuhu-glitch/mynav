/**
 * build-icons.mjs —— 把「首屏会用到」的 Iconify 图标离线化
 *
 * 为什么需要它：
 *   Iconify 的 <Icon> 组件默认在浏览器里按需向 api.iconify.design 请求图标数据。
 *   首次访问、断网、或该域名被网络环境阻断时，图标会先渲染成空白方块，
 *   界面骨架（工具栏、设置面板、分类按钮）就会「缺胳膊少腿」。
 *
 * 做法：
 *   1. 扫描 src 下的代码与 public/nav.json，收集所有被硬编码引用的图标名；
 *   2. 按图标集（前缀，如 mdi）分组，向 Iconify API 拉取这些图标的矢量数据；
 *   3. 写入 src/icons/collections.json，由 src/icons/index.js 在应用启动时
 *      addCollection() 注册 —— 之后这些图标不再发起任何网络请求。
 *
 * 注意：
 *   nav.json 里用户后加的任意图标不在离线集合内，仍会走 Iconify 在线拉取，
 *   这是数据驱动的必然结果，属于「锦上添花」而非必需，因此不影响首屏可用性。
 *
 * 用法：npm run icons（新增硬编码图标后重新执行一次即可）
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'src', 'icons')
const OUT_FILE = join(OUT_DIR, 'collections.json')

// 只认这些图标集前缀，避免把 CSS 类名、伪类误当成图标
const PREFIXES = [
  'mdi', 'simple-icons', 'logos', 'tabler', 'ph', 'carbon',
  'lucide', 'material-symbols', 'fa6-solid', 'fa6-brands'
]
const ICON_RE = new RegExp(`\\b(?:${PREFIXES.join('|')}):[a-z0-9-]+`, 'g')

// 无论代码里是否出现都一定要带上的兜底图标（默认链接图标、搜索图标）
const ALWAYS = ['mdi:link-variant', 'mdi:magnify']

// 递归收集源码文件
async function collectFiles(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await collectFiles(full)))
    else if (['.vue', '.js', '.mjs'].includes(extname(entry.name))) out.push(full)
  }
  return out
}

async function main() {
  const files = await collectFiles(join(ROOT, 'src'))
  files.push(join(ROOT, 'public', 'nav.json'))

  const found = new Set(ALWAYS)
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    for (const match of text.match(ICON_RE) || []) found.add(match)
  }

  // 按前缀分组
  const groups = new Map()
  for (const name of found) {
    const [prefix, icon] = name.split(':')
    if (!groups.has(prefix)) groups.set(prefix, new Set())
    groups.get(prefix).add(icon)
  }

  const collections = []
  for (const [prefix, icons] of groups) {
    const url = `https://api.iconify.design/${prefix}.json?icons=${[...icons].join(',')}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`拉取 ${prefix} 图标失败：HTTP ${response.status}`)
    }
    const data = await response.json()
    const missing = [...icons].filter((name) => !data.icons?.[name])
    if (missing.length) {
      console.warn(`[build-icons] ${prefix} 下未找到：${missing.join(', ')}`)
    }
    collections.push({
      prefix,
      width: data.width || 24,
      height: data.height || 24,
      icons: data.icons || {}
    })
    console.log(`[build-icons] ${prefix}: ${Object.keys(data.icons || {}).length} 个图标`)
  }

  await mkdir(OUT_DIR, { recursive: true })
  const json = JSON.stringify(collections)
  await writeFile(OUT_FILE, json, 'utf8')
  console.log(`[build-icons] 写入 ${OUT_FILE}（${(Buffer.byteLength(json) / 1024).toFixed(1)} KB）`)
}

main().catch((error) => {
  console.error('[build-icons] 失败：', error.message)
  process.exit(1)
})
