/**
 * test-backup.mjs —— src/utils/backup.js 的单元测试
 *
 * 运行：node --test scripts/test-backup.mjs
 * 不依赖任何第三方测试框架，用 Node 自带的 node:test + node:assert。
 *
 * 覆盖点：
 * - URL 白名单（http/https 之外一律拒绝）
 * - 单条链接的字段校验与 id 去重
 * - 设置项的白名单与类型校验
 * - 备份解析：非法 JSON、非本应用、版本不符、超量截断
 * - 合并策略：同 id 覆盖 / 新 id 新增 / 旧 id 保留 / 总量上限
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isSafeUrl,
  sanitizeItem,
  sanitizeSettings,
  parseBackup,
  mergeNavData,
  MAX_ITEMS
} from '../src/utils/backup.js'

test('isSafeUrl 只放行 http/https', () => {
  assert.equal(isSafeUrl('https://example.com'), true)
  assert.equal(isSafeUrl('http://example.com/a?b=1#c'), true)
  assert.equal(isSafeUrl('  https://example.com  '), true)

  // 下面这些是外部文件最可能塞进来的危险协议
  assert.equal(isSafeUrl('javascript:alert(1)'), false)
  assert.equal(isSafeUrl('JavaScript:alert(1)'), false)
  assert.equal(isSafeUrl('data:text/html,<script>alert(1)</script>'), false)
  assert.equal(isSafeUrl('vbscript:msgbox'), false)
  assert.equal(isSafeUrl('file:///etc/passwd'), false)
  assert.equal(isSafeUrl('ftp://example.com'), false)
  assert.equal(isSafeUrl('example.com'), false) // 缺协议
  assert.equal(isSafeUrl(''), false)
  assert.equal(isSafeUrl(null), false)
  assert.equal(isSafeUrl(123), false)
})

test('sanitizeItem 丢弃缺少名称或链接非法的条目', () => {
  assert.equal(sanitizeItem(null), null)
  assert.equal(sanitizeItem({ url: 'https://a.com' }), null) // 无名称
  assert.equal(sanitizeItem({ name: 'A' }), null) // 无链接
  assert.equal(sanitizeItem({ name: 'A', url: 'javascript:alert(1)' }), null)
  assert.equal(sanitizeItem({ name: '   ', url: 'https://a.com' }), null) // 名称全空白
})

test('sanitizeItem 规范化合法条目', () => {
  const { item } = sanitizeItem({
    id: 'x1',
    name: '  Vite 官网  ',
    url: 'https://vitejs.dev',
    desc: '下一代前端工具链',
    category: '开发工具',
    icon: 'mdi:vitejs',
    tags: ['dev', 'dev', '', '  tools  ']
  })

  assert.equal(item.id, 'x1')
  assert.equal(item.name, 'Vite 官网') // 去掉首尾空格
  assert.equal(item.url, 'https://vitejs.dev')
  assert.deepEqual(item.tags, ['dev', 'tools']) // 去重 + 去空白
})

test('sanitizeItem 对缺失/重复 id 自动生成且不重复', () => {
  const used = new Set()

  const first = sanitizeItem({ name: '我的博客', url: 'https://blog.example.com' }, used)
  const second = sanitizeItem({ name: '我的博客', url: 'https://blog.example.com' }, used)
  const third = sanitizeItem({ id: 'dup', name: 'A', url: 'https://a.com' }, used)
  const fourth = sanitizeItem({ id: 'dup', name: 'B', url: 'https://b.com' }, used)

  assert.ok(first.item.id.startsWith('custom-'))
  assert.notEqual(first.item.id, second.item.id) // 同名同站也不能撞 id
  assert.equal(third.item.id, 'dup')
  assert.notEqual(fourth.item.id, 'dup') // 重复 id 被改写
  assert.equal(used.size, 4)
})

test('sanitizeItem 限制标签数量与长度、忽略非法图标', () => {
  const manyTags = Array.from({ length: 20 }, (_, i) => `tag-${i}`)
  const { item, warnings } = sanitizeItem({
    name: 'A',
    url: 'https://a.com',
    icon: 'not-an-icon',
    tags: manyTags
  })

  assert.equal(item.tags.length, 8)
  assert.equal(item.icon, undefined)
  assert.ok(warnings.some((w) => w.includes('图标')))
})

test('sanitizeSettings 只保留白名单字段并拒绝非法值', () => {
  const { value, warnings } = sanitizeSettings({
    theme: 'pink', // 非法
    accentColor: 'cyan', // 合法
    bgType: 'digital-grid', // 非法（真实 id 是 grid）
    layoutMode: 'masonry', // 非法
    bgOverlay: '0.4', // 字符串但可转数字
    bgImage: 'https://img.example.com/a.png',
    siteTitle: '我的导航',
    searchShortcut: '',
    effects: { glitch: false, scanline: 'yes' }, // 一半非法
    showClock: true,
    showPinned: 'true' // 字符串布尔，非法
  })

  assert.equal(value.theme, undefined)
  assert.equal(value.accentColor, 'cyan')
  assert.equal(value.bgType, undefined)
  assert.equal(value.layoutMode, undefined)
  assert.equal(value.bgOverlay, 0.4)
  assert.equal(value.bgImage, 'https://img.example.com/a.png')
  assert.equal(value.siteTitle, '我的导航')
  assert.equal(value.searchShortcut, undefined)
  assert.deepEqual(value.effects, { glitch: false }) // 非法项被剔除
  assert.equal(value.showClock, true)
  assert.equal(value.showPinned, undefined)

  assert.ok(warnings.length >= 4)
})

test('sanitizeSettings 对超范围数值做夹取', () => {
  assert.equal(sanitizeSettings({ bgOverlay: 5 }).value.bgOverlay, 1)
  assert.equal(sanitizeSettings({ bgOverlay: -3 }).value.bgOverlay, 0)
  assert.equal(sanitizeSettings({ bgOverlay: 'abc' }).value.bgOverlay, undefined)
})

test('parseBackup 拒绝非法 JSON 与非对象', () => {
  assert.throws(() => parseBackup(''), /内容为空/)
  assert.throws(() => parseBackup('   '), /内容为空/)
  assert.throws(() => parseBackup('{oops'), /不是合法的 JSON/)
  assert.throws(() => parseBackup('123'), /顶层应为对象/)
  assert.throws(() => parseBackup('"str"'), /顶层应为对象/)
  assert.throws(() => parseBackup('[]'), /顶层应为对象/)
})

test('parseBackup 对来源与版本只告警不阻断', () => {
  const result = parseBackup(
    JSON.stringify({
      app: 'OtherNav',
      schemaVersion: 99,
      settings: { theme: 'light' },
      navData: { items: [] }
    })
  )

  assert.equal(result.settings.theme, 'light')
  assert.ok(result.warnings.some((w) => w.includes('OtherNav')))
  assert.ok(result.warnings.some((w) => w.includes('99')))
})

test('parseBackup 跳过非法链接并忽略备份中的分类', () => {
  const result = parseBackup(
    JSON.stringify({
      app: 'MyNav',
      schemaVersion: 1,
      settings: {},
      navData: {
        categories: [{ title: '黑客分类' }],
        items: [
          { id: 'ok', name: '合法', url: 'https://ok.com' },
          { id: 'bad1', name: '非法协议', url: 'javascript:alert(1)' },
          { id: 'bad2', url: 'https://no-name.com' },
          'not-an-object'
        ],
        pinnedItems: [{ id: 'p1', name: '置顶', url: 'https://p1.com' }]
      }
    })
  )

  assert.equal(result.navData.items.length, 1)
  assert.equal(result.navData.items[0].id, 'ok')
  assert.equal(result.navData.pinnedItems.length, 1)
  assert.ok(result.warnings.some((w) => w.includes('分类未导入')))
  assert.ok(result.warnings.some((w) => w.includes('已跳过')))
})

test('parseBackup 对超量链接做截断', () => {
  const items = Array.from({ length: MAX_ITEMS + 20 }, (_, i) => ({
    id: `i-${i}`,
    name: `站点 ${i}`,
    url: `https://s${i}.example.com`
  }))

  const result = parseBackup(
    JSON.stringify({ app: 'MyNav', schemaVersion: 1, settings: {}, navData: { items } })
  )

  assert.equal(result.navData.items.length, MAX_ITEMS)
  assert.ok(result.warnings.some((w) => w.includes('上限')))
})

test('mergeNavData：同 id 覆盖、新 id 新增、旧 id 保留', () => {
  const current = {
    items: [
      { id: 'a', name: '旧 A', url: 'https://a.com' },
      { id: 'b', name: 'B', url: 'https://b.com' }
    ],
    pinnedItems: [{ id: 'p1', name: 'P1', url: 'https://p1.com' }]
  }
  const incoming = {
    items: [
      { id: 'a', name: '新 A', url: 'https://a-new.com' },
      { id: 'c', name: 'C', url: 'https://c.com' }
    ],
    pinnedItems: [
      { id: 'p1', name: 'P1 新版', url: 'https://p1-new.com' },
      { id: 'p2', name: 'P2', url: 'https://p2.com' }
    ]
  }

  const { items, pinnedItems, report } = mergeNavData(current, incoming)

  assert.equal(items.length, 3)
  assert.equal(items.find((i) => i.id === 'a').name, '新 A') // 覆盖
  assert.equal(items.find((i) => i.id === 'b').name, 'B') // 保留
  assert.equal(items.find((i) => i.id === 'c').name, 'C') // 新增
  assert.equal(report.added, 1)
  assert.equal(report.updated, 1)

  assert.equal(pinnedItems.length, 2)
  assert.equal(pinnedItems.find((i) => i.id === 'p1').name, 'P1 新版')
  assert.equal(report.pinnedAdded, 1)
})

test('mergeNavData 对空值/非法输入健壮', () => {
  const empty = mergeNavData(null, null)
  assert.deepEqual(empty.items, [])
  assert.deepEqual(empty.pinnedItems, [])
  assert.equal(empty.report.added, 0)

  const filtered = mergeNavData(
    { items: [{ id: 'a', name: 'A', url: 'https://a.com' }, { noId: true }] },
    { items: [{ name: '无 id', url: 'https://x.com' }] }
  )
  assert.equal(filtered.items.length, 1) // 没有 id 的条目在合并阶段被忽略
})

test('mergeNavData 遵守总量上限', () => {
  const current = {
    items: Array.from({ length: MAX_ITEMS }, (_, i) => ({
      id: `c-${i}`,
      name: `C${i}`,
      url: `https://c${i}.com`
    }))
  }
  const incoming = {
    items: [{ id: 'new-one', name: '新', url: 'https://new.com' }]
  }

  const { items, report } = mergeNavData(current, incoming)
  assert.equal(items.length, MAX_ITEMS)
  assert.ok(report.warnings.some((w) => w.includes('超过')))
})
