# MyNav 个人导航站

基于 Vue 3 + Vite + Tailwind CSS 的赛博朋克风格个人导航站，适配 Cloudflare Pages 免费托管。

## 🚀 特性

- ✨ **赛博朋克视觉**：霓虹配色、故障特效、扫描线、电路板纹理
- 🎨 **自定义主题**：主题色、背景、布局、文字特效完全可配置
- 🔍 **快捷搜索**：支持多搜索引擎切换、实时过滤、快捷键聚焦
- 📂 **智能分类**：标签分类、分类筛选、置顶快捷入口
- 📝 **可视化编辑**：添加/编辑/删除链接，JSON 导入导出备份
- 💾 **本地存储**：所有设置保存于浏览器 localStorage，隐私优先
- 📱 **完全响应式**：PC/平板/手机自动适配，移动端自动弱化特效
- ⚡ **零依赖**：无后端、无数据库、无笨重 UI 库
- 🌍 **部署即用**：导出 `dist` 目录上传 Cloudflare Pages 即可

## 📦 技术栈

- **框架**：Vue 3 (Composition API + `<script setup>`)
- **构建工具**：Vite
- **样式框架**：Tailwind CSS v3
- **图标库**：Iconify (在线图标)
- **样式自定义**：CSS 变量 + 自定义特效

## 🏗️ 项目结构

```
mynav/
├── index.html                      # HTML 入口
├── package.json                    # 项目依赖配置
├── vite.config.js                  # Vite 构建配置
├── tailwind.config.js              # Tailwind 赛博主题配置
├── README.md                       # 项目说明文档
├── MyNav-架构设计.md               # 架构设计文档
├── public/
│   ├── nav.json                    # 导航数据源（核心配置）
│   ├── _headers                    # Cloudflare 安全响应头 / 缓存策略
│   ├── _redirects                  # SPA 回退规则
│   └── _routes.json                # Functions 路由声明（只让 /api/* 走函数）
├── functions/                      # Cloudflare Pages Functions（鉴权 + 云端公共配置）
│   ├── _lib/
│   │   ├── session.js              # 会话令牌签发/校验（HMAC + 常量时间比较）
│   │   ├── auth.js                 # 口令摘要比较、统一 JSON 响应
│   │   ├── password.js             # 口令哈希（PBKDF2 加盐，存 KV）
│   │   ├── navstore.js             # KV 存储层：清洗、版本、回滚、限频、登录熔断
│   │   └── admin.js                # requireAdmin / 客户端 IP 折键
│   └── api/
│       ├── auth.js                 # POST /api/auth     登录换会话
│       ├── session.js              # GET  /api/session  查询身份
│       ├── logout.js               # POST /api/logout   退出
│       ├── nav.js                  # GET/POST /api/nav  读配置 / 发布版本
│       ├── versions.js             # GET  /api/versions 版本时间轴
│       └── rollback.js             # POST /api/rollback 回滚
├── wrangler.toml                   # 本地 Pages Functions + KV 绑定配置
└── src/
    ├── assets/styles/main.css      # 全局样式 + 霓虹特效
    ├── App.vue                     # 根组件（主界面）
    ├── main.js                     # 应用入口
    ├── components/                 # UI 组件
    │   ├── Header.vue              # 导航头部
    │   ├── Footer.vue              # 页脚
    │   ├── SearchBar.vue           # 搜索框
    │   ├── CategoryGroup.vue       # 分类标签
    │   ├── LinkCard.vue            # 链接卡片
    │   ├── Clock.vue               # 赛博时钟
    │   ├── CyberEffect.vue         # 赛博特效开关
    │   ├── SettingsPanel.vue       # 设置面板
    │   ├── EditModal.vue           # 编辑弹窗
    │   ├── CloudPanel.vue          # 云端公共配置（发布 / 版本 / 回滚）
    │   └── AdminLogin.vue          # 管理员登录弹窗
    ├── layouts/
    │   └── DefaultLayout.vue       # 默认布局
    ├── composables/                # 组合式函数
    │   ├── useNavData.js           # 导航数据管理
    │   ├── useLocalStorage.js      # 本地存储管理
    │   └── useCyberTheme.js        # 赛博主题管理
    ├── utils/                      # 纯逻辑工具（可直接单测）
    │   ├── adminMode.js            # 管理员身份（服务端接口的调用封装）
    │   ├── backup.js               # 备份文件校验与合并
    │   ├── cloudNav.js             # 云端配置接口封装（超时 / 降级 / 缓存）
    │   └── navDiff.js              # 链接增删改的差异计算
    └── icons/                      # 图标离线集合
        ├── index.js                # 启动时注册图标集
        └── collections.json        # 由 npm run icons 生成
```

