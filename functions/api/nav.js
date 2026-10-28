/**
 * /api/nav —— 公共导航的读取与发布
 *
 *   GET  （公开） 当前生效的公共配置；KV 无数据或读取失败 → { source: 'none' }，
 *                 前端据此回退到静态 public/nav.json。
 *   POST （管理员）发布新版本；每次发布生成一个带时间戳的快照（可回滚）。
 *
 * 为什么 GET 走 KV 但 POST 走校验：
 *   读路径要快、要缓存友好（no-store 但仍允许 CDN 边缘读），所以只读一次 nav:current；
 *   写路径是低频操作，可以多花几次 KV 读写做「快照 + 索引 + 限频」。
 */
import { jsonResponse } from '../_lib/auth.js'
import { requireAdmin } from '../_lib/admin.js'
import {
  KEYS,
  readCurrentNav,
  saveNavVersion,
  sanitizeNav,
  checkSaveRateLimit,
  markSaveRate,
  MAX_PAYLOAD_BYTES
} from '../_lib/navstore.js'

/** GET：读当前配置（公开） */
export async function onRequestGet({ env }) {
  const kv = env?.MYNAV_KV || null
  if (!kv) return jsonResponse({ ok: true, source: 'none', reason: 'kv_not_bound', nav: null })

  const current = await readCurrentNav(kv)
  if (!current || !current.nav) {
    return jsonResponse({ ok: true, source: 'none', nav: null })
  }
  return jsonResponse({
    ok: true,
    source: 'kv',
    nav: current.nav,
    version: current.version || '',
    updatedAt: current.updatedAt || '',
    itemCount: current.itemCount || 0
  })
}

/** POST：发布新版本（管理员） */
export async function onRequestPost({ request, env }) {
  const kv = env?.MYNAV_KV || null
  if (!kv) {
    return jsonResponse({ ok: false, error: 'not_configured', message: '未绑定 MYNAV_KV' }, 503)
  }

  const auth = await requireAdmin(request, env)
  if (!auth.ok) return auth.response

  const contentType = request.headers.get('Content-Type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse({ ok: false, error: 'bad_content_type' }, 415)
  }

  // 先把原始文本读出来：既能限体积，也能给出比 JSON.parse 报错更有用的信息
  let raw
  try {
    raw = await request.text()
  } catch {
    return jsonResponse({ ok: false, error: 'bad_request' }, 400)
  }
  if (new TextEncoder().encode(raw).length > MAX_PAYLOAD_BYTES) {
    return jsonResponse({ ok: false, error: 'payload_too_large' }, 413)
  }

  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonResponse({ ok: false, error: 'bad_json' }, 400)
  }

  // 防刷：全局最短 8 秒一次
  const rate = await checkSaveRateLimit(kv)
  if (!rate.allowed) {
    return jsonResponse(
      { ok: false, error: 'too_fast', message: `操作过快，请 ${rate.retryAfterSeconds} 秒后再保存` },
      429,
      { 'Retry-After': String(rate.retryAfterSeconds || 8) }
    )
  }

  const checked = sanitizeNav(body?.nav ?? body)
  if (!checked.ok) {
    return jsonResponse({ ok: false, error: 'invalid_nav', errors: checked.errors }, 422)
  }

  const saved = await saveNavVersion(kv, checked.nav, {
    note: typeof body?.note === 'string' ? body.note : ''
  })
  await markSaveRate(kv)

  return jsonResponse({
    ok: true,
    version: saved.version,
    createdAt: saved.createdAt,
    itemCount: saved.itemCount,
    warnings: checked.warnings
  })
}

/** 其他方法 405 */
export async function onRequest({ request }) {
  const method = request.method.toUpperCase()
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST', method })
}
