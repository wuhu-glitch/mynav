/**
 * navDiff.js 的单元测试。
 * 运行：node scripts/test-nav-diff.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyDiff,
  normalizeDiff,
  applyDiff,
  withOverride,
  withDeletion,
  diffFromItems
} from '../src/utils/navDiff.js'

const base = [
  { id: 'a', name: 'A', url: 'https://a.com', tags: ['dev'] },
  { id: 'b', name: 'B', url: 'https://b.com', tags: ['dev'] },
  { id: 'c', name: 'C', url: 'https://c.com', tags: ['learn'] }
]

test('normalizeDiff 对垃圾输入降级为空差异', () => {
  for (const raw of [null, undefined, 0, 'x', [], [{ id: 'a' }]]) {
    const diff = normalizeDiff(raw)
    assert.deepEqual(diff, { overrides: [], deleted: [] })
  }
})

test('normalizeDiff 过滤非法 id 与重复项', () => {
  const diff = normalizeDiff({
    overrides: [
      { id: 'a', name: 'A' },
      { id: 'a', name: 'A2' },
      { name: 'no-id' },
      { id: '', name: 'empty' },
      { id: 123, name: 'num' },
      null
    ],
    deleted: ['b', 'b', 42, '']
  })
  assert.deepEqual(diff.overrides.map((i) => i.id), ['a'])
  assert.equal(diff.overrides[0].name, 'A')
  assert.deepEqual(diff.deleted, ['b'])
})

test('applyDiff：删除剔除、同 id 替换但保持位置、新增追加末尾', () => {
  const diff = {
    overrides: [
      { id: 'b', name: 'B2', url: 'https://b2.com' },
      { id: 'z', name: 'Z', url: 'https://z.com' }
    ],
    deleted: ['c']
  }
  const items = applyDiff(base, diff)

  assert.deepEqual(items.map((i) => i.id), ['a', 'b', 'z'])
  assert.equal(items[1].name, 'B2', 'b 应被替换为新内容且仍在原位')
  assert.equal(items[2].id, 'z')
})

test('applyDiff 不会修改传入的基准数组', () => {
  const snapshot = JSON.stringify(base)
  applyDiff(base, { overrides: [{ id: 'a', name: 'X' }], deleted: ['b'] })
  assert.equal(JSON.stringify(base), snapshot)
})

test('applyDiff：删除优先于修改（同 id 既删又改）', () => {
  const items = applyDiff(base, {
    overrides: [{ id: 'a', name: 'A2' }],
    deleted: ['a']
  })
  assert.deepEqual(items.map((i) => i.id), ['b', 'c'])
})

test('withOverride 会取消同 id 的删除标记', () => {
  const diff = withOverride(withDeletion(emptyDiff(), 'a'), { id: 'a', name: 'A3' })
  assert.deepEqual(diff.deleted, [])
  assert.deepEqual(diff.overrides.map((i) => i.id), ['a'])
  assert.deepEqual(applyDiff(base, diff).map((i) => i.id), ['a', 'b', 'c'])
})

test('withOverride 对同 id 只保留最后一次内容', () => {
  const diff = withOverride(withOverride(emptyDiff(), { id: 'a', name: 'v1' }), {
    id: 'a',
    name: 'v2'
  })
  assert.equal(diff.overrides.length, 1)
  assert.equal(diff.overrides[0].name, 'v2')
})

test('withDeletion 同时移除 override 并去重', () => {
  let diff = withOverride(emptyDiff(), { id: 'a', name: 'A9' })
  diff = withDeletion(diff, 'a')
  diff = withDeletion(diff, 'a')
  assert.deepEqual(diff.overrides, [])
  assert.deepEqual(diff.deleted, ['a'])
})

test('withOverride / withDeletion 对非法 id 不生效', () => {
  assert.deepEqual(withOverride(emptyDiff(), { name: 'x' }), emptyDiff())
  assert.deepEqual(withDeletion(emptyDiff(), 42), emptyDiff())
})

test('diffFromItems：内容相同的条目不产生差异', () => {
  const diff = diffFromItems(base, structuredClone(base))
  assert.deepEqual(diff, { overrides: [], deleted: [] })
})

test('diffFromItems：修改、新增、缺失分别落成 override / deleted', () => {
  const next = [
    { id: 'a', name: 'A2', url: 'https://a2.com', tags: ['tools'] },
    { id: 'b', name: 'B', url: 'https://b.com', tags: ['dev'] },
    { id: 'new-1', name: '新站', url: 'https://new.com', tags: ['dev'] }
  ]
  const diff = diffFromItems(base, next)

  assert.deepEqual(diff.overrides.map((i) => i.id), ['a', 'new-1'])
  assert.deepEqual(diff.deleted, ['c'], '基准有、传入没有的 c 应被标记删除')
  assert.deepEqual(applyDiff(base, diff).map((i) => i.id), ['a', 'b', 'new-1'])
})

test('diffFromItems 对空值健壮', () => {
  assert.deepEqual(diffFromItems(null, null), { overrides: [], deleted: [] })
  assert.deepEqual(diffFromItems(base, []), { overrides: [], deleted: ['a', 'b', 'c'] })
  assert.deepEqual(diffFromItems([], base).overrides.map((i) => i.id), ['a', 'b', 'c'])
})

test('差异经过 JSON 往返后仍然可用（模拟 localStorage）', () => {
  const diff = withOverride(withDeletion(emptyDiff(), 'c'), { id: 'a', name: 'A2' })
  const restored = normalizeDiff(JSON.parse(JSON.stringify(diff)))
  assert.deepEqual(applyDiff(base, restored).map((i) => i.id), ['a', 'b'])
})
