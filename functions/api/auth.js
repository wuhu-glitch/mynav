/**
 * POST /api/auth —— 管理员登录
 *
 * 请求：{ "password": "..." }
 * 成功：204/200 + Set-Cookie（HttpOnly 会话），响应体 { ok: true, expiresIn }
 * 失败：401 { ok: false, error: 'invalid_credentials' }
 *
 * 设计要点：
 *   1. 密码只在服务端比较，前端永远拿不到「正确密码是什么」的任何提示；
 *   2. 失败路径固定延迟 300ms，降低在线暴力猜解速度（真正的限流交给
 *      Cloudflare 的 Rate Limiting 规则，见 SECURITY.md）；
 *   3. 未配置环境变量时返回 503 而不是「放行」，避免忘配就变成人人可进。
 */
import { comparePassword, readAuthConfig, jsonResponse, delay } from '../_lib/auth.js'
import { createSessionToken, buildSessionCookie, SESSION_TTL_SECONDS } from '../_lib/session.js'

export async function onRequestPost({ request, env }) {
  const { password: expected, secret, configured } = readAuthConfig(env)

  if (!configured) {
    return jsonResponse(
      {
        ok: false,
        error: 'not_configured',
        message: '服务端未配置 MYNAV_ADMIN_PASSWORD / MYNAV_SESSION_SECRET'
      },
      503
    )
  }

  const contentType = request.headers.get('Content-Type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse({ ok: false, error: 'bad_content_type' }, 415)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'bad_request' }, 400)
  }

  const submitted = typeof body?.password === 'string' ? body.password : ''

  // 无论成功失败都先等一下，让失败路径的响应时间恒定
  await delay(300)

  const matched = await comparePassword(submitted, expected)
  if (!matched) {
    return jsonResponse({ ok: false, error: 'invalid_credentials' }, 401)
  }

  const token = await createSessionToken(secret)
  return jsonResponse({ ok: true, expiresIn: SESSION_TTL_SECONDS }, 200, {
    'Set-Cookie': buildSessionCookie(token)
  })
}

/** 其他方法一律 405，不暴露任何信息 */
export async function onRequest({ request }) {
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, {
    Allow: 'POST'
  })
}