构建相关的辅助脚本放在 `scripts/`：`build-icons.mjs`（生成离线图标集合）、`test-*.mjs`（单元测试，随 `npm test` 执行）。

## 🎯 vite.config.js 使用说明

本项目的 Vite 配置文件已经包含标准 Cloudflare Pages 部署所需的所有设置：

- `root: '.'`：根目录，与 `index.html` 同级
- `publicDir: 'public'`：静态资源目录
- `build.outDir: 'dist'`：构建输出目录
- `build.assetsInlineLimit: 4096`：小资源自动内联为 base64

## 🎯 tailwind.config.js 赛博主题配置

本项目已预设完整的赛博朋克配色体系：

```javascript
// 霓虹色系
cyber: {
  cyan: '#22d3ee',
  blue: '#818cf8',
  purple: '#e879f9',
  magenta: '#f472b6',
  lime: '#bef264'
}
```

同时支持动态主题色切换和模糊合成效果。

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone your-repo-url
cd mynav
npm install
```

### 2. 开发模式

```bash
npm run dev
```

项目将在 `http://localhost:5173` 上启动，支持热更新。

### 3. 生产构建

```bash
npm run build
```

构建完成后会在项目根目录生成 `dist` 文件夹。

### 4. 预览构建产物

```bash
npm run preview
```

### 5. 运行单元测试

```bash
npm test
```

覆盖两处纯逻辑：`src/utils/backup.js`（备份解析与合并规则，14 条断言）
和 `src/utils/navDiff.js`（本地改动差异的叠加规则，13 条断言）。

### 6. 构建产物冒烟测试（可选）

```bash
npm run build
npm run smoke
```

用无头浏览器打开 `dist`，点开「设置」与「编辑模式 → 新增链接」，断言异步分包后的
面板与弹窗确实渲染出来。需要本机有 Edge 或 Chrome（找不到时可用 `EDGE_PATH` 指定）。

## 🌍 发布与部署

三条路，按推荐顺序排列。

> **当前线上实例（已实际部署）**
>
> | 项 | 值 |
> | --- | --- |
> | 站点地址 | https://mynav-7i4.pages.dev |
> | GitHub 仓库 | `wuhu-glitch/mynav`（public） |
> | Pages 项目 | `mynav`（Production 分支 `main`） |
> | KV 命名空间 | `mynav-kv` → `MYNAV_KV` |
> | 部署方式 | 本地直传（Git 集成已断开，见「方式三」） |
>
> 已配置的环境变量：`MYNAV_SESSION_SECRET`（secret_text）、`NODE_VERSION=22`。
> 管理员口令尚未写入 KV，因此当前 `/api/session` 返回 `configured: false`，
> 站点是「纯静态只读」状态 —— 完成下面「初始化管理员口令」即可开启管理。`

### 方式一：GitHub + Cloudflare Pages 连接（推荐，零密钥）

1. 在 GitHub 新建空仓库（**不要**勾初始化 README / .gitignore，否则首推会冲突），假设地址是
   `https://github.com/你的用户名/mynav.git`
2. 关联远程并推送：

   ```bash
   git remote add origin https://github.com/你的用户名/mynav.git
   git branch -M main
   git push -u origin main
   ```

