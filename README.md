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
│   └── nav.json                    # 导航数据源（核心配置）
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
    │   └── EditModal.vue           # 编辑弹窗
    ├── layouts/
    │   └── DefaultLayout.vue       # 默认布局
    ├── composables/                # 组合式函数
    │   ├── useNavData.js           # 导航数据管理
    │   ├── useLocalStorage.js      # 本地存储管理
    │   └── useCyberTheme.js        # 赛博主题管理
    ├── utils/                      # 纯逻辑工具（可直接单测）
    │   ├── backup.js               # 备份文件校验与合并
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

三条路，按推荐顺序排列。项目当前是本地仓库、`main` 分支、还没有远程。

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

> Pages 项目名决定默认域名，形如 `<项目名>.pages.dev`。

### 方式二：GitHub Actions 直接发布（仓库已带 workflow）

`.github/workflows/deploy.yml` 已就绪：push 到 `main`/`master` 时执行 `npm ci` + `npm run build`，
再用 wrangler 发布到 Pages 项目 `mynav`。

在 GitHub 仓库 Settings → Secrets and variables → Actions 里添加两个 secret：

- `CLOUDFLARE_API_TOKEN`：控制台 My Profile → API Tokens → Create Token，
  用模板 *Edit Cloudflare Workers*，或自定义权限 `Account → Cloudflare Pages: Edit`
- `CLOUDFLARE_ACCOUNT_ID`：控制台 Overview 右侧的 Account ID

若你的 Pages 项目名不叫 `mynav`，同步修改 `deploy.yml` 里的 `--project-name`。

### 方式三：本地直传 dist（不接 Git）

```bash
npm run build
npx wrangler pages deploy dist --project-name=mynav
```

首次运行会要求 `wrangler login`（浏览器授权）。也可以走控制台
Create → Pages → **Upload assets**，直接把 `dist` 拖进去。

### SPA 路由说明

`public/_redirects` 的内容是 `/*    /index.html   200`，构建后随 `dist` 一起上传。
因此刷新任意路径（例如 `/settings`）都会回落到 `index.html`，**不需要**再去控制台配额外的路由规则。
打包产物里可直接确认：`dist/_redirects`。

## ⚙️ 导航数据管理

所有导航链接配置位于 `public/nav.json`，支持通过三个方式管理：

### 方式一：直接编辑 JSON

编辑 `public/nav.json` 文件，修改 `items` 数组即可。

### 方式二：浏览器编辑模式（UI 操作）

1. 点击右上角 ⚙️ 设置图标
2. 开启编辑模式（小铅笔图标）
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
| `mynav-admin` | 是否记住了「管理员模式」（默认没有） |

## 🔒 只读模式（访客能做什么）

默认**所有人都是只读访客**：

- 能看、能搜、能点开所有链接
- 能看到时钟、能改自己的外观设置（主题色 / 背景 / 特效，只存在他自己浏览器）
- 看不到编辑入口：铅笔按钮、新增链接、卡片点击编辑、设置里的「数据与备份」区都不渲染

这些限制在前端实现（`src/utils/adminMode.js` + `Header.vue` 的 `canEdit` 属性），
`App.vue` 的 `openEdit` 还有一次兜底校验，非管理员即使强行触发事件也打不开编辑弹窗。

### 站长如何开启编辑

第一次访问时在地址后面加上 `?admin=1`：

```
https://你的域名/?admin=1
```

参数会被记住到 localStorage（键 `mynav-admin`），同时地址栏里的参数会被自动抹掉，
所以之后正常打开就是编辑态，分享出去的链接也不会带上这个参数。

关闭编辑权限：

```
https://你的域名/?admin=0
```

也支持 `true/yes` 与 `false/no` 两种写法，参数名大小写不敏感（`?Admin=1` 同样生效）。

### 这个开关的安全边界

纯静态站没有服务端鉴权，**知道 `?admin=1` 的人都能给自己开编辑入口**。但他改的永远是
他自己浏览器里的那份差异（`mynav-custom-nav`），线上 `nav.json` 不会被改动，其他访客也看不到。
想让内容真正只由你控制，只有两条路：把参数当口令不外传，或者给站点加后端鉴权（本项目刻意不做）。

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