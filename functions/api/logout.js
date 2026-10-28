/**
 * POST /api/logout —— 退出管理员登录
 *
 * 直接下发一个 Max-Age=0 的同名 Cookie 覆盖掉会话。
 * 注意：这里不校验当前是否真的登录过 —— 退出操作幂等，没登录也能调用。
 */
import { jsonResponse } from '../_lib/auth.js'
import { buildClearCookie } from '../_lib/session.js'

export async function onRequestPost() {
  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': buildClearCookie() })
}

export async function onRequest() {
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' })
}