3. Cloudflare 控制台 → **Workers & Pages** → Create → **Pages** → Connect to Git → 选中该仓库
   - Framework preset：`Vite`
   - Build command：`npm run build`
   - Build output directory：`dist`
   - 环境变量：`NODE_VERSION = 22`（Pages 默认 Node 版本可能偏低）
4. 之后每次 push 到 `main` 自动构建发布，PR 会自动生成预览环境。
5. **再补两个鉴权环境变量**（否则站点永远是只读）：
   - `MYNAV_ADMIN_PASSWORD`：管理员口令（≥ 8 位，建议 16 位随机串）
   - `MYNAV_SESSION_SECRET`：会话签名密钥（≥ 16 位，建议 32 位随机串）

> `functions/` 目录会被 Pages 自动识别并部署，无需额外配置；
> `public/_routes.json` 只让 `/api/*` 走函数，静态资源不会被函数拖慢。

> Pages 项目名决定默认域名，形如 `<项目名>.pages.dev`。

### 方式二：GitHub Actions 直接发布（仓库已带 workflow）

`.github/workflows/deploy.yml` 已就绪：push 到 `main`/`master` 时执行 `npm ci` + `npm run build`，
再用 wrangler 发布到 Pages 项目 `mynav`。

在 GitHub 仓库 Settings → Secrets and variables → Actions 里添加两个 secret：

- `CLOUDFLARE_API_TOKEN`：控制台 My Profile → API Tokens → Create Token，
  用模板 *Edit Cloudflare Workers*，或自定义权限 `Account → Cloudflare Pages: Edit`
- `CLOUDFLARE_ACCOUNT_ID`：控制台 Overview 右侧的 Account ID

若你的 Pages 项目名不叫 `mynav`，同步修改 `deploy.yml` 里的 `--project-name`。

### 方式三：本地直传 dist（本项目当前实际使用）

Git 集成本来配好了，但 `github.com/apps/*` 在本机网络下打不开、仓库又显示「已与 Git 帐户断开连接」，
所以改成直传：本地构建 → `wrangler pages deploy` 上传 `dist` + `functions/`。

```bash
# 1) 把 API Token 放进根目录 .cf-token（已在 .gitignore 里）
# 2) 每次发版：
CLOUDFLARE_API_TOKEN=$(cat .cf-token) npm run deploy
```

`npm run deploy` 等价于 `npm run build && npx wrangler@3 pages deploy dist --project-name mynav --branch main`。

Token 权限（Account 级，不需要 Zone）：

| 资源 | 权限 |
| --- | --- |
| Cloudflare Pages | Edit |
| Workers KV Storage | Edit |
| Account Settings | Read |

> ⚠️ **绑定会被部署覆盖**：`wrangler pages deploy` 会用它解析到的 `wrangler.toml` 同步项目配置。
> 因此 `name` / `pages_build_output_dir` / `compatibility_date` 必须写在 `[[kv_namespaces]]`
> **之前**，否则 wrangler 会判定配置文件「缺少 pages_build_output_dir」而整体忽略，
> 部署后项目里的 KV 绑定会被清空，`/api/nav` 就会返回 `reason: "kv_not_bound"`。
> 部署完可以顺手验一下：`curl https://mynav-7i4.pages.dev/api/nav` 应返回 `{"ok":true,"source":"none"}` 而不是 `kv_not_bound`。

> ⚠️ **pages.dev 在某些网络下不可达**：本机 `curl` 该域名是 `000`（DNS 正常、TCP 被拦），
> 换自定义域名或走代理才能稳定访问。

也可以走控制台 Create → Pages → **Upload assets**，直接把 `dist` 拖进去（但拖拽不会带 `functions/`）。

### SPA 路由说明

`public/_redirects` 的内容是 `/*    /index.html   200`，构建后随 `dist` 一起上传。
因此刷新任意路径（例如 `/settings`）都会回落到 `index.html`，**不需要**再去控制台配额外的路由规则。
打包产物里可直接确认：`dist/_redirects`。

