/**
 * 公共导航的 KV 存储层
 *
 * KV 键约定（全部集中在 KEYS 里，避免散落各处写错）：
 *   auth:password        管理员口令哈希（scrypt1$salt$hash），由初始化脚本写入
 *   auth:fail:<ip>       某 IP 的登录失败计数（用于简单熔断）
 *   nav:current          当前生效的公共导航 { nav, version, updatedAt }
 *   nav:index            版本索引 { versions: [{ version, createdAt, note, itemCount }] }
 *   nav:version:<id>     某个版本快照 { version, nav, createdAt, note }
 *   rate:save            上一次保存时间（防刷）
 *
 * 设计取舍：
 *   - 每次保存都写「快照 + 当前 + 索引」三处：读路径只读 nav:current，保持一次 KV 读；
 *   - 索引里不放完整 nav，避免读列表时把几 MB 数据拽下来；
 *   - 只保留最近 20 个版本，旧的连同索引条目一起删（KV 按写入计费，不能无限攒）。
 */

const encoder = new TextEncoder()

export const KEYS = {
  password: 'auth:password',
  failPrefix: 'auth:fail:',
  current: 'nav:current',
  index: 'nav:index',
  versionPrefix: 'nav:version:',
  saveRate: 'rate:save'
}

export const MAX_VERSIONS = 20
export const MAX_ITEMS = 500
export const MAX_PAYLOAD_BYTES = 200 * 1024 // 200 KB：远超正常导航配置，超出视为滥用
export const SAVE_MIN_INTERVAL_MS = 8000 // 两次保存最短间隔
export const AUTH_FAIL_LIMIT = 5 // 连续失败 5 次
export const AUTH_LOCK_MS = 60 * 1000 // 锁定 60 秒

// ==================== 基础读写 ====================

/** 读 JSON（不存在或解析失败都返回 null，绝不抛错打断页面） */
export async function readJson(kv, key) {
  try {
    const raw = await kv.get(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** 写 JSON */
export async function writeJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value))
}

// ==================== 数据校验 ====================

const isPlainString = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max

/** 只允许 http/https 的绝对地址（服务端独立实现，不依赖前端代码） */
export function isSafeHttpUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const isStringArray = (value, maxItems, maxLength) =>
  Array.isArray(value) &&
  value.length <= maxItems &&
  value.every((entry) => typeof entry === 'string' && entry.length <= maxLength)

/** 链接条目清洗：只保留白名单字段，非法条目直接丢弃（不整单失败） */
function sanitizeItem(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  if (!isPlainString(raw.name, 80)) return null
  if (!isSafeHttpUrl(raw.url)) return null

  return {
    id: isPlainString(raw.id, 80) ? raw.id : `item-${index}-${Date.now()}`,
    name: raw.name.trim(),
    url: raw.url.trim(),
    icon: typeof raw.icon === 'string' && raw.icon.length <= 60 ? raw.icon : '',
    desc: typeof raw.desc === 'string' && raw.desc.length <= 200 ? raw.desc : '',
    tags: isStringArray(raw.tags, 10, 30) ? raw.tags.map((t) => t.trim()).filter(Boolean) : [],
    category: typeof raw.category === 'string' && raw.category.length <= 60 ? raw.category : ''
  }
}

function sanitizeCategories(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry) => entry && isPlainString(entry.title, 60))
    .slice(0, 30)
    .map((entry) => ({
      title: entry.title.trim(),
      filter: isStringArray(entry.filter, 20, 30) ? entry.filter.map((f) => f.trim()).filter(Boolean) : []
    }))
}

function sanitizeEngines(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry) => entry && isPlainString(entry.name, 40) && typeof entry.url === 'string')
    .filter((entry) => entry.url.length <= 500 && entry.url.includes('{query}') && isSafeHttpUrl(entry.url.replace('{query}', 'q')))
    .slice(0, 10)
    .map((entry, index) => ({
      id: isPlainString(entry.id, 40) ? entry.id : `engine-${index}`,
      name: entry.name.trim(),
      url: entry.url.trim()
    }))
}

