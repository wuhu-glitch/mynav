/**
 * navDiff.js —— 导航数据的「本地改动」差异记录
 *
 * 背景：nav.json 是站点配置的唯一真相来源，但用户会在页面上新增 / 编辑 / 删除链接。
 * 这些改动必须留在本地，否则一刷新就丢；同时不能把整份 nav.json 快照写进
 * localStorage，否则以后往 nav.json 里加新链接，用户永远看不到。
 *
 * 做法：只记录「差异」——
 *   overrides：被新增或被修改的条目（按 id）
 *   deleted  ：被删除的条目 id
 * 加载时用 applyDiff(baseItems, diff) 把差异叠加到 nav.json 的原始数组上。
 *
 * 本模块是纯函数，不碰 localStorage / Vue，方便单测。
 */

/** 空差异 */
export function emptyDiff() {
  return { overrides: [], deleted: [] }
}

/** id 是否合法（简单形状约束即可，不做过度校验） */
function isValidId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 64
}

/**
 * 校验并规范化从 localStorage 读出的差异对象。
 * 损坏的数据不应该让整站白屏，这里一律降级成空差异。
 */
export function normalizeDiff(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyDiff()

  const deleted = Array.isArray(raw.deleted)
    ? Array.from(new Set(raw.deleted.filter(isValidId)))
    : []

  const seen = new Set()
  const overrides = []
  for (const item of Array.isArray(raw.overrides) ? raw.overrides : []) {
    if (!item || typeof item !== 'object' || !isValidId(item.id)) continue
    if (seen.has(item.id)) continue
    seen.add(item.id)
    overrides.push(item)
  }

  return { overrides, deleted }
}

/**
 * 把差异叠加到基准数组上。
 *
 * 规则：
 * - 基准里被 deleted 标记的条目剔除；
 * - 基准里存在同 id 的，用 overrides 里的版本替换（保持原位置）；
 * - 基准里没有的 override，作为新增追加到末尾（顺序按 overrides）；
 * - overrides 指向的 id 已在 deleted 里时，删除优先（避免「既删又改」打架）。
 *
 * @param {object[]} baseItems nav.json 里的原始条目
 * @param {{overrides: object[], deleted: string[]}} diff
 * @returns {object[]} 新的条目数组（不修改入参）
 */
export function applyDiff(baseItems, diff) {
  const base = Array.isArray(baseItems) ? baseItems : []
  const { overrides, deleted } = normalizeDiff(diff)
  const deletedSet = new Set(deleted)
  const overrideMap = new Map(overrides.map((item) => [item.id, item]))

  const result = []
  const emitted = new Set()

  for (const item of base) {
    if (!item || typeof item.id !== 'string') continue
    if (deletedSet.has(item.id)) continue
    const override = overrideMap.get(item.id)
    if (override) {
      result.push(override)
      emitted.add(item.id)
    } else {
      result.push(item)
    }
  }

  for (const item of overrides) {
    if (deletedSet.has(item.id) || emitted.has(item.id)) continue
    result.push(item)
  }

  return result
}

/** 记录一次「新增或修改」 */
export function withOverride(diff, item) {
  const current = normalizeDiff(diff)
  if (!item || !isValidId(item.id)) return current

  const overrides = current.overrides.filter((entry) => entry.id !== item.id)
  overrides.push(item)

  return {
    overrides,
    // 同一个 id 被重新添加时，必须同时取消删除标记，否则会被删除优先规则吃掉
    deleted: current.deleted.filter((id) => id !== item.id)
  }
}

/** 记录一次删除 */
export function withDeletion(diff, id) {
  const current = normalizeDiff(diff)
  if (!isValidId(id)) return current

  return {
    overrides: current.overrides.filter((entry) => entry.id !== id),
    deleted: current.deleted.includes(id) ? current.deleted : [...current.deleted, id]
  }
}

/**
 * 用一份「完整条目数组」整体重建差异（导入备份时使用）。
 *
 * - 与基准同 id 且内容不同 → 记成 override
 * - 基准没有的新 id → 记成 override
 * - 基准有、传入没有的 id → 记成 deleted
 * - 与基准完全相同的条目 → 不记，继续跟随 nav.json 的未来变化
 *
 * @param {object[]} baseItems nav.json 的原始条目
 * @param {object[]} nextItems 期望生效的完整条目
 */
export function diffFromItems(baseItems, nextItems) {
  const base = Array.isArray(baseItems) ? baseItems : []
  const next = Array.isArray(nextItems) ? nextItems : []

  const baseMap = new Map()
  for (const item of base) {
    if (item && typeof item.id === 'string') baseMap.set(item.id, item)
  }

  const overrides = []
  const seen = new Set()

  for (const item of next) {
    if (!item || !isValidId(item.id)) continue
    seen.add(item.id)
    const original = baseMap.get(item.id)
    // 内容一致就不记录，省得 localStorage 里躺着一份无意义的副本
    if (original && JSON.stringify(original) === JSON.stringify(item)) continue
    overrides.push(item)
  }

  const deleted = base
    .filter((item) => item && typeof item.id === 'string' && !seen.has(item.id))
    .map((item) => item.id)

  return { overrides, deleted }
}
