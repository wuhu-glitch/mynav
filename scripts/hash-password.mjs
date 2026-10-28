/**
 * 生成管理员口令哈希，用于写入 Cloudflare KV（键 auth:password）
 *
 * 用法：
 *   npm run hash-password -- "你的口令"
 * 输出示例（一整个 JSON）：
 *   {"hash":"scrypt1$kZ3...$9fA...","updatedAt":"2026-10-28T11:20:00.000Z"}
 *
 * 为什么输出 JSON 而不是裸哈希（踩过的坑）：
 *   服务端是用 readJson(kv, 'auth:password') 读的，拿到的是对象并取 `.hash` 字段。
 *   如果只把 "scrypt1$..." 裸串写进去，readJson 解析失败返回 null，
 *   于是登录接口永远报「未初始化管理员口令」。
 *
 * 拿到输出后二选一写入：
 *   1) 命令行（把下面整行 JSON 作为值）：
 *      npx wrangler kv key put "auth:password" "{\"hash\":\"scrypt1$...\"}" \
 *        --namespace-id=<你的 KV namespace id> --remote
 *   2) 控制台：KV → mynav-kv → 添加条目，键 auth:password，值粘整段 JSON
 *
 * 注意：
 *   - 口令只在本机命令行出现一次，不写进仓库、不写进构建产物；
 *   - 同一个口令每次生成的哈希不同（随机盐），属正常现象，覆盖旧的即可。
 */
import { createPasswordHash, MIN_PASSWORD_LENGTH } from '../functions/_lib/password.js'

const password = process.argv[2]

if (!password) {
  console.error('用法：npm run hash-password -- "你的口令"')
  process.exit(1)
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`口令至少 ${MIN_PASSWORD_LENGTH} 位（这是唯一的屏障，别用短口令）`)
  process.exit(1)
}

const hash = await createPasswordHash(password)
console.log(JSON.stringify({ hash, updatedAt: new Date().toISOString() }))
