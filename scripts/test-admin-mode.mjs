/**
 * test-admin-mode.mjs —— 只读/管理员判定的单元测试
 *
 * 覆盖 resolveAdmin 的边界：没有参数时默认只读、各种写法能开启、
 * `0` 能真正关掉已记住的管理员状态。
 * 运行：node scripts/test-admin-mode.mjs（退出码非 0 表示失败）
 */
import assert from 'node:assert/strict'
import { resolveAdmin } from '../src/utils/adminMode.js'

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`    ${error.message}`)
  }
}

console.log('resolveAdmin')

check('没有任何参数且没记住过 → 只读', () => {
  assert.equal(resolveAdmin('', false).admin, false)
})

check('问号都没有时也能解析', () => {
  assert.equal(resolveAdmin('admin=1', false).admin, true)
})

check('?admin=1 开启，并标记为显式指定', () => {
  const r = resolveAdmin('?admin=1', false)
  assert.equal(r.admin, true)
  assert.equal(r.explicit, true)
})

check('大小写与空白不影响判定', () => {
  assert.equal(resolveAdmin('?ADMIN=YES', false).admin, true)
  assert.equal(resolveAdmin('?admin=%201%20', false).admin, true)
})

check('true / yes 也算开启', () => {
  assert.equal(resolveAdmin('?admin=true', false).admin, true)
  assert.equal(resolveAdmin('?admin=yes', false).admin, true)
})

check('?admin=0 关掉已记住的管理员', () => {
  const r = resolveAdmin('?admin=0', true)
  assert.equal(r.admin, false)
  assert.equal(r.explicit, true)
})

check('false / no 同样能关掉', () => {
  assert.equal(resolveAdmin('?admin=false', true).admin, false)
  assert.equal(resolveAdmin('?admin=no', true).admin, false)
})

check('无关参数不影响上次记住的状态', () => {
  const r = resolveAdmin('?utm_source=x&admin=', true)
  assert.equal(r.admin, true)
  assert.equal(r.explicit, false)
})

check('无法识别的值按“未显式指定”处理', () => {
  const r = resolveAdmin('?admin=maybe', true)
  assert.equal(r.admin, true)
  assert.equal(r.explicit, false)
})

check('admin 与其它参数共存时仍能识别', () => {
  assert.equal(resolveAdmin('?foo=bar&admin=1&baz=2', false).admin, true)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
