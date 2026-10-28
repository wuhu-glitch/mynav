/**
 * backup.js —— 备份文件的校验、解析与合并
 *
 * 为什么单独抽出来：
 * 1. 导入是「外部数据进入应用」的唯一入口，必须当成不可信输入处理
 *    （非法 URL、超长字段、缺 id、重复 id、未知字段都要挡掉）；
 * 2. 纯函数不碰 DOM / localStorage / Vue，可以直接用 node --test 跑断言，
 *    不必为了测合并逻辑启浏览器；
 * 3. 合并策略集中在一处，UI 只负责「把结果展示给用户」。
 *
 * 备份文件结构（与 useLocalStorage.exportData 导出的格式一致）：
 * {
 *   app: 'MyNav',
 *   schemaVersion: 1,
 *   exportedAt: '2026-10-28T...',
 *   settings: { theme, accentColor, bgType, ... },
 *   navData: { items: [...], pinnedItems: [...] }
 * }
 */

export const BACKUP_APP = 'MyNav'
export const BACKUP_SCHEMA_VERSION = 1

/** 备份文件大小上限：5MB。纯 JSON 的导航数据远超这个体量说明文件不对 */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024

/** 单次导入后导航项总数上限，防止误导入超大文件把页面拖死 */
export const MAX_ITEMS = 500

/** 允许的主题色（必须与 SettingsPanel 的 accentColors、useCyberTheme 的 colorMap 一致） */
const ACCENT_COLORS = ['cyan', 'blue', 'purple', 'magenta', 'lime']

/** 允许的背景类型（必须与 SettingsPanel 的 bgTypes、useCyberTheme 的 switch 分支一致） */
const BG_TYPES = [
  'gradient-radial-2',
  'gradient-radial',
  'gradient',
  'grid',
  'circuit-board',
  'solid',
  'image'
]

const LAYOUT_MODES = ['grid', 'compact']
const CARD_SPACINGS = ['compact', 'normal', 'spaced']
const THEMES = ['dark', 'light']

/** 特效开关的合法 key（与 SettingsPanel 的 effectToggles 一致） */
const EFFECT_KEYS = ['scanline', 'glitch', 'neonBorders', 'glowText', 'cursorTrail']

const MAX_NAME = 60
const MAX_URL = 2048
const MAX_DESC = 300
const MAX_CATEGORY = 40
const MAX_TAGS = 8
const MAX_TAG_LEN = 20
const MAX_ID = 64

/** 图标必须形如 "mdi:github"（集合名:图标名），避免被塞进奇怪的字符串 */
const ICON_RE = /^[a-z0-9-]+:[a-z0-9-]+$/i

/**
 * 判断是否为可安全打开的链接。
 * 只放行 http/https：javascript: / data: / vbscript: / file: 一律拒绝
 * （卡片点击会 window.open(url)，不能让外部文件控制打开什么）。
 */
export function isSafeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** 取字符串并截断，非字符串返回空串 */
function asString(value, max) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

/** 取布尔值，非布尔返回 null（表示「字段无效，不要写入」） */
function asBoolean(value) {
  return typeof value === 'boolean' ? value : null
}

/** 取有限数字并夹到区间内 */
function asNumber(value, min, max) {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return null
  return Math.min(max, Math.max(min, num))
}

/** 把名称变成 URL 安全的 id 片段（中文会被去掉，所以还要兜底） */
function slugify(text) {
  const slug = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'item'
}

/**
 * 校验并规范化一条导航项。
 *
 * @param {any} raw 原始数据
 * @param {Set<string>} usedIds 已占用的 id 集合（会被就地更新，用于去重）
 * @returns {{ item: object, warnings: string[] } | null} 无效返回 null
 */
export function sanitizeItem(raw, usedIds = new Set()) {
  const warnings = []

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const name = asString(raw.name, MAX_NAME)
  if (!name) return null

  const url = asString(raw.url, MAX_URL)
  if (!isSafeUrl(url)) return null

  // id：优先用备份里的；缺失或重复就基于名称生成，并自动加后缀去重
  let id = asString(raw.id, MAX_ID)
  if (!id) {
    warnings.push(`「${name}」缺少 id，已自动生成`)
  } else if (usedIds.has(id)) {
    warnings.push(`「${name}」的 id「${id}」重复，已自动改写`)
    id = ''
  }
  if (!id || usedIds.has(id)) {
    const base = `custom-${slugify(name)}`
    let candidate = base
    let counter = 2
    while (usedIds.has(candidate)) {
      candidate = `${base}-${counter}`
      counter += 1
    }
    id = candidate
  }
  usedIds.add(id)

  const item = {
    id,
    name,
    url,
    desc: asString(raw.desc, MAX_DESC),
    category: asString(raw.category, MAX_CATEGORY)
  }

  // 图标：不合法的直接丢弃，让卡片回落到默认图标，而不是渲染出坏值
  const icon = asString(raw.icon, 128)
  if (icon) {
    if (ICON_RE.test(icon)) item.icon = icon
    else warnings.push(`「${name}」的图标格式非法，已忽略`)
  }

  // 标签：数组 → 去空去重、限个数与长度
  if (Array.isArray(raw.tags)) {
    const tags = []
    for (const tag of raw.tags) {
      const text = asString(tag, MAX_TAG_LEN)
      if (text && !tags.includes(text)) tags.push(text)
      if (tags.length >= MAX_TAGS) break
    }
    if (tags.length) item.tags = tags
  } else if (raw.tags !== undefined) {
    warnings.push(`「${name}」的标签不是数组，已忽略`)
  }

  return { item, warnings }
}

