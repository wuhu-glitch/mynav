# 安全说明

MyNav 是一个**纯静态单页应用**：没有后端、没有数据库、没有账号系统，构建产物就是
`index.html` + 一份 `nav.json` + 打包后的 JS/CSS。这份文档说明它的安全边界、
已经做了哪些防护，以及哪些事情它做不到。

## 威胁模型

站点只有两类数据，风险也就来自这两处：

| 数据 | 来源 | 是否可信 |
| --- | --- | --- |
| `nav.json`（分类、链接、搜索引擎、站点标题） | 你提交到仓库，随部署发布 | 受信（只有你能改） |
| `localStorage`（主题偏好、本地增删改的链接、`?admin=1` 开关） | 访客自己的浏览器 | **不可信**，会被扩展、控制台、同源脚本改写 |

因此所有防护都指向同一个目标：**让"不可信数据"没有机会变成可执行代码，或者把用户带到非预期的地址**。

## 已实施的防护

### 1. 内容安全策略（CSP）

由 `public/_headers` 下发，构建后进入 `dist/_headers`：

```
default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: https:; font-src 'self' data:; connect-src 'self';
manifest-src 'self'; base-uri 'none'; form-action 'none';
frame-ancestors 'none'; object-src 'none'; worker-src 'none';
media-src 'none'; child-src 'none'; upgrade-insecure-requests
```

默认全部拒绝，再逐条放开。即使真的出现注入点，`script-src 'self'` 也会挡住内联脚本与
外部脚本，`connect-src 'self'` 挡住数据外传。

`style-src` 里的 `'unsafe-inline'` 是 Vue 的 `:style` 绑定（主题色、背景图、进度条宽度）
所必需的，无法去掉；相应地，样式注入面用下面的 CSS 转义单独处理。

### 2. URL 白名单

`src/utils/url.js` 是全站唯一的"能不能打开"判定：

- 只接受 `http` / `https`，`javascript:` `data:` `vbscript:` `file:` 一律拒绝
- 大小写混写（`JaVaScRiPt:`）同样拒绝
- 卡片跳转前校验；新增/编辑保存前校验；导入备份逐条校验
- 外链统一 `window.open(url, '_blank', 'noopener,noreferrer')`

### 3. CSS 注入面转义

自定义背景图地址会先过 `toSafeCssUrl()`：只接受 `http` / `https` / `data:image/*`，
并把 `"`、`(`、`)` 全部字符实体化，再拼进 `url("…")`。填 `x");background:url(//evil)`
这类内容不会闭合声明。

### 4. 存储读取时的二次校验

`localStorage` 里的本地差异（`mynav-custom-nav`）在读出时会再筛一遍 URL 协议。
理论上这份数据只会被本站写入，但它毕竟在用户可控的存储里，多一道校验成本极低。

### 5. 响应头

| 响应头 | 值 | 作用 |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | 防降级到 HTTP |
| `X-Content-Type-Options` | `nosniff` | 防 MIME 嗅探 |
| `X-Frame-Options` / `frame-ancestors` | `DENY` / `'none'` | 防点击劫持 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 跨站跳转不泄露完整路径 |
| `Permissions-Policy` | 关闭定位/摄像头/麦克风等 | 缩小能力面 |
| `Cross-Origin-Opener-Policy` | `same-origin` | 第三方页面拿不到本站 window |
| `Cross-Origin-Resource-Policy` | `same-origin` | 本站资源不被跨域加载 |
| `X-Permitted-Cross-Domain-Policies` | `none` | 关闭旧式跨域策略文件 |

### 6. 供应链

- 依赖版本**精确锁定**（`package.json` 不带 `^`），CI 与部署统一用 `npm ci`
- 安装与构建在 CI 中禁用安装脚本（`--ignore-scripts`）
- 只有 1 个运行时依赖（`vue`），图标为离线注册的 SVG 数据，不请求第三方 CDN
- `.github/workflows/ci.yml` 在每次推送/PR 跑单测 + 构建 + 产物自检（含 CSP 是否存在）

### 7. 管理员鉴权（服务端，Pages Functions）

编辑与发布入口不再由前端开关决定，改由 `functions/` 下的接口判定：

| 接口 | 方法 | 权限 | 作用 |
| --- | --- | --- | --- |
| `/api/auth` | POST | 公开 | 校验口令（KV 哈希），成功下发会话 Cookie |
| `/api/session` | GET | 公开 | 查询当前 Cookie 是否为有效管理员 |
| `/api/logout` | POST | 公开 | 清除会话 Cookie |
| `/api/nav` (GET) | GET | 公开 | 读云端公共配置 |
| `/api/nav` (POST) | POST | 管理员 | 发布新版本 |
| `/api/versions` | GET | 管理员 | 版本时间轴 |
| `/api/rollback` | POST | 管理员 | 回滚到指定版本 |

实现要点：

- 口令**不以明文存在任何地方**：KV 里是 `scrypt1$<salt>$<hash>`（PBKDF2-SHA256，12 万次迭代，
  16 字节随机盐）；仓库、构建产物、前端代码都不含口令
