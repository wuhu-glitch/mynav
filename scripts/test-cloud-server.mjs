/**
 * 云端公共配置服务端逻辑单测（node scripts/test-cloud-server.mjs）
 *
 * 覆盖：
 *   - 数据清洗：非法 URL / 非 http(s) / 空链接 / 超量链接；
 *   - 版本存储：快照 + 索引 + 只留 20 个版本；
 *   - 回滚：生成新版本而不是删历史；
 *   - 防刷：8 秒最短保存间隔；
 *   - 登录熔断：连续 5 次失败锁定；
 *   - 口令哈希：正确/错误口令、格式校验。
 *
 * 用内存 KV 替代真实 Cloudflare KV（同样的 get/put/delete 形状），
 * 这样逻辑可在 Node 里跑，CI 上不需要 wrangler 或云凭据。
 */
import assert from 'node:assert/strict'
import {
  sanitizeNav,
  saveNavVersion,
  readCurrentNav,
  readVersionIndex,
  readVersion,
  rollbackToVersion,
  checkSaveRateLimit,
  markSaveRate,
  checkAuthLock,
  recordAuthFailure,
  clearAuthFailures,
  buildVersionId,
  MAX_VERSIONS,
  MAX_ITEMS,
  SAVE_MIN_INTERVAL_MS,
  AUTH_FAIL_LIMIT,
  isSafeHttpUrl
} from '../functions/_lib/navstore.js'
import {
  createPasswordHash,
  verifyPassword,
  isPasswordHashFormat,
  hashPassword,
  randomSalt,
  PASSWORD_ITERATIONS,
  MIN_PASSWORD_LENGTH
} from '../functions/_lib/password.js'

/** 内存版 KV：接口形状与 Workers KV 对齐（get/put/delete） */
function createMemoryKV() {
  const store = new Map()
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null
    },
    async put(key, value) {
      store.set(key, value)
    },
    async delete(key) {
      store.delete(key)
    },
    _size: () => store.size
  }
}

const okItem = { name: '示例', url: 'https://example.com', tags: ['dev'] }

// ==================== 1. 数据清洗 ====================
{
  const result = sanitizeNav({
    title: '测试站',
    categories: [{ title: '开发工具', filter: ['dev'] }],
    searchEngines: [{ id: 'b', name: 'Bing', url: 'https://www.bing.com/search?q={query}' }],
    items: [okItem],
    pinnedItems: []
  })
  assert.equal(result.ok, true, '合法配置应通过')
  assert.equal(result.nav.items.length, 1)
  assert.equal(result.nav.title, '测试站')
  assert.equal(result.nav.searchEngines[0].id, 'b')
}

{
  // javascript: 协议必须丢弃
  const result = sanitizeNav({
    items: [
      { name: '坏链', url: 'javascript:alert(1)' },
      { name: '好链', url: 'https://example.org' }
    ]
  })
  assert.equal(result.ok, true)
  assert.equal(result.nav.items.length, 1, 'javascript: 链接应被丢弃')
  assert.equal(result.nav.items[0].url, 'https://example.org')
  assert.ok(result.warnings.some((w) => w.includes('已忽略')), '应给出丢弃提示')
}

{
  // 一条可用链接都没有 → 拒绝
  const result = sanitizeNav({ items: [{ name: '坏', url: 'ftp://x' }] })
  assert.equal(result.ok, false)
  assert.ok(result.errors.length > 0)
}

{
  // 超过条数上限 → 直接拒绝（不是静默截断，避免用户以为发布成功）
  const many = Array.from({ length: MAX_ITEMS + 1 }, (_, i) => ({ ...okItem, id: `i${i}` }))
  const result = sanitizeNav({ items: many })
  assert.equal(result.ok, false)
  assert.ok(result.errors[0].includes(String(MAX_ITEMS)))
}

{
  // 非对象输入
  assert.equal(sanitizeNav(null).ok, false)
  assert.equal(sanitizeNav([]).ok, false)
}

{
  // 搜索引擎的 URL 必须带 {query} 且为 http(s)
  const result = sanitizeNav({
    items: [okItem],
    searchEngines: [
      { name: '无占位符', url: 'https://example.com/search' },
      { name: '坏协议', url: 'javascript:alert({query})' },
      { name: '可用', url: 'https://s.example.com/?q={query}' }
    ]
  })
  assert.equal(result.nav.searchEngines.length, 1)
  assert.equal(result.nav.searchEngines[0].name, '可用')
}

assert.equal(isSafeHttpUrl('https://a.com'), true)
assert.equal(isSafeHttpUrl('javascript:alert(1)'), false)
assert.equal(isSafeHttpUrl('data:text/html,x'), false)

// ==================== 2. 版本存储 ====================
{
  const kv = createMemoryKV()
  const nav = { title: 'A', items: [okItem], pinnedItems: [], categories: [], searchEngines: [] }

  const first = await saveNavVersion(kv, nav, { nowMs: 1000, note: '第一次' })
  assert.ok(first.version.startsWith('v-1000-'))
  assert.equal(first.itemCount, 1)

  const current = await readCurrentNav(kv)
  assert.equal(current.nav.title, 'A')
  assert.equal(current.version, first.version)

  const index = await readVersionIndex(kv)
  assert.equal(index.versions.length, 1)
  assert.equal(index.versions[0].note, '第一次')

  // 同毫秒也要能落不同版本号
  const second = await saveNavVersion(kv, nav, { nowMs: 1000, random: () => 0.5 })
  assert.notEqual(second.version, first.version)

  // 快照可读
  const snapshot = await readVersion(kv, first.version)
  assert.equal(snapshot.nav.title, 'A')

  // 非法版本号直接返回 null（不做 KV 查询，避免被构造键探测）
  assert.equal(await readVersion(kv, 'nav:current'), null)
  assert.equal(await readVersion(kv, 'v-abc'), null)
}

