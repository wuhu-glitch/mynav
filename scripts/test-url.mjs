/**
 * test-url.mjs —— URL 安全工具的单元测试
 *
 * 覆盖三类风险：
 *   1. 跳转白名单：javascript: / data: / vbscript: / file: 必须被拒
 *   2. 省略协议的输入（github.com）要补成 https
 *   3. 自定义背景图的 CSS 注入面：输入里带 `");` 不能闭合 url()
 *
 * 运行：node scripts/test-url.mjs（退出码非 0 表示失败）
 */
import assert from 'node:assert/strict'
import { isSafeUrl, normalizeUrl, isSafeImageSource, toSafeCssUrl } from '../src/utils/url.js'

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

console.log('isSafeUrl')

check('https 放行', () => assert.equal(isSafeUrl('https://github.com'), true))
check('http 放行', () => assert.equal(isSafeUrl('http://example.com'), true))
check('javascript: 拒绝', () => assert.equal(isSafeUrl('javascript:alert(1)'), false))
check('大小写混写的 JavaScript: 也拒绝', () => assert.equal(isSafeUrl('JaVaScRiPt:alert(1)'), false))
check('data: 拒绝', () => assert.equal(isSafeUrl('data:text/html,<script>alert(1)</script>'), false))
check('vbscript: 拒绝', () => assert.equal(isSafeUrl('vbscript:msgbox(1)'), false))
check('file: 拒绝', () => assert.equal(isSafeUrl('file:///C:/Windows/win.ini'), false))
check('带前后空格的正常地址放行', () => assert.equal(isSafeUrl('  https://a.b/c  '), true))
check('非字符串与空串拒绝', () => {
  assert.equal(isSafeUrl(null), false)
  assert.equal(isSafeUrl(undefined), false)
  assert.equal(isSafeUrl(''), false)
  assert.equal(isSafeUrl('   '), false)
  assert.equal(isSafeUrl(123), false)
})

console.log('normalizeUrl')

check('省略协议自动补 https', () => {
  assert.equal(normalizeUrl('github.com'), 'https://github.com')
})
check('已带 https 原样保留', () => {
  assert.equal(normalizeUrl('https://github.com/a?b=1'), 'https://github.com/a?b=1')
})
check('javascript: 规范化后为空串（表示不可保存）', () => {
  assert.equal(normalizeUrl('javascript:alert(1)'), '')
})
check('mailto 不在白名单内', () => {
  assert.equal(normalizeUrl('mailto:a@b.com'), '')
})
check('空输入返回空串', () => {
  assert.equal(normalizeUrl('   '), '')
  assert.equal(normalizeUrl(null), '')
})

console.log('isSafeImageSource / toSafeCssUrl')

check('http 图片放行', () => assert.equal(isSafeImageSource('https://a.b/c.png'), true))
check('data:image 放行', () => assert.equal(isSafeImageSource('data:image/png;base64,AAA'), true))
check('data:text/html 拒绝', () => assert.equal(isSafeImageSource('data:text/html,<b>x</b>'), false))
check('javascript: 背景图拒绝', () => assert.equal(isSafeImageSource('javascript:alert(1)'), false))

check('正常地址被包进 url("...")', () => {
  assert.equal(toSafeCssUrl('https://a.b/c.png'), 'url("https://a.b/c.png")')
})
check('带引号/括号的注入串被转义，不会闭合 url()', () => {
  const evil = 'https://a.b/x");background:url(//evil.tld/p'
  const css = toSafeCssUrl(evil)
  assert.ok(css.startsWith('url("'), css)
  assert.ok(css.endsWith('")'), css)
  // 关键：中间不能出现裸的 `"` 或 `(`，否则 CSS 解析会跑出当前声明
  const inner = css.slice(5, -2)
  assert.equal(inner.includes('"'), false, `仍含裸引号: ${inner}`)
  assert.equal(inner.includes('('), false, `仍含裸括号: ${inner}`)
  assert.equal(inner.includes(')'), false, `仍含裸右括号: ${inner}`)
})
check('不安全来源返回空串（样式层直接忽略）', () => {
  assert.equal(toSafeCssUrl('javascript:alert(1)'), '')
  assert.equal(toSafeCssUrl(''), '')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