/**
 * 校验并清洗提交上来的导航配置。
 * @param {unknown} input
 * @returns {{ ok: boolean, nav?: object, errors: string[], warnings: string[] }}
 */
export function sanitizeNav(input) {
  const errors = []
  const warnings = []

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['配置必须是 JSON 对象'], warnings }
  }

  const rawItems = Array.isArray(input.items) ? input.items : []
  const rawPinned = Array.isArray(input.pinnedItems) ? input.pinnedItems : []

  if (rawItems.length + rawPinned.length > MAX_ITEMS) {
    return { ok: false, errors: [`链接总数超过上限 ${MAX_ITEMS} 条`], warnings }
  }
  if (!rawItems.length && !rawPinned.length) {
    errors.push('至少要保留一条链接')
  }

  const items = rawItems.map(sanitizeItem).filter(Boolean)
  const pinnedItems = rawPinned.map(sanitizeItem).filter(Boolean)

  const dropped = rawItems.length + rawPinned.length - items.length - pinnedItems.length
  if (dropped > 0) warnings.push(`已忽略 ${dropped} 条不合法链接（缺名称/非 http(s) 地址）`)
  if (!items.length && !pinnedItems.length) errors.push('清洗后没有可用链接')

  const nav = {
    title: isPlainString(input.title, 120) ? input.title.trim() : 'MyNav 个人导航站',
    subtitle: typeof input.subtitle === 'string' && input.subtitle.length <= 200 ? input.subtitle : '',
    themeColor: ['cyan', 'blue', 'purple', 'magenta', 'lime', 'amber'].includes(input.themeColor)
      ? input.themeColor
      : 'cyan',
    categories: sanitizeCategories(input.categories),
    searchEngines: sanitizeEngines(input.searchEngines),
    pinnedItems,
    items
  }

  if (!nav.categories.length) warnings.push('没有有效分类，前端会只显示「全部」')
  if (!nav.searchEngines.length) warnings.push('没有有效搜索引擎，前端会用内置百度兜底')

  const size = encoder.encode(JSON.stringify(nav)).length
  if (size > MAX_PAYLOAD_BYTES) {
    errors.push(`配置体积 ${Math.round(size / 1024)}KB 超过上限 ${MAX_PAYLOAD_BYTES / 1024}KB`)
  }

  return { ok: errors.length === 0, nav, errors, warnings }
}

// ==================== 版本与读写 ====================

/** 生成版本号：可排序（epoch 毫秒）+ 4 位随机后缀，避免同毫秒冲突 */
export function buildVersionId(nowMs = Date.now(), random = () => Math.random()) {
  const suffix = Math.floor(random() * 0xffff)
    .toString(16)
    .padStart(4, '0')
  return `v-${nowMs}-${suffix}`
}

/** 读取当前公共导航（含元信息）；没写过或解析失败返回 null */
export function readCurrentNav(kv) {
  return readJson(kv, KEYS.current)
}

/** 读取版本索引 */
export async function readVersionIndex(kv) {
  const index = await readJson(kv, KEYS.index)
  if (!index || !Array.isArray(index.versions)) return { versions: [] }
  return index
}

/**
 * 保存新版本。
 * 步骤：快照 → 当前 → 索引（新在前）→ 超出 20 个就删最旧的快照。
 * @returns {Promise<{ version: string, createdAt: string, itemCount: number }>}
 */
export async function saveNavVersion(kv, nav, options = {}) {
  const nowMs = options.nowMs || Date.now()
  const createdAt = new Date(nowMs).toISOString()
  const version = buildVersionId(nowMs, options.random)
  const note = typeof options.note === 'string' ? options.note.slice(0, 120) : ''
  const itemCount = (nav.items?.length || 0) + (nav.pinnedItems?.length || 0)

  // 快照先写：即使后面索引写失败，至少当前配置是完整的
  await writeJson(kv, `${KEYS.versionPrefix}${version}`, { version, nav, createdAt, note })
  await writeJson(kv, KEYS.current, { nav, version, updatedAt: createdAt, itemCount })

  const index = await readVersionIndex(kv)
  const entry = { version, createdAt, note, itemCount }
  const versions = [entry, ...index.versions.filter((v) => v.version !== version)]

  // 裁掉超额的旧版本（连同快照键）
  const keep = versions.slice(0, MAX_VERSIONS)
  const removed = versions.slice(MAX_VERSIONS)
  await writeJson(kv, KEYS.index, { versions: keep })
  for (const old of removed) {
    try {
      await kv.delete(`${KEYS.versionPrefix}${old.version}`)
    } catch {
      // 删除失败不影响主流程（下次保存会再试）
    }
  }

  return { version, createdAt, itemCount }
}