- 校验走常量时间比较；口令错误路径固定延迟 300ms，抬高在线猜解成本
- 失败按 IP 记在 KV（IP 先做 SHA-256 截断，不存明文地址）：连续 5 次锁 60 秒
- 会话令牌 = `v1.<payload>.<HMAC-SHA256>`，密钥是 `MYNAV_SESSION_SECRET`
- 令牌放在 `HttpOnly; Secure; SameSite=Strict; Max-Age=43200` 的 Cookie 里：
  页面脚本读不到（XSS 也偷不走），跨站请求不带，12 小时后自动失效
- 验签**先于**解析 payload，伪造内容不会进入 `JSON.parse`
- 密钥缺失时返回 503（而不是"放行"），忘记配置不会变成人人可进

`?admin=1` 现在的含义只剩"请打开登录框"，不再授予任何权限 —— 冒烟测试专门断言了
带该参数访问时编辑入口依然不出现。

### 8. 云端数据写入边界（KV）

写接口（`/api/nav` POST、`/api/rollback`）在鉴权之后还有四层约束：

1. **字段白名单**：只保留 `title/subtitle/themeColor/categories/searchEngines/items/pinnedItems`，
   条目只留 `id/name/url/icon/desc/tags/category`，未知字段直接丢弃；
2. **协议白名单**：链接与搜索引擎必须 `http(s)`，含 javascript:/data: 的条目整条丢弃，
   清洗后一条都不剩则拒绝整次发布（不静默写空数据）；
3. **体积与数量**：提交体上限 200KB、链接总数上限 500，超出返回 413/422；
4. **频率**：两次保存（含回滚）最短间隔 8 秒，返回 429 并带 `Retry-After`。

每次写入都会先落一个快照再更新当前指针，索引只保留最近 20 个版本；回滚不删历史，
而是把旧内容重新发布成新版本（备注「回滚自 v-xxx」），保证审计链连续。

## 已知边界（做不到的部分）

### 单管理员模型，没有权限分级

系统只有一个管理员口令：能登录的人就能改全站配置、能回滚历史版本。
没有「只读管理员」「审计员」这类角色，也没有多人协作时的操作者标识 ——
KV 里只记录版本与时间，不记录"是谁改的"（只有一个身份，记了也没有区分度）。

### KV 最终一致 + 无并发写保护

- Cloudflare KV 的写入在全球边缘是最终一致的，跨区域可见可能有秒级延迟；
- 两个管理员同时保存时是「后写覆盖」，没有乐观锁或冲突提示 ——
  依赖版本快照事后回滚来兜底，而不是事前阻止。

### 会话没有服务端吊销名单

退出登录清的是浏览器 Cookie，令牌在 12 小时内仍然有效（签名自校验，服务端不维护黑名单）。
口令泄露时，正确的处置是**换口令 + 换 `MYNAV_SESSION_SECRET`**，后者会让所有旧令牌立即失效。

### CSRF 依赖 Cookie 属性而非令牌

写接口没有 CSRF token，防线是：`SameSite=Strict`（跨站请求不带 Cookie）+
强制 `Content-Type: application/json`（简单表单提交打不进来）。这在现代浏览器上够用，
但如果未来要支持很老的浏览器，需要补显式 CSRF token。

### 口令爆破的兜底在 Cloudflare 侧

Pages Functions 无状态，无法在函数内做跨请求计数，因此：

- 口令长度要求 ≥ 8（`readAuthConfig` 里校验），建议 16 位以上随机串；
- 请在 Cloudflare 控制台给 `/api/auth` 配 **Rate Limiting** 规则（例如每分钟 10 次），
  这是防爆破最有效的一层。

### `localStorage` 的范围

同一浏览器、同一域名下的数据是同源共享的。如果以后把它部署到和别的项目相同的
主机名下（比如挂在 `example.com/mynav/` 的子路径），需要注意存储键冲突与同源脚本互信。
建议保持独立子域（`mynav.pages.dev` 或 `nav.yourdomain.com`）。

### 无法阻止的

- 用户自己往卡片里填一个恶意站点地址（这是他主动点的外链，浏览器层面无法拦截）
- 浏览器扩展读取 `localStorage`（扩展权限高于网页）
- 目标站点自身的安全问题

## 部署时建议在 Cloudflare 侧一并打开

这几项在 Cloudflare 控制台，代码管不到：

1. **SSL/TLS → Edge Certificates → Always Use HTTPS**：开
2. **Minimum TLS Version**：1.2 或更高
3. **Security Level**：Medium 以上
4. **Bot Fight Mode**：可开（静态站不会被误伤）
5. 若绑定自有域名，打开 **HSTS** 并考虑 preload（注意 preload 不可快速撤销）

## 报告问题

发现安全问题时，请勿公开提交 issue，直接联系仓库维护者（见仓库主页联系方式），
并附上复现步骤与影响范围。修复前请不要公开细节。