{
  // 超过 20 个版本要裁掉最旧的，并且删掉对应快照键
  const kv = createMemoryKV()
  const nav = { title: 'X', items: [okItem] }
  const created = []
  for (let i = 0; i < MAX_VERSIONS + 3; i += 1) {
    const saved = await saveNavVersion(kv, nav, { nowMs: 10_000 + i * 1000 })
    created.push(saved.version)
  }

  const index = await readVersionIndex(kv)
  assert.equal(index.versions.length, MAX_VERSIONS, `索引应只保留 ${MAX_VERSIONS} 个版本`)

  // 最旧三个的快照应已被删除
  for (const old of created.slice(0, 3)) {
    assert.equal(await readVersion(kv, old), null, '被裁掉的版本快照应删除')
  }
  // 最新的仍在
  assert.ok(await readVersion(kv, created[created.length - 1]))
}

// ==================== 3. 回滚 ====================
{
  const kv = createMemoryKV()
  const v1 = await saveNavVersion(kv, { title: '旧标题', items: [okItem] }, { nowMs: 2000 })
  await saveNavVersion(kv, { title: '新标题', items: [okItem] }, { nowMs: 3000 })

  const rolled = await rollbackToVersion(kv, v1.version, { nowMs: 4000 })
  assert.equal(rolled.ok, true)

  const current = await readCurrentNav(kv)
  assert.equal(current.nav.title, '旧标题', '回滚后当前配置应回到旧内容')

  const index = await readVersionIndex(kv)
  assert.equal(index.versions.length, 3, '回滚应生成新版本，历史保留')
  assert.ok(index.versions[0].note.includes(v1.version), '回滚备注应记录来源版本')

  // 回滚不存在的版本
  const missing = await rollbackToVersion(kv, 'v-999999-dead')
  assert.equal(missing.ok, false)
  assert.equal(missing.error, 'version_not_found')
}

// ==================== 4. 防刷 ====================
{
  const kv = createMemoryKV()
  await markSaveRate(kv, 1000)

  const tooSoon = await checkSaveRateLimit(kv, 1000 + SAVE_MIN_INTERVAL_MS - 1)
  assert.equal(tooSoon.allowed, false)
  assert.ok(tooSoon.retryAfterSeconds >= 1)

  const okNow = await checkSaveRateLimit(kv, 1000 + SAVE_MIN_INTERVAL_MS)
  assert.equal(okNow.allowed, true)

  // 没有记录时永远放行（第一次保存）
  const empty = createMemoryKV()
  assert.equal((await checkSaveRateLimit(empty, 0)).allowed, true)
}

// ==================== 5. 登录熔断 ====================
{
  const kv = createMemoryKV()
  const ip = 'abc123'

  for (let i = 1; i < AUTH_FAIL_LIMIT; i += 1) {
    const result = await recordAuthFailure(kv, ip, 1000)
    assert.equal(result.locked, false, `第 ${i} 次失败还不应锁定`)
  }

  const fifth = await recordAuthFailure(kv, ip, 1000)
  assert.equal(fifth.locked, true)

  const lock = await checkAuthLock(kv, ip, 1000)
  assert.equal(lock.locked, true)

  const later = await checkAuthLock(kv, ip, 1000 + 61_000)
  assert.equal(later.locked, false, '锁定到期后应放行')

  await clearAuthFailures(kv, ip)
  assert.equal((await checkAuthLock(kv, ip, 1000)).locked, false, '成功后应清零计数')
}

// ==================== 6. 口令哈希 ====================
{
  assert.ok(MIN_PASSWORD_LENGTH >= 8)

  const stored = await createPasswordHash('correct horse battery staple')
  assert.equal(isPasswordHashFormat(stored), true)
  // 格式带迭代次数：scrypt2$<iters>$<salt>$<hash>
  assert.ok(stored.startsWith('scrypt2$'))
  assert.equal(Number(stored.split('$')[1]), PASSWORD_ITERATIONS)
  // Workers 的 PBKDF2 上限是 10 万次，超了要当场报错而不是等上线 500
  assert.equal(PASSWORD_ITERATIONS <= 100000, true)
  await assert.rejects(() => hashPassword('x', randomSalt(), 120000), RangeError)

  assert.equal(await verifyPassword('correct horse battery staple', stored), true)
  assert.equal(await verifyPassword('wrong password', stored), false)
  assert.equal(await verifyPassword('', stored), false)

  // 两次初始化得到不同盐
  const other = await createPasswordHash('correct horse battery staple')
  assert.notEqual(other, stored)

  // 坏格式一律 false，不抛错
  assert.equal(await verifyPassword('x', 'garbage'), false)
  assert.equal(await verifyPassword('x', 'scrypt1$only'), false)
  assert.equal(isPasswordHashFormat('garbage'), false)
  assert.equal(isPasswordHashFormat(null), false)
}

// ==================== 7. 版本号 ====================
{
  const id = buildVersionId(1234567890, () => 0.999)
  assert.match(id, /^v-1234567890-[0-9a-f]{4}$/)
}

console.log('✓ test-cloud-server：全部断言通过')
