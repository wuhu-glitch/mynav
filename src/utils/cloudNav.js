/**
 * 云端公共配置客户端
 *
 * 只做三件事：读当前配置、发布新版本、版本列表与回滚。
 * 所有请求都：
 *   - 带 8 秒超时（AbortController），避免弱网下页面一直转圈；
 *   - 同源 cookie（credentials: 'same-origin'），管理员会话由浏览器自动带上；
 *   - 失败一律返回 null / 抛出可读错误，由调用方决定降级（绝不白屏）。
 *
 * 注意：本站默认不访问任何接口；只有用户主动打开「云端公共配置」开关时才会走到这里。
 */

const TIMEOUT_MS = 8000

/** 本地缓存键：云端配置读到过一次后缓存下来，弱网/离线时仍能看到上次的内容 */
export const CLOUD_CACHE_KEY = 'mynav-cloud-cache'

async function requestJson(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(path, {
      ...options,
      signal: controller.signal,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    })
    const data = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, data }
  } catch (error) {
    return { ok: false, status: 0, data: null, error }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 读取云端公共配置。
 * @returns {Promise<{ nav: object, version: string, updatedAt: string } | null>}
 *   null 表示「云端没有配置或读取失败」，调用方应回退静态 nav.json。
 */
export async function fetchCloudNav() {
  const { ok, data } = await requestJson('/api/nav')
  if (!ok || !data?.ok || data.source !== 'kv' || !data.nav) return null

  const result = { nav: data.nav, version: data.version || '', updatedAt: data.updatedAt || '' }

  // 写入本地缓存（仅内容，不含任何凭据）
  try {
    localStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify(result))
  } catch {
    // 缓存失败不影响使用
  }
  return result
}

/** 读本地缓存（云端不可用时的兜底） */
export function readCloudCache() {
  try {
    const raw = localStorage.getItem(CLOUD_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.nav) return null
    return parsed
  } catch {
    return null
  }
}

/** 清掉本地缓存（关闭云端开关时顺手清理，避免残留旧数据误导） */
export function clearCloudCache() {
  try {
    localStorage.removeItem(CLOUD_CACHE_KEY)
  } catch {
    // 忽略
  }
}

/**
 * 发布配置到云端（需要管理员会话）。
 * @param {object} nav 完整导航配置
 * @param {string} note 版本备注（可选）
 * @returns {Promise<{ ok: boolean, version?: string, createdAt?: string, warnings?: string[], error?: string, message?: string }>}
 */
export async function publishCloudNav(nav, note = '') {
  const { ok, data } = await requestJson('/api/nav', {
    method: 'POST',
    body: JSON.stringify({ nav, note })
  })
  if (!ok || !data?.ok) {
    return {
      ok: false,
      error: data?.error || 'network',
      message: data?.message || (data?.errors || []).join('；') || '发布失败，请稍后重试'
    }
  }
  return {
    ok: true,
    version: data.version,
    createdAt: data.createdAt,
    warnings: Array.isArray(data.warnings) ? data.warnings : []
  }
}

/**
 * 读取版本列表（需要管理员会话）。
 * @returns {Promise<{ versions: object[], currentVersion: string } | null>}
 */
export async function fetchVersions() {
  const { ok, data } = await requestJson('/api/versions')
  if (!ok || !data?.ok) return null
  return {
    versions: Array.isArray(data.versions) ? data.versions : [],
    currentVersion: data.currentVersion || ''
  }
}

/**
 * 回滚到某个版本（需要管理员会话）。
 * @returns {Promise<{ ok: boolean, version?: string, error?: string, message?: string }>}
 */
export async function rollbackVersion(version) {
  const { ok, data } = await requestJson('/api/rollback', {
    method: 'POST',
    body: JSON.stringify({ version })
  })
  if (!ok || !data?.ok) {
    return {
      ok: false,
      error: data?.error || 'network',
      message: data?.message || '回滚失败，请稍后重试'
    }
  }
  return { ok: true, version: data.version, from: data.from }
}
