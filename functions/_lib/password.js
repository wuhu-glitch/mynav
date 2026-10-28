/**
 * 口令哈希 —— 只存哈希，不存明文
 *
 * 存储格式（KV 值）：`scrypt2$<iterations>$<salt>$<hash>`
 *   - iterations：迭代次数，写进串里，以后调整默认值不会让旧哈希失效；
 *   - salt / hash：base64url。
 *
 * 为什么迭代上限是 100000（踩过的坑，别再踩）：
 *   Cloudflare Workers 的 WebCrypto 对 PBKDF2 有硬限制，超过 100000 次会直接抛
 *   `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported`。
 *   这个错误发生在 deriveBits 里，会让整个请求变成 500，前端只能看到「鉴权接口返回异常」。
 *   早期版本用 120000，本地 Node 跑得好好的，一上线就登录失败。现在：
 *     1. 默认值改成上限 100000；
 *     2. hashPassword 在超限时主动抛 RangeError（本地就能发现，不用等上线）；
 *     3. 旧格式 scrypt1$salt$hash 用 isLegacyHash() 识别，登录时给出「请重新生成」的明确提示，
 *        而不是含糊的「口令不正确」。
 */
import { toBase64Url, fromBase64Url, timingSafeEqual } from './session.js'

export const PASSWORD_ALGORITHM = 'pbkdf2-sha256'

/** Workers 运行时允许的最大 PBKDF2 迭代次数（硬上限，超了直接抛错） */
export const PASSWORD_MAX_ITERATIONS = 100000

/** 新哈希的默认迭代次数：取运行时上限，兼顾安全与可用 */
export const PASSWORD_ITERATIONS = PASSWORD_MAX_ITERATIONS

/** 旧格式版本标记（无迭代字段，曾用 120000 → 在 Workers 里不可用） */
const LEGACY_PREFIX = 'scrypt1'
/** 当前格式版本标记（带迭代字段） */
const FORMAT_PREFIX = 'scrypt2'

const encoder = new TextEncoder()

/** 生成随机 salt（16 字节 → base64url 22 字符） */
export function randomSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

/**
 * 计算口令哈希。
 * @param {string} password 明文口令
 * @param {string} salt 盐（base64url）
 * @param {number} iterations 迭代次数（不得超过 PASSWORD_MAX_ITERATIONS）
 * @returns {Promise<string>} `scrypt2$iterations$salt$hash`
 */
export async function hashPassword(password, salt, iterations = PASSWORD_ITERATIONS) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('口令不能为空')
  }
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > PASSWORD_MAX_ITERATIONS) {
    // 提前失败：比在线上收到 500 更容易排查
    throw new RangeError(
      `PBKDF2 迭代次数必须在 1000~${PASSWORD_MAX_ITERATIONS} 之间（当前 ${iterations}），` +
        'Workers 运行时不允许更高'
    )
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
  return `${FORMAT_PREFIX}$${iterations}$${salt}$${toBase64Url(new Uint8Array(bits))}`
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

  const parsed = parseHash(stored)
  // 旧格式（120000 次）在当前运行时无法计算，只能判定为不匹配
  if (!parsed || parsed.legacy) return false

  const actual = await hashPassword(password, parsed.salt, parsed.iterations)
  const actualHash = actual.split('$')[3]
  return timingSafeEqual(actualHash, parsed.hash)
}

/**
 * 解析哈希串。旧格式返回 { legacy: true }，格式不对返回 null。
 * @param {string} stored
 */
export function parseHash(stored) {
  if (typeof stored !== 'string') return null
  const parts = stored.split('$')

  if (parts.length === 3 && parts[0] === LEGACY_PREFIX) {
    return { legacy: true, salt: parts[1], hash: parts[2], iterations: 120000 }
  }

  if (parts.length === 4 && parts[0] === FORMAT_PREFIX) {
    const iterations = Number(parts[1])
    if (!Number.isInteger(iterations)) return null
    return { legacy: false, iterations, salt: parts[2], hash: parts[3] }
  }

  return null
}

/** 初始化用的哈希串（随机盐 + 默认迭代） */
export async function createPasswordHash(password) {
  return hashPassword(password, randomSalt())
}

/** 口令强度下限（服务端与文档共用同一个口径） */
export const MIN_PASSWORD_LENGTH = 8

/**
 * 是否为「格式合法但当前运行时算不动」的旧哈希。
 * 登录接口据此给出「请重新生成」的提示，而不是「口令不正确」。
 * @param {string} stored
 */
export function isLegacyHash(stored) {
  const parsed = parseHash(stored)
  return Boolean(parsed && (parsed.legacy || parsed.iterations > PASSWORD_MAX_ITERATIONS))
}

/**
 * 判断存储的口令哈希是否格式合法（用于启动自检，避免存了个坏值）。
 * 旧格式也算「格式合法」：否则登录入口会因为一个旧值而整个消失。
 */
export function isPasswordHashFormat(stored) {
  const parsed = parseHash(stored)
  if (!parsed) return false
  return parsed.salt.length >= 16 && parsed.hash.length >= 32
}