`public/_routes.json` 把 `/api/*` 声明为 Functions 路由。Cloudflare 的路由顺序是
**先匹配 Functions，再走 _redirects**，所以 `/api/auth` 不会被 SPA 回退吃掉；
其余路径全部按静态资源处理。

## ⚙️ 导航数据管理

所有导航链接配置位于 `public/nav.json`，支持通过三个方式管理：

### 方式一：直接编辑 JSON

编辑 `public/nav.json` 文件，修改 `items` 数组即可。

### 方式二：浏览器编辑模式（UI 操作）

先登录管理员（头部右上角锁形按钮，或访问 `?admin=1` 打开登录框），然后：

1. 点击右上角锁形按钮登录 → 登录后出现铅笔图标
2. 点铅笔进入编辑模式
3. 点击任意链接卡片进行编辑
4. 添加/删除/修改链接

### 方式三：导入导出备份

在设置面板「数据与备份」中：

- **导出备份**：把当前外观设置 + 链接数据下载成 `mynav-backup-YYYY-MM-DD.json`
- **导入备份**：读入备份文件，先校验再合并

**导入的边界规则**（实现见 `src/utils/backup.js`，有单测覆盖）：

| 项目 | 规则 |
| --- | --- |
| 文件大小 | 超过 5MB 直接拒绝，并提示原因 |
| JSON 格式 | 非法 JSON / 顶层不是对象 → 拒绝 |
| 来源标记 | `app` 不是 `MyNav`、或 `schemaVersion` 更高 → 只告警，不阻断 |
| 链接条目 | 必须有 `name` 与合法的 `http(s)` url，否则**跳过该条**（不整单失败） |
| 数量上限 | 单个备份最多导入 500 条链接，超出部分截断并告警 |
| 分类 / 搜索引擎 | **始终以 nav.json 为准**，备份里的这两块会被忽略 |
| 合并策略 | 同 id 用备份版本覆盖；备份里的新 id 视为新增；当前有、备份没有的条目保留 |

导入结束后右上角会列出「新增 / 更新 / 置顶条数」以及所有跳过与告警原因，不再阻塞式弹窗。

**改动如何留在本地**（`src/utils/navDiff.js`）：

页面上的新增 / 修改 / 删除不会把整份 `nav.json` 快照写进浏览器，而是只记录**差异**
（被改动的条目 + 被删除的 id）。这样既保证刷新后改动还在，也不会让 `nav.json`
以后新增的链接被本地快照"冻住"。设置面板里的「恢复默认」会同时清掉这份差异。

本地存储键：

| 键名 | 内容 |
| --- | --- |
| `mynav-settings` | 外观 / 布局 / 特效 / 显示开关等偏好 |
| `mynav-custom-nav` | 相对 nav.json 的链接改动（overrides + deleted） |

> 旧版本的 `mynav-admin` 键已废弃：管理员身份改为服务端 HttpOnly Cookie，不再写 localStorage。

## 🔒 只读模式与管理员登录

默认**所有人都是只读访客**：

- 能看、能搜、能点开所有链接
- 能看到时钟、能改自己的外观设置（主题色 / 背景 / 特效，只存在他自己浏览器）
- 看不到编辑入口：铅笔按钮、新增链接、卡片点击编辑、设置里的「数据与备份」区都不渲染

### 管理员身份由服务端判定

编辑权限不是前端开关，而是 `functions/` 下的 Pages Functions 接口：

| 接口 | 方法 | 权限 | 作用 |
| --- | --- | --- | --- |
| `/api/auth` | POST | 公开 | 校验口令（哈希存在 KV）→ 下发 HttpOnly 会话 Cookie |
| `/api/session` | GET | 公开 | 查询当前会话是否为管理员 |
| `/api/logout` | POST | 公开 | 退出（清除 Cookie） |
| `/api/nav` | GET | 公开 | 读取云端公共配置；无数据时返回 `source: "none"` |
| `/api/nav` | POST | 管理员 | 发布当前配置为新版本（带备注、限频） |
| `/api/versions` | GET | 管理员 | 版本时间轴（最近 20 个，不含正文） |
| `/api/rollback` | POST | 管理员 | 回滚到指定版本（生成新版本，不删历史） |

