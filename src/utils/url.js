/**
 * url.js —— URL 安全工具（全站唯一入口）
 *
 * 为什么单独抽一个文件：
 *   同一个规则被三处用到（卡片跳转、搜索框跳转、编辑弹窗保存、备份导入校验），
 *   各写一份必然写岔。这里是纯函数，不碰 DOM，方便单测。
 *
 * 核心策略：**只放行 http(s)**。
 *   javascript: / data: / vbscript: / file: / blob: 一律不当作可跳转链接，
 *   否则 nav.json 或导入的备份就能让一次点击执行任意脚本。
 */

/** 允许出现在 CSS url() 里的图片类型（自定义背景图用） */
const DATA_IMAGE_RE = /^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i

/**
 * 是否为可安全跳转的链接：仅 http / https。
 * @param {unknown} url
 * @returns {boolean}
 */
export function isSafeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 规范化用户输入的链接：
 *   - 省略协议时补 https://（用户常直接写 github.com）
 *   - 补完之后仍然不安全的（javascript: 等）返回空串，交由调用方拒绝
 * @param {unknown} raw
 * @returns {string} 安全可用的绝对 URL；不安全返回 ''
 */
export function normalizeUrl(raw) {
  if (typeof raw !== 'string') return ''
  const text = raw.trim()
  if (!text) return ''

  // 已经带了协议（http:, javascript:, mailto: …）就按原样校验，不瞎补前缀
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(text)
  const candidate = hasScheme ? text : `https://${text}`

  return isSafeUrl(candidate) ? candidate : ''
}

/**
 * 是否可以作为 CSS 背景图使用（http/https 或内联图片）。
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSafeImageSource(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  const text = value.trim()
  return isSafeUrl(text) || DATA_IMAGE_RE.test(text)
}

/**
 * 把值转成可以安全拼进 `url("...")` 的字符串。
 *
 * 直接 `url(${用户输入})` 是有注入面的：输入里带 `");` 就能闭合当前声明、
 * 塞进任意 CSS 规则。这里做两件事：
 *   1. 白名单过滤来源（http(s) / data:image）
 *   2. 对会破坏 url() 语法的字符做百分号编码
 * @param {unknown} value
 * @returns {string} 形如 `url("https://...")`；不可用时返回 ''
 */
export function toSafeCssUrl(value) {
  if (!isSafeImageSource(value)) return ''
  const escaped = value
    .trim()
    .replace(/["'()\\\s]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
  return `url("${escaped}")`
}
