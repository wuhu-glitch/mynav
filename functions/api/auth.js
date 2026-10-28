/**
 * POST /api/auth —— 管理员登录（口令来自 KV）
 *
 * 请求：{ "password": "..." }
 * 成功：200 { ok: true, expiresIn } + Set-Cookie（HttpOnly 会话）
 * 失败：401 { ok: false, error: 'invalid_credentials' }
 *
 * 设计要点：
 *   1. 口令哈希存在 KV（键 auth:password，格式 scrypt2$iterations$salt$hash），
 *      前端与仓库里都不出现明文；环境变量 MYNAV_ADMIN_PASSWORD 仅作兜底迁移用；
 *   2. 失败计数按 IP 记在 KV，连续 5 次锁 60 秒 —— 挡住无脑爆破；
 *   3. 失败路径固定延迟 300ms，让在线猜解的响应时间恒定；
 *   4. 什么都没配置时返回 503，绝不放行。
 *
 * 关于 500（踩过的坑）：
 *   未捕获异常会让 Worker 直接回一个 Cloudflare 的 500 页，前端只能显示
 *   「鉴权接口返回异常（500）」，什么信息都没有。这里统一包一层 try/catch，
 *   并把各阶段耗时放进响应头 `X-Auth-Timing`，便于定位是 KV、KDF 还是签名慢。
 *   注意：如果是「CPU 时间超限」被运行时杀掉，catch 不会执行——
 *   那时响应头会缺失，这本身就是判断依据。
 */
import { jsonResponse, delay, digestText } from '../_lib/auth.js'
import {
  createSessionToken,
  buildSessionCookie,
  SESSION_TTL_SECONDS,
  timingSafeEqual
} from '../_lib/session.js'
import { verifyPassword, isPasswordHashFormat, isLegacyHash } from '../_lib/password.js'
import { KEYS, readJson, checkAuthLock, recordAuthFailure, clearAuthFailures } from '../_lib/navstore.js'
import { clientIpKey } from '../_lib/admin.js'

/** 把各阶段耗时拼成紧凑字符串，塞进响应头（不含任何口令信息） */
function timingHeader(timings) {
  return Object.entries(timings)
    .map(([key, value]) => `${key}=${value}`)
    .join(';')
}

async function handleLogin(request, env, timings) {
  const secret = env?.MYNAV_SESSION_SECRET || ''
  if (secret.length < 16) {
    return jsonResponse(
      { ok: false, error: 'not_configured', message: '服务端未配置 MYNAV_SESSION_SECRET' },
      503,
      { 'X-Auth-Timing': timingHeader(timings) }
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
  if (!submitted || submitted.length > 200) {
    return jsonResponse({ ok: false, error: 'invalid_credentials' }, 401)
  }

  const kv = env?.MYNAV_KV || null
  const envFallback = env?.MYNAV_ADMIN_PASSWORD || ''

  // KV 与旧的环境变量口令都没有 → 视为未配置（绝不放行）
  let startedAt = Date.now()
  const storedHash = kv ? await readJson(kv, KEYS.password) : null
  timings.kvRead = Date.now() - startedAt

  const hasKvPassword = Boolean(storedHash && isPasswordHashFormat(storedHash.hash))
  if (!hasKvPassword && envFallback.length < 8) {
    return jsonResponse(
      {
        ok: false,
        error: 'not_configured',
        message: '服务端未初始化管理员口令（KV auth:password 或环境变量 MYNAV_ADMIN_PASSWORD）'
      },
      503,
      { 'X-Auth-Timing': timingHeader(timings) }
    )
  }

  // 旧格式哈希（scrypt1 / 12 万次）在当前运行时算不动，给明确指引而不是「口令不正确」
  if (hasKvPassword && isLegacyHash(storedHash.hash)) {
    return jsonResponse(
      {
        ok: false,
        error: 'password_hash_incompatible',
        message:
          'KV 里的口令哈希是旧格式（迭代次数超出 Workers 上限 100000），' +
          '请用 npm run hash-password 重新生成并覆盖 auth:password'
      },
      409,
      { 'X-Auth-Timing': timingHeader(timings) }
    )
  }

  // 有 KV 才做失败熔断（无 KV 的旧部署走环境变量，行为保持与之前一致）
  const ipKey = kv ? await clientIpKey(request) : ''
  if (kv) {
    startedAt = Date.now()
    const lock = await checkAuthLock(kv, ipKey)
    timings.lockRead = Date.now() - startedAt
    if (lock.locked) {
      return jsonResponse(
        { ok: false, error: 'locked', message: `尝试过于频繁，请 ${lock.retryAfterSeconds} 秒后再试` },
        429,
        {
          'Retry-After': String(lock.retryAfterSeconds || 60),
          'X-Auth-Timing': timingHeader(timings)
        }
      )
    }
  }

  // 优先用 KV 里的口令哈希；没有时退回环境变量（便于从旧部署平滑迁移）
  let matched = false
  startedAt = Date.now()
  if (hasKvPassword) {
    matched = await verifyPassword(submitted, storedHash.hash)
  } else {
    // 旧路径：比较摘要而不是明文，避免把密码拼进字符串
    const [a, b] = await Promise.all([digestText(submitted), digestText(envFallback)])
    matched = timingSafeEqual(a, b)
  }
  timings.kdf = Date.now() - startedAt

  // 恒定响应时间：成功也等，避免「快 = 密码对」的旁路
  await delay(300)

  if (!matched) {
    if (kv) await recordAuthFailure(kv, ipKey)
    return jsonResponse({ ok: false, error: 'invalid_credentials' }, 401, {
      'X-Auth-Timing': timingHeader(timings)
    })
  }

  if (kv) await clearAuthFailures(kv, ipKey)
  startedAt = Date.now()
  const token = await createSessionToken(secret)
  timings.token = Date.now() - startedAt

  return jsonResponse({ ok: true, expiresIn: SESSION_TTL_SECONDS }, 200, {
    'Set-Cookie': buildSessionCookie(token),
    'X-Auth-Timing': timingHeader(timings)
  })
}

export async function onRequestPost({ request, env }) {
  const timings = {}
  try {
    return await handleLogin(request, env, timings)
  } catch (error) {
    // 把错误类型与阶段耗时回给前端：不含口令，只含异常描述
    const detail = `${error?.name || 'Error'}: ${error?.message || String(error)}`.slice(0, 200)
    console.error('登录处理异常:', detail)
    return jsonResponse(
      {
        ok: false,
        error: 'internal_error',
        message: `服务端异常（${detail}）`,
        timings
      },
      500,
      { 'X-Auth-Timing': timingHeader(timings) }
    )
  }
}

/** 其他方法一律 405，不暴露任何信息 */
export async function onRequest() {
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' })
}
