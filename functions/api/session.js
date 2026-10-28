/**
 * GET /api/session —— 查询当前会话是否具备管理员身份
 *
 * 返回：{ admin: boolean, configured: boolean }
 *   configured=false 表示服务端还没准备好鉴权（会话密钥或管理员口令缺失），
 *   前端应显示「本站未启用服务端鉴权」而不是弹出一个必然失败的登录框。
 *
 * 注意（踩过的坑）：
 *   「配好没配好」不能只看环境变量。口令哈希的首选存放位置是 KV 的 auth:password，
 *   MYNAV_ADMIN_PASSWORD 只是旧部署的迁移兜底。早期这里只检查环境变量，
 *   导致「口令已写进 KV」的部署仍报告 configured=false、登录按钮直接拒绝弹框。
 *   现在两处任一命中即视为已配置。
 *
 * 只读接口，不做任何副作用；令牌无效时也不清 Cookie（交给 /api/logout 或自然过期）。
 */
import { jsonResponse } from '../_lib/auth.js'
import { readCookie, verifySessionToken } from '../_lib/session.js'
import { readJson, KEYS } from '../_lib/navstore.js'
import { isPasswordHashFormat } from '../_lib/password.js'

export async function onRequestGet({ request, env }) {
  const secret = env?.MYNAV_SESSION_SECRET || ''
  const kv = env?.MYNAV_KV || null
  const envPassword = env?.MYNAV_ADMIN_PASSWORD || ''

  // 口令来源二选一：KV 里的哈希（推荐）或环境变量明文（旧部署）
  let hasPassword = envPassword.length >= 8
  if (!hasPassword && kv) {
    const stored = await readJson(kv, KEYS.password)
    hasPassword = Boolean(stored && isPasswordHashFormat(stored.hash))
  }

  const configured = secret.length >= 16 && hasPassword

  if (!configured) {
    return jsonResponse({ admin: false, configured: false }, 200)
  }

  const token = readCookie(request.headers.get('Cookie'))
  const result = await verifySessionToken(token, secret)

  return jsonResponse({ admin: result.valid === true, configured: true }, 200)
}

export async function onRequest() {
  return jsonResponse({ admin: false, configured: false, error: 'method_not_allowed' }, 405, {
    Allow: 'GET'
  })
}
