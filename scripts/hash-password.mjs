/**
 * 生成管理员口令哈希，用于写入 Cloudflare KV（键 auth:password）
 *
 * 用法：
 *   npm run hash-password -- "你的口令"
 * 输出示例：
 *   scrypt1$kZ3...$9fA...
 *
 * 拿到输出后：
 *   npx wrangler kv key put "auth:password" "scrypt1$..." \
 *     --namespace-id=<你的 KV namespace id> --remote
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
console.log(hash)