/**
 * 校验并规范化设置对象。
 * 只保留白名单字段；类型不对的字段丢弃并记一条警告，交由调用方与默认值合并。
 *
 * @returns {{ value: object, warnings: string[] }}
 */
export function sanitizeSettings(raw) {
  const warnings = []
  const value = {}

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { value, warnings: ['备份里的设置不是对象，已忽略'] }
  }

  const pickOneOf = (key, allowed) => {
    const current = raw[key]
    if (current === undefined) return
    if (typeof current === 'string' && allowed.includes(current)) value[key] = current
    else warnings.push(`设置 ${key} 的值「${String(current)}」不在允许范围内，已忽略`)
  }

  pickOneOf('theme', THEMES)
  pickOneOf('accentColor', ACCENT_COLORS)
  pickOneOf('bgType', BG_TYPES)
  pickOneOf('layoutMode', LAYOUT_MODES)
  pickOneOf('cardiSpacing', CARD_SPACINGS)

  if (raw.bgImage !== undefined) {
    // 背景图允许 http(s) 链接或本地 DataURL（面板里上传图片会转成 DataURL 存本地）
    const bgImage = asString(raw.bgImage, MAX_URL * 4)
    if (!bgImage || isSafeUrl(bgImage) || bgImage.startsWith('data:image/')) {
      value.bgImage = bgImage
    } else {
      warnings.push('背景图片地址不是 http(s) 或 data:image，已忽略')
    }
  }

  if (raw.bgOverlay !== undefined) {
    const overlay = asNumber(raw.bgOverlay, 0, 1)
    if (overlay === null) warnings.push('背景遮罩强度不是数字，已忽略')
    else value.bgOverlay = overlay
  }

  const pickText = (key, max) => {
    if (raw[key] === undefined) return
    const text = asString(raw[key], max)
    if (text) value[key] = text
    else warnings.push(`设置 ${key} 不是有效文本，已忽略`)
  }

  pickText('siteTitle', MAX_NAME)
  pickText('siteSubtitle', MAX_NAME)

  if (raw.searchShortcut !== undefined) {
    const shortcut = asString(raw.searchShortcut, 4)
    if (shortcut) value.searchShortcut = shortcut
    else warnings.push('快捷键为空，已忽略')
  }

  // 特效与显示开关：逐个布尔校验，非法项单独告警
  if (raw.effects !== undefined) {
    if (raw.effects && typeof raw.effects === 'object' && !Array.isArray(raw.effects)) {
      const effects = {}
      for (const key of EFFECT_KEYS) {
        if (raw.effects[key] === undefined) continue
        const flag = asBoolean(raw.effects[key])
        if (flag === null) warnings.push(`特效开关 ${key} 不是布尔值，已忽略`)
        else effects[key] = flag
      }
      value.effects = effects
    } else {
      warnings.push('特效设置不是对象，已忽略')
    }
  }

  for (const key of ['showClock', 'showHitokoto', 'showPinned']) {
    if (raw[key] === undefined) continue
    const flag = asBoolean(raw[key])
    if (flag === null) warnings.push(`开关 ${key} 不是布尔值，已忽略`)
    else value[key] = flag
  }

  return { value, warnings }
}

/**
 * 解析备份文本。
 * 只做「结构层面」的校验与规范化，不涉及任何 UI 状态。
 *
 * @param {string} text 文件内容
 * @returns {{ settings: object, navData: { items: object[], pinnedItems: object[] }, warnings: string[], meta: object }}
 * @throws {Error} 文件不是合法 JSON / 不是对象时抛出
 */
