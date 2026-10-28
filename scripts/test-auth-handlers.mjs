/**
 * 集成测试：把三个 Pages Functions 当普通函数调用一遍
 *
 * Pages Functions 的签名是 ({ request, env }) => Response，只依赖 Web 标准
 * Request/Response，所以可以在 Node 里直接调用 —— 不用起 wrangler，也不用连网。
 *
 * 覆盖的完整链路：
 *   1. 未配置环境变量 → 503（并且不下发 Cookie）
 *   2. 口令错误 → 401，下发不了会话
 *   3. 口令正确 → 200 + Set-Cookie（含 HttpOnly / Secure / SameSite=Strict）
 *   4. 拿这个 Cookie 问 /api/session → admin: true
 *   5. 篡改 Cookie → admin: false
 *   6. /api/logout → 清 Cookie
 *   7. 错误方法 → 405、错误 Content-Type → 415
 *
 * 运行：node scripts/test-auth-handlers.mjs
 */
import assert from 'node:assert/strict'
import { onRequestPost as authPost, onRequest as authFallback } from '../functions/api/auth.js'
import { onRequestGet as sessionGet } from '../functions/api/session.js'
import { onRequestPost as logoutPost } from '../functions/api/logout.js'

let passed = 0
async function check(name, fn) {
  await fn()
  passed += 1
  console.log(`ok ${passed} - ${name}`)
}

const ENV = {
  MYNAV_ADMIN_PASSWORD: 'local-test-password',
  MYNAV_SESSION_SECRET: 'local-test-secret-0123456789abcdef'
}

/** 构造一个登录请求 */
function authRequest(password, contentType = 'application/json') {
  return new Request('https://nav.example.com/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: JSON.stringify({ password })
  })
}

const setCookieOf = (response) => response.headers.get('Set-Cookie') || ''
const sessionTokenOf = (response) => {
  const cookie = setCookieOf(response)
  const match = cookie.match(/mynav_admin=([^;]+)/)
  return match ? match[1] : ''
}

await check('未配置环境变量 → 503 且不下发 Cookie', async () => {
  const response = await authPost({ request: authRequest('anything'), env: {} })
  assert.equal(response.status, 503)
  assert.equal(setCookieOf(response), '')
  const body = await response.json()
  assert.equal(body.error, 'not_configured')
})

await check('口令错误 → 401 且不下发 Cookie', async () => {
  const response = await authPost({ request: authRequest('wrong-password'), env: ENV })
  assert.equal(response.status, 401)
  assert.equal(setCookieOf(response), '')
  assert.equal((await response.json()).error, 'invalid_credentials')
})

await check('口令为空串 → 401', async () => {
  const response = await authPost({ request: authRequest(''), env: ENV })
  assert.equal(response.status, 401)
})

await check('Content-Type 不是 JSON → 415', async () => {
  const response = await authPost({ request: authRequest('x', 'text/plain'), env: ENV })
  assert.equal(response.status, 415)
})

await check('方法不是 POST → 405', async () => {
  const response = await authFallback({
    request: new Request('https://nav.example.com/api/auth', { method: 'GET' }),
    env: ENV
  })
  assert.equal(response.status, 405)
  assert.equal(response.headers.get('Allow'), 'POST')
})

// 复用一次成功登录的 Cookie，后续几条都基于它
let validCookie = ''
await check('口令正确 → 200 + HttpOnly/Secure/SameSite=Strict Cookie', async () => {
  const response = await authPost({ request: authRequest(ENV.MYNAV_ADMIN_PASSWORD), env: ENV })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.expiresIn, 12 * 60 * 60)

  const cookie = setCookieOf(response)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
  assert.match(cookie, /Path=\//)
  assert.ok(sessionTokenOf(response).length > 20, '会话令牌过短')

  validCookie = `mynav_admin=${sessionTokenOf(response)}`
})

await check('带有效 Cookie 问 /api/session → admin: true', async () => {
  const response = await sessionGet({
    request: new Request('https://nav.example.com/api/session', {
      headers: { Cookie: validCookie }
    }),
    env: ENV
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.admin, true)
  assert.equal(body.configured, true)
})

await check('没有 Cookie / 篡改 Cookie → admin: false', async () => {
  const noCookie = await sessionGet({
    request: new Request('https://nav.example.com/api/session'),
    env: ENV
  })
  assert.equal((await noCookie.json()).admin, false)

  const token = sessionTokenOf(
    await authPost({ request: authRequest(ENV.MYNAV_ADMIN_PASSWORD), env: ENV })
  )
  const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`
  const forged = await sessionGet({
    request: new Request('https://nav.example.com/api/session', {
      headers: { Cookie: `mynav_admin=${tampered}` }
    }),
    env: ENV
  })
  assert.equal((await forged.json()).admin, false)
})

await check('服务端未配置时 /api/session 报 configured: false', async () => {
  const response = await sessionGet({
    request: new Request('https://nav.example.com/api/session'),
    env: {}
  })
  const body = await response.json()
  assert.equal(body.admin, false)
  assert.equal(body.configured, false)
})

await check('/api/logout → 清空 Cookie（Max-Age=0）', async () => {
  const response = await logoutPost({ request: new Request('https://nav.example.com/api/logout', { method: 'POST' }), env: ENV })
  assert.equal(response.status, 200)
  const cookie = setCookieOf(response)
  assert.match(cookie, /Max-Age=0/)
  assert.equal((await response.json()).ok, true)
})

await check('鉴权响应一律 no-store，避免中间缓存', async () => {
  const response = await authPost({ request: authRequest('wrong'), env: ENV })
  assert.match(response.headers.get('Cache-Control') || '', /no-store/)
})

console.log(`\n全部通过：${passed} 项`)
