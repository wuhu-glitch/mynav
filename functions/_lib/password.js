/**
 * 口令哈希 —— 只存哈希，不存明文
 *
 * 存储格式（KV 值）：`scrypt1$<salt>$<hash>`，salt 与 hash 都是 base64url。
 * 算法用 PBKDF2-SHA256（Web Crypto 自带，Worker 里可用），迭代 120000 次：
 *   - 加盐：同一个口令每次初始化得到的哈希都不同，彩虹表失效；
 *   - 迭代：单次校验约几十毫秒，爆破成本随迭代数线性上升。
 *
 * 为什么不用 scrypt/argon2：Workers 运行时只提供 PBKDF2（crypto.subtle.deriveBits），
 * 引 wasm 依赖不值得；PBKDF2 + 12 万次对「单入口、低频登录」的场景足够。
 */
import { toBase64Url, fromBase64Url, timingSafeEqual } from './session.js'

export const PASSWORD_ALGORITHM = 'pbkdf2-sha256'
export const PASSWORD_ITERATIONS = 120000
const FORMAT_PREFIX = 'scrypt1' // 格式版本标记，改名不影响兼容判断

const encoder = new TextEncoder()

/** 生成随机 salt（16 字节） */
export function randomSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

/**
 * 计算口令哈希。
 * @param {string} password 明文口令
 * @param {string} salt 盐（base64url）
 * @param {number} iterations 迭代次数
 * @returns {Promise<string>} `scrypt1$salt$hash`
 */
export async function hashPassword(password, salt, iterations = PASSWORD_ITERATIONS) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('口令不能为空')
  }
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromBase64Url(salt), iterations, hash: 'SHA-256' },
    material,
    256
  )
  return `${FORMAT_PREFIX}$${salt}$${toBase64Url(new Uint8Array(bits))}`
}

/**
 * 校验口令。
 * @param {string} password 用户输入
 * @param {string} stored 存储的哈希串
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length === 0) return false
  if (typeof stored !== 'string') return false

  const parts = stored.split('$')
  if (parts.length !== 3) return false
  const [prefix, salt, expectedHash] = parts
  if (prefix !== FORMAT_PREFIX || !salt || !expectedHash) return false

  const actual = await hashPassword(password, salt)
  const actualHash = actual.split('$')[2]
  return timingSafeEqual(actualHash, expectedHash)
}

/** 初始化用的哈希串（随机盐 + 默认迭代） */
export async function createPasswordHash(password) {
  return hashPassword(password, randomSalt())
}

/** 口令强度下限（服务端与文档共用同一个口径） */
export const MIN_PASSWORD_LENGTH = 8

/** 判断存储的口令哈希是否格式合法（用于启动自检，避免存了个坏值） */
export function isPasswordHashFormat(stored) {
  if (typeof stored !== 'string') return false
  const parts = stored.split('$')
  return parts.length === 3 && parts[0] === FORMAT_PREFIX && parts[1].length >= 16 && parts[2].length >= 32
}
