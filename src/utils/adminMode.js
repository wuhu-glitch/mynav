/**
 * adminMode —— 只读模式 / 管理员模式的判定
 *
 * 为什么需要它：
 *   这是纯静态站，任何人打开都能看到「编辑链接」的入口。虽然改动只落在
 *   访客自己的 localStorage、不会影响线上数据，但对外看起来「谁都能改」，
 *   体验不好。默认把访客当只读用户，只有站点主人在 URL 上带 `?admin=1`
 *   访问一次后，才会显示编辑入口。
 *
 * 规则：
 *   - `?admin=1`（也接受 true / yes）：开启管理员，并记住到 localStorage
 *   - `?admin=0`（也接受 false / no）：关闭管理员，并清掉记住的标记
 *   - 不带参数：沿用上次记住的状态；默认 false（只读）
 *
 * 两个导出：
 *   resolveAdmin()   纯函数，不碰 window / localStorage，方便单测
 *   bootstrapAdmin() 浏览器里用，负责读写 localStorage 并清理地址栏参数
 */

export const ADMIN_STORAGE_KEY = 'mynav-admin'
export const ADMIN_QUERY_KEY = 'admin'

/**
 * 判定是否为管理员。
 * @param {string} search 查询串，例如 '?admin=1' 或 window.location.search
 * @param {boolean} stored 之前记住的管理员状态
 * @returns {{ admin: boolean, explicit: boolean }} explicit=true 表示 URL 里明确写了开关
 */
export function resolveAdmin(search, stored = false) {
  const params = new URLSearchParams(search || '')

  // 参数名大小写不敏感：?Admin=1、?ADMIN=1 也认（常见手误）
  let raw = ''
  for (const [key, value] of params.entries()) {
    if (key.toLowerCase() === ADMIN_QUERY_KEY) {
      raw = value.trim().toLowerCase()
      break
    }
  }

  if (raw === '1' || raw === 'true' || raw === 'yes') {
    return { admin: true, explicit: true }
  }
  if (raw === '0' || raw === 'false' || raw === 'no') {
    return { admin: false, explicit: true }
  }
  return { admin: stored === true, explicit: false }
}

/**
 * 浏览器入口：读取地址栏与 localStorage，必要时写回并清掉 URL 参数。
 * 清理参数是为了「分享出去的链接不带管理员开关」。
 * @returns {boolean} 当前是否管理员
 */
export function bootstrapAdmin() {
  let stored = false
  try {
    stored = window.localStorage.getItem(ADMIN_STORAGE_KEY) === '1'
  } catch {
    // 隐私模式禁用 localStorage 时按只读处理
  }

  const { admin, explicit } = resolveAdmin(window.location.search, stored)

  if (explicit) {
    try {
      if (admin) window.localStorage.setItem(ADMIN_STORAGE_KEY, '1')
      else window.localStorage.removeItem(ADMIN_STORAGE_KEY)
    } catch {}

    const url = new URL(window.location.href)
    url.searchParams.delete(ADMIN_QUERY_KEY)
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  return admin
}

/** 只读模式下的说明文案（头部按钮、设置面板都用它，避免两处写岔） */
export const READONLY_TIP = '本站为只读导航：可以直接点开链接，内容不可修改'