/** 读某个版本快照 */
export function readVersion(kv, version) {
  if (typeof version !== 'string' || !/^v-\d+-[0-9a-f]{1,4}$/.test(version)) return Promise.resolve(null)
  return readJson(kv, `${KEYS.versionPrefix}${version}`)
}

/**
 * 回滚：把指定版本的内容重新发布为一个新版本（保留审计轨迹，而不是删历史）。
 * @returns {Promise<{ ok: boolean, version?: string, error?: string }>}
 */
export async function rollbackToVersion(kv, version, options = {}) {
  const snapshot = await readVersion(kv, version)
  if (!snapshot || !snapshot.nav) return { ok: false, error: 'version_not_found' }
  const result = await saveNavVersion(kv, snapshot.nav, {
    ...options,
    note: `回滚自 ${version}`
  })
  return { ok: true, version: result.version, createdAt: result.createdAt }
}

// ==================== 防刷 ====================

/**
 * 保存频率限制（全局 8 秒一次）。
 * KV 是最终一致的，跨区域可能有秒级误差；这里只是"挡住手抖与脚本连点"，
 * 真正的流量防护仍然建议在 Cloudflare 侧配 Rate Limiting。
 * @returns {Promise<{ allowed: boolean, retryAfterSeconds?: number }>}
 */
export async function checkSaveRateLimit(kv, nowMs = Date.now()) {
  const last = await readJson(kv, KEYS.saveRate)
  if (last && typeof last.at === 'number') {
    const elapsed = nowMs - last.at
    if (elapsed >= 0 && elapsed < SAVE_MIN_INTERVAL_MS) {
      return { allowed: false, retryAfterSeconds: Math.ceil((SAVE_MIN_INTERVAL_MS - elapsed) / 1000) }
    }
  }
  return { allowed: true }
}

/** 记录一次成功保存的时间（用于下一次限频判断） */
export function markSaveRate(kv, nowMs = Date.now()) {
  return writeJson(kv, KEYS.saveRate, { at: nowMs })
}

/**
 * 登录失败计数 + 熔断。
 * @returns {Promise<{ locked: boolean, retryAfterSeconds?: number }>}
 */
export async function checkAuthLock(kv, ipKey, nowMs = Date.now()) {
  if (!ipKey) return { locked: false }
  const record = await readJson(kv, `${KEYS.failPrefix}${ipKey}`)
  if (!record) return { locked: false }
  if (typeof record.until === 'number' && record.until > nowMs) {
    return { locked: true, retryAfterSeconds: Math.ceil((record.until - nowMs) / 1000) }
  }
  return { locked: false }
}

/**
 * 记录一次失败；达到阈值就锁定一段时间。
 * @returns {Promise<{ count: number, locked: boolean }>}
 */
export async function recordAuthFailure(kv, ipKey, nowMs = Date.now()) {
  if (!ipKey) return { count: 0, locked: false }
  const key = `${KEYS.failPrefix}${ipKey}`
  const record = (await readJson(kv, key)) || { count: 0 }
  const count = (record.count || 0) + 1
  const locked = count >= AUTH_FAIL_LIMIT
  const next = {
    count,
    // 锁定到期后计数清零由 checkAuthLock 之后的重置负责，这里只写到期时间
    until: locked ? nowMs + AUTH_LOCK_MS : record.until && record.until > nowMs ? record.until : 0
  }
  await writeJson(kv, key, next)
  return { count, locked }
}

/** 登录成功后清掉失败计数 */
export async function clearAuthFailures(kv, ipKey) {
  if (!ipKey) return
  try {
    await kv.delete(`${KEYS.failPrefix}${ipKey}`)
  } catch {}
}