登录入口有两处：头部右上角的**锁形按钮**，或访问一次带 `?admin=1` 的地址
（该参数只负责弹出登录框，不再授予任何权限）。登录成功后 12 小时内免重复登录；
点「开锁」图标即可退出。

### 云端公共配置（Cloudflare KV）

这一步决定访客看到的是「你发布的链接」还是「仓库里的 nav.json」。

**1. 创建 KV 命名空间**

Cloudflare 控制台 → Workers & Pages → KV → Create namespace。本项目已创建 `mynav-kv`，
namespace id 已写进仓库根目录的 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "MYNAV_KV"
id = "你的 namespace id"
```

**2. 绑定到 Pages 项目**

Pages 项目 → Settings → Functions → KV namespace bindings → Add binding：

- Variable name：`MYNAV_KV`（必须一致）
- KV namespace：选刚创建的那个

**3. 设置会话密钥**

Settings → Environment variables 添加 `MYNAV_SESSION_SECRET`（≥ 16 位，建议 32 位随机串），
Production 与 Preview 都要。生成方式：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**4. 初始化管理员口令（写进 KV，不写进仓库）**

```bash
npm run hash-password -- "你的口令"
# 输出 scrypt1$<salt>$<hash>，复制整串

npx wrangler kv key put "auth:password" "scrypt1$..." --namespace-id=<namespace id> --remote
```

口令只在本机命令行出现一次；KV 里存的是 PBKDF2-SHA256（12 万次迭代）加盐哈希，不可逆推。
`MYNAV_ADMIN_PASSWORD` 环境变量已不再是必需项，仅作旧部署迁移的兜底。

**5. 打开开关**

站点 → 设置 → 云端公共配置 → 启用。关闭时整站不访问任何 `/api`，保持纯静态。

### 发布、版本与回滚

- 管理员登录后，页头进入编辑模式，增删改链接（改动先落本地，便于预览）；
- 设置 → 云端公共配置 → **云端配置与版本** → 「发布当前配置」写入 KV，访客刷新即可看到；
- 每次发布都会生成一个带时间戳的快照（最近 20 个），时间轴上可一键回滚；
- 回滚本身也会生成新版本，备注记为「回滚自 v-xxx」，审计轨迹不断；
- 发布做了三层边界：体积上限 200KB、链接总数上限 500、清洗掉非 http(s) 链接，
  并且两次保存最短间隔 8 秒（挡脚本连点）。

### 加载降级

开启云端开关后读取顺序是 **KV → 本地缓存 → 静态 nav.json**：

- KV 不可用（未绑定 / 网络失败 / 无数据）时用上次成功读到的缓存；
- 缓存也没有时退回仓库里的 `nav.json`，页面永远有内容；
- 云端面板会直接显示当前来源与版本号，便于排查。

### 本地开发怎么测完整链路

`vite dev` / `vite preview` 不带 Functions，`/api/*` 会落到 SPA 回退，页面提示「鉴权接口未启用」。
要连 KV 与鉴权一起测：

```bash
npm run build
npx wrangler pages dev dist --compatibility-date=2026-01-01
# 本地变量放 .dev.vars（不要提交）：
# MYNAV_SESSION_SECRET=local-test-secret-0123456789
```

本地 KV 用 `npx wrangler kv key put ... --local`（或 `--preview`）写入，线上用 `--remote`。

### 安全边界

- 口令哈希只存在 KV；仓库与前端产物都不含明文，比较走常量时间且带盐迭代
- 会话 Cookie 是 `HttpOnly; Secure; SameSite=Strict`，页面脚本读不到，XSS 也偷不走
- 写接口全部先验签 Cookie；未登录直接 401，不依赖前端隐藏按钮
- 登录失败按 IP 记在 KV：连续 5 次锁 60 秒（KV 最终一致，秒级误差可接受）；
  真正的流量防护仍建议在控制台给 `/api/auth` 配 Rate Limiting 规则
- 访客的个人偏好与本地改动**始终只存本机**，不会因为开了云端就被上传

更多细节见 [SECURITY.md](SECURITY.md)。

## 🎨 定制主题

### 主题色切换

1. 点击右上角设置图标打开设置面板
2. 在「基础主题」中选择主题色

### 背景设置

支持多种背景类型：
- 默认渐变（径向）
- 纯色
- 电路板纹理
- 数字网格
- 自定义图片
- 图片背景预览与遮罩

### 布局调整

- **布局模式**：大卡片网格（默认）/紧凑列表
- **卡片间距**：紧凑 / 正常（默认）/ 宽松

### 赛博特效开关

- 扫描线特效
- 文字故障 Glitch
- 霓虹发光边框
- 霓虹发光文字
- 光标拖尾

建议移动端关闭所有特效以保证流畅性。

## 🔧 自定义 SEO

在 `index.html` 中自定义页面信息：

```html
<title>MyNav 个人导航站</title>
<meta name="description" content="赛博朋克风格个人导航站">
<meta name="theme-color" content="#0f172a">
```

## 📝 数据 Schema（nav.json）

```json
{
  "title": "MyNav 个人导航站",
  "subtitle": "赛博朋克风 个人聚合导航",
  "themeColor": "cyan",
  "categories": [
    {
      "title": "开发工具",
      "filter": ["dev", "tools"]
    }
  ],
  "searchEngines": [
    { "id": "baidu", "name": "百度", "url": "https://www.baidu.com/s?wd={query}" }
  ],
  "pinnedItems": [
    { "id": "p1", "name": "GitHub", "url": "https://github.com", "icon": "mdi:github", "tags": ["dev"] }
  ],
  "items": [
    {
      "id": "vitejs",
      "name": "Vite",
      "url": "https://vitejs.dev",
      "icon": "mdi:vitejs-svelte",
      "tags": ["dev", "tools"],
      "desc": "下一代前端工具链",
      "category": "开发工具"
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 否 | 站点主标题 |
| `subtitle` | string | 否 | 站点副标题 |
| `themeColor` | string | 否 | 默认主题色（cyan/blue/purple/magenta/lime） |
| `categories` | array | 否 | 分类数组 |
| `searchEngines` | array | 否 | 搜索引擎列表 |
| `pinnedItems` | array | 否 | 置顶快捷链接 |
| `items` | array | 否 | 导航链接列表 |

每个 `items` 元素包含：
- `id`：唯一标识
- `name`：名称
- `url`：链接地址
- `icon`：图标 ID（Iconify 格式）
- `tags`：标签数组
- `desc`：描述（可选）
- `category`：分类（可选）

## 🔒 隐私与安全

- 所有配置、用户偏好保存在浏览器 `localStorage`，不上传任何数据
- 不包含任何广告、统计、埋点
- 不收集任何用户访问数据
- 完全本地运行，无后端请求

### 输入校验与 URL 白名单

站点要展示别人填进来的链接，所以把「不可信输入」都收口到了一处（`src/utils/url.js`）：

| 场景 | 规则 | 行为 |
| --- | --- | --- |
| 点击卡片跳转 | 只允许 `http` / `https` | 其他协议（`javascript:`、`data:`、`file:` 等）不打开，卡片显示"链接无效" |
| 新增 / 编辑链接 | 无协议自动补 `https://`，存库存规范化后的绝对地址 | `javascript:alert(1)` 直接判为格式错误，保存不了 |
| 自定义背景图 | 只允许 `http` / `https` / `data:image/*`，并做 CSS 转义 | 非法地址不写入样式，面板上给出提示 |
| 导入备份 | 逐字段清洗（`mergeNavData`）：坏链接丢弃、分类名不合法退回"未分类" | 导入结果里列出丢弃 / 改写的条目 |

跳转用的 `window.open(url, '_blank', 'noopener,noreferrer')`，新页面拿不到 `window.opener`，也拿不到来源页地址。

### 依赖审计

`npm audit` 目前只剩 **开发依赖** 的告警（`vite` 5.x 及其内含的 `esbuild`/`launch-editor`），修复版本要求升到 Vite 8。实测升级后首屏 JS 由 92.9 KB 涨到 147.5 KB（gzip 34.4 → 56.7 KB），为了体积没有升。

这类告警的影响面只在 `npm run dev` 起的本地开发服务器，构建产物 `dist` 是纯静态文件，不包含 dev server 代码，线上不受影响。同时已把 `vite.config.js` 的开发服务器改为只监听 `127.0.0.1`，不接受局域网连接。等 Vite 8 生态稳定、体积回归后再升级。

### 安全基线一览

完整威胁模型、边界与部署侧建议见 [SECURITY.md](./SECURITY.md)。速查：

| 防护 | 落地位置 | 说明 |
| --- | --- | --- |
| CSP 默认全禁 | `public/_headers` | `default-src 'none'` + 逐项白名单；`script-src 'self'` 挡内联/外链脚本 |
| URL 协议白名单 | `src/utils/url.js` | 跳转、保存、导入三处共用一套判定，只放行 http/https |
| CSS 注入转义 | `src/utils/url.js` → `toSafeCssUrl` | 背景图地址实体化 `"` `(` `)` 后进 `url("…")` |
| 存储读取二次校验 | `src/composables/useNavData.js` | localStorage 里的链接再次过协议白名单 |
| 防点击劫持 | `X-Frame-Options` + `frame-ancestors` | 不允许被嵌入 iframe |
| 防降级 | `Strict-Transport-Security` | 一年期 HSTS |
| 供应链固定 | `package.json` 精确版本 + `npm ci` | CI 里 `--ignore-scripts`，仅 1 个运行时依赖 |
| 回归防护 | `.github/workflows/ci.yml` | 单测 + 构建 + 产物自检（含 CSP、nav.json、_redirects） |

另外三件事代码管不到，部署后请在 Cloudflare 控制台确认：**Always Use HTTPS 开启**、
**Minimum TLS 1.2+**、**绑定自有域名时再开 HSTS**。

## 🛠️ 常见问题

### Q1: 构建后首页空白？

确保 `index.html` 在 `dist` 目录中，且路由规则配置正确（`/* -> /index.html`）。

### Q2: 图标不显示？

先确认图标 ID 是合法的 Iconify 名称（如 `mdi:github`、`simple-icons:baidu`）。本项目使用 `@iconify/vue` 4.3.x，导入方式必须是

```js
import { Icon as IconifyIcon } from '@iconify/vue'
```

**不要**写成 `import IconifyIcon from '@iconify/vue/dist/iconify.vue'` —— 4.x 的包里没有这个文件，构建时会报 `Rollup failed to resolve import`。

另外，界面骨架用到的图标（工具栏、设置面板、分类按钮等）在构建前已被抽成离线集合 `src/icons/collections.json`，**断网也不会显示成空白方块**。新增硬编码图标后执行一次 `npm run icons` 重新生成即可；`nav.json` 里自行添加的任意图标仍走 Iconify 在线拉取，不受影响。

### Q3: 自定义域名如何配置？

在 Cloudflare Pages 项目设置中，添加自定义域名并配置 DNS 即可。

### Q4: 如何添加新页面？

目前为单页应用（SPA），需要：
1. 在 `src/router/` 或 `App.vue` 中添加路由
2. 创建新的组件
3. 在导航数据中添加链接

### Q5: 移动端特效消耗性能？

在设置面板中关闭部分特效：
- 关闭光标拖尾
- 关闭霓虹发光文字
- 保留扫描线特效（开销最小）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT

## 🎉 结语

感谢使用 MyNav 个人导航站！如有问题欢迎反馈。

---

**Deploy to Cloudflare Pages**: 以一步 `npm run build` 生成 `dist`，上传即可上线或通过 Cloudflare 自动链路发布。