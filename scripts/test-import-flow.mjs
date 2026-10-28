/**
 * 导入流程的集成测试：串起「解析 → 合并 → 差异 → 重建」四步，
 * 模拟 App.vue 的 handleImport 实际顺序（不含 DOM 与 localStorage）。
 *
 * 运行：node scripts/test-import-flow.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBackup, mergeNavData } from '../src/utils/backup.js'
import { normalizeDiff, applyDiff, diffFromItems } from '../src/utils/navDiff.js'

// 当前站点从 nav.json 加载到的原始数据
const baseItems = [
  { id: 'vue', name: 'Vue', url: 'https://vuejs.org', tags: ['dev'] },
  { id: 'figma', name: 'Figma', url: 'https://figma.com', tags: ['design'] }
]
const basePinned = [{ id: 'gh', name: 'GitHub', url: 'https://github.com', tags: ['dev'] }]

// 用户导出的备份：改了一条、加了一条、置顶加一条
const backup = {
  app: 'MyNav',
  schemaVersion: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  settings: { theme: 'dark', accentColor: 'magenta' },
  navData: {
    categories: [{ title: '不该被导入' }],
    items: [
      { id: 'vue', name: 'Vue 3', url: 'https://cn.vuejs.org', tags: ['dev'] },
      { id: 'astro', name: 'Astro', url: 'https://astro.build', tags: ['dev', 'tools'] },
      { id: 'bad', name: '坏链接', url: 'javascript:alert(1)' }
    ],
    pinnedItems: [{ id: 'notion', name: 'Notion', url: 'https://notion.so', tags: ['tools'] }]
  }
}

test('导入流程：非法条目被跳过，合法条目完成合并与持久化重建', () => {
  const parsed = parseBackup(JSON.stringify(backup))

  // 1) 分类被忽略、坏链接被跳过
  assert.equal(parsed.settings.accentColor, 'magenta')
  assert.deepEqual(parsed.navData.items.map((i) => i.id), ['vue', 'astro'])
  assert.ok(parsed.warnings.some((w) => w.includes('已跳过')), '非法链接应产生跳过告警')

  // 2) 与当前数据合并
  const merged = mergeNavData(
    { items: baseItems, pinnedItems: basePinned },
    parsed.navData
  )
  assert.deepEqual(merged.items.map((i) => i.id), ['vue', 'figma', 'astro'])
  assert.equal(merged.report.added, 1)
  assert.equal(merged.report.updated, 1)

  // 3) 计算差异（只记录改动，未变的 figma 不该进 overrides）
  const diff = diffFromItems(baseItems, merged.items)
  assert.deepEqual(diff.overrides.map((i) => i.id), ['vue', 'astro'])
  assert.deepEqual(diff.deleted, [])

  // 4) 差异经 localStorage 往返后重建，结果与合并结果一致
  const restored = normalizeDiff(JSON.parse(JSON.stringify(diff)))
  const rebuilt = applyDiff(baseItems, restored)
  assert.deepEqual(rebuilt.map((i) => i.id), ['vue', 'figma', 'astro'])
  assert.equal(rebuilt[0].name, 'Vue 3')

  // 5) 置顶项同样按差异记录
  const pinnedDiff = diffFromItems(basePinned, merged.pinnedItems)
  assert.deepEqual(applyDiff(basePinned, pinnedDiff).map((i) => i.id), ['gh', 'notion'])
})

test('导入流程：用户删掉的链接在重建后确实消失', () => {
  // 用户在页面上删了 figma
  const diff = diffFromItems(baseItems, [baseItems[0]])
  const rebuilt = applyDiff(baseItems, normalizeDiff(JSON.parse(JSON.stringify(diff))))
  assert.deepEqual(rebuilt.map((i) => i.id), ['vue'])
})
