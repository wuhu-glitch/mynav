/**
 * 单元测试：adminMode 的纯函数部分（不触网、不碰 DOM）
 *
 * 覆盖点：
 *   - wantsAdminLogin 只认 1/true/yes，且大小写不敏感
 *   - 其他取值（0/false/no/空/无参数）一律不算"请求登录"
 *   - stripAdminParam 只删 admin 参数，保留其余参数与 hash
 *   - 端点常量指向 /api/*（不能回退成 localStorage 方案）
 *
 * 运行：node scripts/test-admin-mode.mjs
 */
import assert from 'node:assert/strict'
import {
  wantsAdminLogin,
  stripAdminParam,
  ADMIN_QUERY_KEY,
  SESSION_ENDPOINT,
  AUTH_ENDPOINT,
  LOGOUT_ENDPOINT
} from '../src/utils/adminMode.js'

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`ok ${passed} - ${name}`)
}

check('端点都指向 /api/*', () => {
  assert.equal(SESSION_ENDPOINT, '/api/session')
  assert.equal(AUTH_ENDPOINT, '/api/auth')
  assert.equal(LOGOUT_ENDPOINT, '/api/logout')
  assert.equal(ADMIN_QUERY_KEY, 'admin')
})

check('?admin=1 请求登录', () => {
  assert.equal(wantsAdminLogin('?admin=1'), true)
})

check('?admin=true / yes 也认', () => {
  assert.equal(wantsAdminLogin('?admin=true'), true)
  assert.equal(wantsAdminLogin('?admin=YES'), true)
})

check('参数名大小写不敏感', () => {
  assert.equal(wantsAdminLogin('?Admin=1'), true)
  assert.equal(wantsAdminLogin('?ADMIN=true'), true)
})

check('?admin=0 / false / no 不请求登录', () => {
  assert.equal(wantsAdminLogin('?admin=0'), false)
  assert.equal(wantsAdminLogin('?admin=false'), false)
  assert.equal(wantsAdminLogin('?admin=no'), false)
})

check('空值 / 无参数 / 其他参数 不请求登录', () => {
  assert.equal(wantsAdminLogin(''), false)
  assert.equal(wantsAdminLogin(), false)
  assert.equal(wantsAdminLogin('?q=vite'), false)
  assert.equal(wantsAdminLogin('?admin='), false)
})

check('stripAdminParam 删掉 admin，保留其他参数与 hash', () => {
  assert.equal(stripAdminParam('https://nav.example.com/?admin=1&q=vite#top'), '/?q=vite#top')
})

check('stripAdminParam 大小写键也删', () => {
  assert.equal(stripAdminParam('https://nav.example.com/?ADMIN=true&q=vite'), '/?q=vite')
})

check('stripAdminParam 无 admin 时保持原样', () => {
  assert.equal(stripAdminParam('https://nav.example.com/?q=vite'), '/?q=vite')
  assert.equal(stripAdminParam('https://nav.example.com/'), '/')
})

check('stripAdminParam 落在子路径上也正确', () => {
  assert.equal(stripAdminParam('https://nav.example.com/sub/?admin=1'), '/sub/')
})

console.log(`\n全部通过：${passed} 项`)