export function parseBackup(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('备份文件内容为空')
  }
  if (text.length > MAX_BACKUP_BYTES) {
    throw new Error('备份文件过大（超过 5MB）')
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('备份文件不是合法的 JSON')
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('备份文件格式不正确（顶层应为对象）')
  }

  const warnings = []

  // 来源与版本：只提示、不阻断，方便用户导入旧版本备份
  if (data.app !== BACKUP_APP) {
    warnings.push(`备份来源标记为「${String(data.app ?? '未知')}」，不是 MyNav，仍尝试导入`)
  }
  if (data.schemaVersion !== undefined && data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    warnings.push(`备份版本为 ${String(data.schemaVersion)}，当前支持 ${BACKUP_SCHEMA_VERSION}，可能存在字段差异`)
  }

  const { value: settings, warnings: settingsWarnings } = sanitizeSettings(data.settings)
  warnings.push(...settingsWarnings)

  // 导航数据：只取 items / pinnedItems（分类与搜索源以 nav.json 为准，不覆盖）
  const navData = { items: [], pinnedItems: [] }
  const rawNav = data.navData

  if (rawNav && typeof rawNav === 'object') {
    if (Array.isArray(rawNav.categories) && rawNav.categories.length) {
      warnings.push('备份中的分类未导入（分类只由 nav.json 决定，避免覆盖站点配置）')
    }

    const usedIds = new Set()
    const rawItems = Array.isArray(rawNav.items) ? rawNav.items : []
    let dropped = 0
    for (const raw of rawItems) {
      const result = sanitizeItem(raw, usedIds)
      if (!result) {
        dropped += 1
        continue
      }
      if (navData.items.length >= MAX_ITEMS) break
      navData.items.push(result.item)
      warnings.push(...result.warnings)
    }
    if (dropped) warnings.push(`${dropped} 条链接缺少名称或链接地址不合法，已跳过`)
    if (rawItems.length > MAX_ITEMS) {
      warnings.push(`链接数量超过 ${MAX_ITEMS} 上限，只导入前 ${MAX_ITEMS} 条`)
    }

    const pinnedIds = new Set()
    const rawPinned = Array.isArray(rawNav.pinnedItems) ? rawNav.pinnedItems : []
    for (const raw of rawPinned) {
      const result = sanitizeItem(raw, pinnedIds)
      if (!result) {
        warnings.push('有一条置顶链接不合法，已跳过')
        continue
      }
      navData.pinnedItems.push(result.item)
      warnings.push(...result.warnings)
    }
  }

  return {
    settings,
    navData,
    warnings,
    meta: {
      app: data.app ?? null,
      schemaVersion: data.schemaVersion ?? null,
      exportedAt: data.exportedAt ?? null
    }
  }
}

/**
 * 合并导航数据。
 *
 * 策略（明确写死，避免「覆盖 vs 保留」的模糊地带）：
 * - 按 id 对齐：同一个 id → **备份版本覆盖当前版本**（备份代表用户此刻想恢复的状态）；
 * - 只有备份里有的 id → 视为新增；
 * - 只有当前有、备份没有的 id → **保留**（导入是「恢复/合并」，不是「清空重来」）；
 * - 置顶项同样按 id 合并；
 * - 总数受 MAX_ITEMS 限制，超出部分丢弃并告警。
 *
 * @param {{ items: object[], pinnedItems: object[] }} current 当前运行时数据
 * @param {{ items: object[], pinnedItems: object[] }} incoming 备份里的数据
 * @returns {{ items: object[], pinnedItems: object[], report: object }}
 */
export function mergeNavData(current, incoming) {
  const currentItems = Array.isArray(current?.items) ? current.items : []
  const incomingItems = Array.isArray(incoming?.items) ? incoming.items : []
  const warnings = []

  const merged = new Map()
  for (const item of currentItems) {
    if (item && typeof item.id === 'string') merged.set(item.id, item)
  }

  let added = 0
  let updated = 0
  for (const item of incomingItems) {
    if (!item || typeof item.id !== 'string') continue
    if (merged.has(item.id)) {
      merged.set(item.id, item)
      updated += 1
    } else {
      merged.set(item.id, item)
      added += 1
    }
  }

  let items = Array.from(merged.values())
  if (items.length > MAX_ITEMS) {
    warnings.push(`合并后链接超过 ${MAX_ITEMS} 条，多余的已丢弃`)
    items = items.slice(0, MAX_ITEMS)
  }

  // 置顶项：按 id 合并，备份优先
  const pinnedMap = new Map()
  for (const item of Array.isArray(current?.pinnedItems) ? current.pinnedItems : []) {
    if (item && typeof item.id === 'string') pinnedMap.set(item.id, item)
  }
  let pinnedAdded = 0
  for (const item of Array.isArray(incoming?.pinnedItems) ? incoming.pinnedItems : []) {
    if (!item || typeof item.id !== 'string') continue
    if (!pinnedMap.has(item.id)) pinnedAdded += 1
    pinnedMap.set(item.id, item)
  }

  return {
    items,
    pinnedItems: Array.from(pinnedMap.values()),
    report: { added, updated, pinnedAdded, warnings }
  }
}
