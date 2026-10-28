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

## 已知边界（做不到的部分）

### `?admin=1` 不是鉴权

默认只读、带 `?admin=1` 才出现编辑入口，这只是一个**防误触开关**，不是权限系统。
纯静态站没有服务端，任何人手动加上这个参数都能给自己开编辑入口。

影响范围有限：改动只写入**他自己浏览器**的 `localStorage`，线上 `nav.json` 只读，
别人看不到、也改不了你的仓库。要真正防越权，需要服务端鉴权或 Cloudflare Access，
那就不再是"纯静态"。

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
