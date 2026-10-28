/**
 * 会话令牌（Sign-in Session Token）—— 纯 Web Crypto 实现
 *
 * 为什么不用 JWT 库：Worker 运行时不值得为此引依赖，格式自己定死更好审。
 * 令牌结构：`v1.<payload 的 base64url>.<HMAC-SHA256 签名 base64url>`
 *   payload = { sub: 'admin', iat: 签发秒, exp: 过期秒 }
 *
 * 安全属性：
 *   - 签名密钥只存在于 Worker 环境变量（MYNAV_SESSION_SECRET），前端拿不到；
 *   - 令牌放在 HttpOnly + Secure + SameSite=Strict 的 Cookie 里，
 *     页面脚本读不到，XSS 也偷不走；
 *   - 验签用常量时间比较，避免按字节猜签名；
 *   - 先验签再解析 payload，伪造的 payload 不会进入 JSON.parse。
 *
 * 本文件刻意只依赖 Web 标准 API（crypto.subtle / btoa / atob），
 * 这样 Worker 里能跑，Node 24（单测）里也能跑。
 */

export const COOKIE_NAME = 'mynav_admin'
export const TOKEN_VERSION = 'v1'
export const SESSION_TTL_SECONDS = 12 * 60 * 60 // 12 小时

const encoder = new TextEncoder()

/** 字节数组 → base64url（去掉 padding，URL 安全） */
export function toBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** base64url → 字节数组 */
export function fromBase64Url(text) {
  const normalized = String(text).replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * 常量时间字符串比较。
 * 无论从第几个字符开始不同，耗时都一样，避免通过响应时间逐位猜签名。
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const maxLength = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

/** 用密钥对 payload 段做 HMAC-SHA256，返回 base64url 签名 */
async function signPayload(secret, payloadBase64Url) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64Url))
  return toBase64Url(new Uint8Array(signature))
}

/**
 * 签发会话令牌。
 * @param {string} secret 会话密钥（环境变量 MYNAV_SESSION_SECRET）
 * @param {number} nowMs 当前时间戳，便于单测注入
 */
export async function createSessionToken(secret, nowMs = Date.now()) {
  if (!secret) throw new Error('缺少会话密钥')
  const issuedAt = Math.floor(nowMs / 1000)
  const payload = { sub: 'admin', iat: issuedAt, exp: issuedAt + SESSION_TTL_SECONDS }
  const payloadBase64Url = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const signature = await signPayload(secret, payloadBase64Url)
  return `${TOKEN_VERSION}.${payloadBase64Url}.${signature}`
}

/**
 * 校验会话令牌。
 * @returns {{ valid: boolean, reason?: string, payload?: object }}
 */
export async function verifySessionToken(token, secret, nowMs = Date.now()) {
  if (!secret) return { valid: false, reason: 'no_secret' }
  if (typeof token !== 'string' || token.length === 0) return { valid: false, reason: 'missing' }

  const parts = token.split('.')
  if (parts.length !== 3) return { valid: false, reason: 'malformed' }

  const [version, payloadBase64Url, signature] = parts
  if (version !== TOKEN_VERSION) return { valid: false, reason: 'version' }

  // 先验签：签名不对就不解析 payload
  const expected = await signPayload(secret, payloadBase64Url)
  if (!timingSafeEqual(expected, signature)) return { valid: false, reason: 'signature' }

  let payload
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadBase64Url)))
  } catch {
    return { valid: false, reason: 'payload' }
  }

  if (!payload || typeof payload.exp !== 'number') return { valid: false, reason: 'payload' }
  if (payload.exp <= Math.floor(nowMs / 1000)) return { valid: false, reason: 'expired' }
  if (payload.sub !== 'admin') return { valid: false, reason: 'subject' }

  return { valid: true, payload }
}

/** 从 Cookie 请求头里取某个键的值 */
export function readCookie(cookieHeader, name = COOKIE_NAME) {
  if (typeof cookieHeader !== 'string' || !cookieHeader) return ''
  for (const pair of cookieHeader.split(';')) {
    const index = pair.indexOf('=')
    if (index === -1) continue
    if (pair.slice(0, index).trim() === name) return pair.slice(index + 1).trim()
  }
  return ''
}

/**
 * 下发会话 Cookie。
 * HttpOnly：脚本读不到；Secure：只走 HTTPS；SameSite=Strict：跨站请求一律不带。
 */
export function buildSessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
}

/** 清除会话 Cookie（退出登录） */
export function buildClearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
}
