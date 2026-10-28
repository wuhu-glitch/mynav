/**
 * adminMode —— 管理员身份的**服务端**判定（前端侧调用封装）
 *
 * 为什么从 localStorage 换成服务端：
 *   以前的 `?admin=1` 只是本地开关 —— 谁在地址栏加个参数都能给自己打开编辑入口，
 *   虽然改动只落在访客自己的 localStorage，但"看起来谁都能改站点"本身就是误解。
 *   现在身份由 Cloudflare Pages Functions 判定：
 *     POST /api/auth     校验口令 → 下发 HttpOnly 会话 Cookie（前端读不到）
 *     GET  /api/session  询问"我这个 Cookie 是不是管理员"
 *     POST /api/logout   清掉会话
 *
 * 前端只保存"有没有管理员身份"这个**结果**，不保存任何凭据；
 * 刷新页面靠 Cookie 自动重新判定，用户不需要重新登录（12 小时内）。
 *
 * 纯函数（wantsAdminLogin / stripAdminParam）单独导出，方便单测不依赖网络。
 */

export const ADMIN_QUERY_KEY = 'admin'
export const SESSION_ENDPOINT = '/api/session'
export const AUTH_ENDPOINT = '/api/auth'
export const LOGOUT_ENDPOINT = '/api/logout'

/** 只读模式说明文案（多处复用，避免写岔） */
export const READONLY_TIP = '本站为只读导航：可直接点开链接；管理员登录后才显示编辑入口'

/** 服务端未配置鉴权时按钮上的提示 */
export const LOGIN_DISABLED_TIP = '本站未启用服务端鉴权，编辑入口已关闭'

/**
 * 地址栏是否在请求"打开管理员登录框"。
 * 只认 `?admin=1` / `?admin=true` / `?admin=yes`（大小写不敏感），
 * 且**不再**因为参数存在就把人当管理员 —— 它只是一次"请给我登录框"的示意。
 * @param {string} search 例如 window.location.search
 */
export function wantsAdminLogin(search) {
  const params = new URLSearchParams(search || '')
  for (const [key, value] of params.entries()) {
    if (key.toLowerCase() !== ADMIN_QUERY_KEY) continue
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
  }
  return false
}

/**
 * 去掉地址栏里的 admin 参数，保留其余参数与 hash。
 * 登录框打开后立刻清理，避免「分享出去的链接带着管理员参数」。
 * @param {string} href 完整地址
 * @returns {string} 可直接交给 history.replaceState 的相对地址
 */
export function stripAdminParam(href) {
  const url = new URL(href)
  for (const key of Array.from(url.searchParams.keys())) {
    if (key.toLowerCase() === ADMIN_QUERY_KEY) url.searchParams.delete(key)
  }
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * 询问服务端当前会话身份。
 * 网络失败 / 端点不存在（纯静态部署、没启用 Functions）时按只读处理，
 * 并标记 reachable=false，前端据此提示"鉴权不可用"而不是反复弹登录框。
 * @param {typeof fetch} fetcher
 */
export async function fetchAdminSession(fetcher = globalThis.fetch) {
  try {
    const response = await fetcher(SESSION_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) return { admin: false, configured: false, reachable: false }
    const data = await response.json()
    return {
      admin: data?.admin === true,
      configured: data?.configured === true,
      reachable: true
    }
  } catch {
    return { admin: false, configured: false, reachable: false }
  }
}

/**
 * 提交口令换会话。
 * @param {string} password
 * @param {typeof fetch} fetcher
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function loginAdmin(password, fetcher = globalThis.fetch) {
  try {
    const response = await fetcher(AUTH_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password: String(password ?? '') })
    })
    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    if (response.ok && data?.ok === true) return { ok: true }
    return { ok: false, reason: data?.error || `http_${response.status}` }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/**
 * 退出登录（幂等，没登录也能调用）。
 * @param {typeof fetch} fetcher
 */
export async function logoutAdmin(fetcher = globalThis.fetch) {
  try {
    await fetcher(LOGOUT_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    })
    return { ok: true }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/** 登录失败原因 → 给用户看的中文文案 */
export function describeLoginError(reason) {
  switch (reason) {
    case 'invalid_credentials':
      return '口令不正确'
    case 'not_configured':
      return '服务端未配置管理员口令，请联系站点所有者'
    case 'bad_request':
    case 'bad_content_type':
      return '请求格式错误，请刷新后重试'
    case 'network':
      return '无法连接鉴权服务（离线或未启用 Pages Functions）'
    // 静态托管（没有 Functions）时常见：SPA 回退把 /api/auth 也返回成 index.html
    case 'http_200':
      return '鉴权接口未启用（返回的不是接口数据），请确认部署时启用了 Pages Functions'
    case 'http_404':
    case 'http_405':
      return '鉴权接口不可用，请确认部署时已启用 Functions'
    default:
      if (typeof reason === 'string' && reason.startsWith('http_')) {
        return `鉴权接口返回异常（${reason.slice(5)}）`
      }
      return reason ? `登录失败：${reason}` : '登录失败，请稍后重试'
  }
}
