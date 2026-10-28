/**
 * GET /api/versions —— 版本时间轴（管理员）
 *
 * 返回最近 20 个版本的元信息（不返回内容本身，避免一次拽下几 MB）：
 *   { ok: true, versions: [{ version, createdAt, note, itemCount }], currentVersion }
 *
 * 为什么要求管理员：版本列表会暴露「站点什么时候改过什么内容」的运营信息，
 * 对访客没有用处，干脆不开公开读口子。
 */
import { jsonResponse } from '../_lib/auth.js'
import { requireAdmin } from '../_lib/admin.js'
import { readVersionIndex, readCurrentNav } from '../_lib/navstore.js'

export async function onRequestGet({ request, env }) {
  const kv = env?.MYNAV_KV || null
  if (!kv) {
    return jsonResponse({ ok: false, error: 'not_configured', message: '未绑定 MYNAV_KV' }, 503)
  }

  const auth = await requireAdmin(request, env)
  if (!auth.ok) return auth.response

  const index = await readVersionIndex(kv)
  const current = await readCurrentNav(kv)

  return jsonResponse({
    ok: true,
    versions: index.versions,
    currentVersion: current?.version || ''
  })
}

export async function onRequest({ request }) {
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, {
    Allow: 'GET',
    method: request.method.toUpperCase()
  })
}
