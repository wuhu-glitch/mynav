/**
 * POST /api/rollback —— 回滚到指定版本（管理员）
 *
 * 请求：{ "version": "v-1761638400000-ab12" }
 * 行为：把该版本的 nav 内容重新发布为一个**新版本**（note 记「回滚自 xxx」），
 *       而不是删掉历史 —— 审计轨迹必须连续，否则「谁在什么时候回滚」就查不到了。
 */
import { jsonResponse } from '../_lib/auth.js'
import { requireAdmin } from '../_lib/admin.js'
import { rollbackToVersion, checkSaveRateLimit, markSaveRate } from '../_lib/navstore.js'

export async function onRequestPost({ request, env }) {
  const kv = env?.MYNAV_KV || null
  if (!kv) {
    return jsonResponse({ ok: false, error: 'not_configured', message: '未绑定 MYNAV_KV' }, 503)
  }

  const auth = await requireAdmin(request, env)
  if (!auth.ok) return auth.response

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'bad_json' }, 400)
  }

  const version = typeof body?.version === 'string' ? body.version : ''
  if (!version) {
    return jsonResponse({ ok: false, error: 'missing_version' }, 400)
  }

  const rate = await checkSaveRateLimit(kv)
  if (!rate.allowed) {
    return jsonResponse(
      { ok: false, error: 'too_fast', message: `操作过快，请 ${rate.retryAfterSeconds} 秒后再试` },
      429,
      { 'Retry-After': String(rate.retryAfterSeconds || 8) }
    )
  }

  const result = await rollbackToVersion(kv, version)
  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error || 'rollback_failed' }, 404)
  }
  await markSaveRate(kv)

  return jsonResponse({ ok: true, version: result.version, createdAt: result.createdAt, from: version })
}

export async function onRequest({ request }) {
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, {
    Allow: 'POST',
    method: request.method.toUpperCase()
  })
}
