/**
 * 管理员鉴权助手 —— 被所有「写」接口复用
 *
 * 为什么单独一层：
 *   - /api/nav(POST)、/api/versions、/api/rollback 都需要同一套判定，
 *     复制粘贴容易出现「某个接口忘了校验」的漏网之鱼；
 *   - 判定只有一条真理来源：Cookie 里的签名令牌（见 _lib/session.js）。
 */
import { readCookie, verifySessionToken } from './session.js'
import { digestText, jsonResponse } from './auth.js'

/**
 * 校验当前请求是否具备管理员身份。
 * @returns {Promise<{ ok: true, payload?: object } | { ok: false, response: Response }>}
 */
export async function requireAdmin(request, env) {
  const secret = env?.MYNAV_SESSION_SECRET || ''
  if (secret.length < 16) {
    return {
      ok: false,
      response: jsonResponse(
        { ok: false, error: 'not_configured', message: '服务端未配置 MYNAV_SESSION_SECRET' },
        503
      )
    }
  }

  const token = readCookie(request.headers.get('Cookie') || '')
  const result = await verifySessionToken(token, secret)
  if (!result.valid) {
    return {
      ok: false,
      response: jsonResponse({ ok: false, error: 'unauthorized', reason: result.reason }, 401)
    }
  }
  return { ok: true, payload: result.payload }
}

/**
 * 把客户端 IP 折成不可逆的短键，用作失败计数键。
 * 不存明文 IP：KV 里留一堆访客 IP 既无必要，也不利于隐私。
 */
export async function clientIpKey(request) {
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    ''
  if (!ip) return 'anon'
  const digest = await digestText(ip)
  return digest.slice(0, 16)
}
