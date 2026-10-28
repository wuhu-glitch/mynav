/**
 * 口令比较 —— 常量时间，且不泄露长度
 *
 * 做法：两边都先做 SHA-256，得到等长（43 字符 base64url）的摘要，
 * 再对摘要做常量时间比较。这样：
 *   - 不会因为「前缀相同」提前返回而泄露信息；
 *   - 不会因为密码长度不同而泄露长度；
 *   - 环境变量里存的是明文密码，但比较过程不会把它拼进字符串做 ===。
 */
import { timingSafeEqual, toBase64Url } from './session.js'

const encoder = new TextEncoder()

/**
 * 把任意字符串折成固定长度摘要。
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function digestText(text) {
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(text))
  return toBase64Url(new Uint8Array(buffer))
}

/**
 * 比较用户输入与预期口令。
 * @param {string} input 用户提交的密码
 * @param {string} expected 环境变量里的密码
 * @returns {Promise<boolean>}
 */
export async function comparePassword(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false
  if (input.length === 0 || expected.length === 0) return false
  const [inputDigest, expectedDigest] = await Promise.all([digestText(input), digestText(expected)])
  return timingSafeEqual(inputDigest, expectedDigest)
}

/**
 * 服务端配置是否完整可用。
 * 密钥太短等同于没有密钥（HMAC 密钥建议 32 字节以上随机值）。
 * @param {Record<string, string>} env
 */
export function readAuthConfig(env) {
  const password = env?.MYNAV_ADMIN_PASSWORD || ''
  const secret = env?.MYNAV_SESSION_SECRET || ''
  const configured = password.length >= 8 && secret.length >= 16
  return { password, secret, configured }
}

/** 统一的 JSON 响应（一律 no-store，避免被 CDN 缓存） */
export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  })
}

/** 拖慢暴力猜解：失败路径固定延迟（Workers 允许 setTimeout） */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
