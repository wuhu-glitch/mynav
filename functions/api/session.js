/**
 * GET /api/session —— 查询当前会话是否具备管理员身份
 *
 * 返回：{ admin: boolean, configured: boolean }
 *   configured=false 表示服务端没配环境变量，前端应显示「本站未启用鉴权」而不是登录框。
 *
 * 只读接口，不做任何副作用；令牌无效时也不清 Cookie（交给 /api/logout 或自然过期）。
 */
import { readAuthConfig, jsonResponse } from '../_lib/auth.js'
import { readCookie, verifySessionToken } from '../_lib/session.js'

export async function onRequestGet({ request, env }) {
  const { secret, configured } = readAuthConfig(env)

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
