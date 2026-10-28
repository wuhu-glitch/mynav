/**
 * 单元测试：会话令牌与口令比较（服务端鉴权的核心逻辑）
 *
 * 这些函数跑在 Cloudflare Workers 里，但只依赖 Web 标准 API，
 * 所以可以直接在 Node 里测 —— 不必起 wrangler，也不必连网。
 *
 * 覆盖点：
 *   - 令牌签发/校验往返成功，payload 内容正确
 *   - 密钥不同、签名被改、payload 被改、版本号被改 → 全部拒绝
 *   - 过期令牌被拒（±1 秒边界）
 *   - Cookie 属性齐全：HttpOnly / Secure / SameSite=Strict / Max-Age
 *   - 口令比较：正确通过，错误拒绝，空口令拒绝，长度不同也拒绝
 *
 * 运行：node scripts/test-session-token.mjs
 */
import assert from 'node:assert/strict'
import {
  createSessionToken,
  verifySessionToken,
  timingSafeEqual,
  readCookie,
  buildSessionCookie,
  buildClearCookie,
  COOKIE_NAME,
  SESSION_TTL_SECONDS
} from '../functions/_lib/session.js'
import { comparePassword, readAuthConfig } from '../functions/_lib/auth.js'

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`ok ${passed} - ${name}`)
}
async function checkAsync(name, fn) {
  await fn()
  passed += 1
  console.log(`ok ${passed} - ${name}`)
}

const SECRET = 'test-session-secret-0123456789abcdef'
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0)

await checkAsync('普通口令比较：一致通过', async () => {
  assert.equal(await comparePassword('correct horse battery', 'correct horse battery'), true)
})

await checkAsync('口令比较：不一致拒绝', async () => {
  assert.equal(await comparePassword('wrong', 'correct horse battery'), false)
})

await checkAsync('口令比较：空输入/空预期都拒绝', async () => {
  assert.equal(await comparePassword('', 'correct horse battery'), false)
  assert.equal(await comparePassword('something', ''), false)
  assert.equal(await comparePassword(undefined, 'x'), false)
})

await checkAsync('口令比较：仅前缀相同的近似值被拒', async () => {
  assert.equal(await comparePassword('correct horse batter', 'correct horse battery'), false)
})

check('配置校验：口令过短或密钥过短视为未配置', () => {
  assert.equal(readAuthConfig({}).configured, false)
  assert.equal(readAuthConfig({ MYNAV_ADMIN_PASSWORD: 'admin', MYNAV_SESSION_SECRET: SECRET }).configured, false)
  assert.equal(
    readAuthConfig({ MYNAV_ADMIN_PASSWORD: 'long-enough-pass', MYNAV_SESSION_SECRET: 'short' }).configured,
    false
  )
  assert.equal(
    readAuthConfig({ MYNAV_ADMIN_PASSWORD: 'long-enough-pass', MYNAV_SESSION_SECRET: SECRET }).configured,
    true
  )
})

await checkAsync('令牌往返：签发后校验通过，payload 正确', async () => {
  const token = await createSessionToken(SECRET, NOW)
  const result = await verifySessionToken(token, SECRET, NOW)
  assert.equal(result.valid, true)
  assert.equal(result.payload.sub, 'admin')
  assert.equal(result.payload.exp, Math.floor(NOW / 1000) + SESSION_TTL_SECONDS)
})

await checkAsync('令牌结构：三段 v1.<payload>.<sig>', async () => {
  const token = await createSessionToken(SECRET, NOW)
  const parts = token.split('.')
  assert.equal(parts.length, 3)
  assert.equal(parts[0], 'v1')
})

await checkAsync('密钥不同 → 签名校验失败', async () => {
  const token = await createSessionToken(SECRET, NOW)
  const result = await verifySessionToken(token, `${SECRET}-other`, NOW)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'signature')
})

await checkAsync('签名被篡改 → 拒绝', async () => {
  const token = await createSessionToken(SECRET, NOW)
  const parts = token.split('.')
  const flipped = parts[2].slice(0, -1) + (parts[2].endsWith('A') ? 'B' : 'A')
  const result = await verifySessionToken(`${parts[0]}.${parts[1]}.${flipped}`, SECRET, NOW)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'signature')
})

await checkAsync('payload 被篡改 → 拒绝（先验签再解析）', async () => {
  const token = await createSessionToken(SECRET, NOW)
  const parts = token.split('.')
  const forged = Buffer.from(JSON.stringify({ sub: 'admin', iat: 0, exp: 9999999999 })).toString(
    'base64url'
  )
  const result = await verifySessionToken(`${parts[0]}.${forged}.${parts[2]}`, SECRET, NOW)
  assert.equal(result.valid, false)
})

await checkAsync('过期令牌 → 拒绝', async () => {
  const token = await createSessionToken(SECRET, NOW)
  const laterMs = NOW + (SESSION_TTL_SECONDS + 1) * 1000
  const result = await verifySessionToken(token, SECRET, laterMs)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'expired')
})

await checkAsync('未到过期时间仍有效（边界内）', async () => {
  const token = await createSessionToken(SECRET, NOW)
  const justBeforeMs = NOW + (SESSION_TTL_SECONDS - 1) * 1000
  const result = await verifySessionToken(token, SECRET, justBeforeMs)
  assert.equal(result.valid, true)
})

await checkAsync('缺密钥 / 空令牌 → 拒绝', async () => {
  const token = await createSessionToken(SECRET, NOW)
  assert.equal((await verifySessionToken(token, '', NOW)).valid, false)
  assert.equal((await verifySessionToken('', SECRET, NOW)).valid, false)
  assert.equal((await verifySessionToken('garbage', SECRET, NOW)).valid, false)
})

check('常量时间比较：相同为真，不同为假，长度不同为假', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true)
  assert.equal(timingSafeEqual('abc', 'abd'), false)
  assert.equal(timingSafeEqual('abc', 'abcd'), false)
  assert.equal(timingSafeEqual('', ''), true)
  assert.equal(timingSafeEqual(undefined, 'abc'), false)
})

check('Cookie 解析：能取出目标键，忽略其他键', () => {
  assert.equal(readCookie(`${COOKIE_NAME}=abc; other=1`), 'abc')
  assert.equal(readCookie('other=1'), '')
  assert.equal(readCookie(''), '')
  assert.equal(readCookie(undefined), '')
})

check('会话 Cookie 属性：HttpOnly + Secure + SameSite=Strict + Max-Age', () => {
  const cookie = buildSessionCookie('tok')
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
  assert.match(cookie, new RegExp(`Max-Age=${SESSION_TTL_SECONDS}`))
  assert.match(cookie, /Path=\//)
})

check('清除 Cookie：Max-Age=0 且过期时间为 1970', () => {
  const cookie = buildClearCookie()
  assert.match(cookie, /Max-Age=0/)
  assert.match(cookie, /Expires=Thu, 01 Jan 1970/)
})

console.log(`\n全部通过：${passed} 项`)
