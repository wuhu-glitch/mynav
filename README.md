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

## 🌍 Cloudflare Pages 部署

### 方式一：手动上传（推荐新手）

1. **构建项目**
   ```bash
   npm run build
   ```

2. **上传 dist 目录**
   - 登录 Cloudflare 控制台
   - 进入 Pages → 创建项目 → 选择本地目录
   - 本地目录选择 `./dist`
   - 构建命令：`npm run build`（可选）
   - 构建输出目录：`dist`（可选）

3. **配置路由规则**

   在 Cloudflare Pages 设置中添加以下路由规则（可选）：

   ```
   https://your-project.pages.dev/*  → /index.html
   https://your-project.pages.dev/*/* → /index.html
   ```

### 方式二：自动部署（GitHub）

1. **推送到 GitHub**

   ```bash
   git add .
   git commit -m "Initial commit"
   git remote add origin your-github-repo-url
   git push -u origin main
   ```

2. **配置 Cloudflare Pages**

   - 登录 Cloudflare → Pages → Import project from Git
   - 选择你的 GitHub 仓库
   - 构建命令：`npm run build`
   - 构建输出目录：`dist`

3. **自动部署**

   每次推送到 GitHub 主分支都会触发自动构建并部署。

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