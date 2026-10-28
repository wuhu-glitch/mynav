# MyNav 导航站 - 文件清单

## 项目根目录

| 文件 | 说明 |
|------|------|
| `index.html` | HTML 入口文件 |
| `package.json` | 项目依赖配置 |
| `vite.config.js` | Vite 构建配置 |
| `tailwind.config.js` | Tailwind 赛博主题配置 |
| `postcss.config.js` | PostCSS 配置（Tailwind + Autoprefixer） |
| `README.md` | 项目说明与部署文档 |
| `MyNav-架构设计.md` | 架构设计文档 |
| `MyNav-文件清单.md` | 本文档 |
| `.github/workflows/deploy.yml` | GitHub Actions 自动部署配置 |

---

## src/ 目录结构

### src/assets/styles/main.css
全局样式文件，包含：
- CSS 变量定义（霓虹色系、主题色）
- Tailwind 指令（base、components、utilities）
- 滚动条样式
- 霓虹发光文字效果
- 卡片样式
- 故障文字特效
- 扫描线特效
- 光标拖尾特效
- 响应式调整

### src/main.js
应用入口文件：
- 导入 Vue 3
- 创建应用实例
- 挂载到 DOM (`#app`)

### src/App.vue
根组件（按需求拆分前）：
- 导航头部（标题、时钟、设置入口）
- 搜索框（搜索引擎切换）
- 分类标签栏
- 置顶快捷区域
- 导航链接卡片网格
- 设置面板（底层弹窗）
- 页脚

### src/components/ 组件列表

| 组件 | 功能 | 文件路径 |
|------|------|----------|
| Header | 导航头部（标题、时钟、主题切换按钮） | `src/components/Header.vue` |
| Footer | 页脚（版权信息、编辑模式入口） | `src/components/Footer.vue` |
| SearchBar | 搜索框（实时搜索、搜索引擎切换、快捷键） | `src/components/SearchBar.vue` |
| CategoryGroup | 分类标签按钮组 | `src/components/CategoryGroup.vue` |
| LinkCard | 链接卡片（名称、图标、标签、描述） | `src/components/LinkCard.vue` |
| Clock | 赛博时钟（时间 + 星期） | `src/components/Clock.vue` |
| CyberEffect | 赛博特效开关（扫描线、Glitch等） | `src/components/CyberEffect.vue` |
| SettingsPanel | 设置面板（主题、背景、布局、特效） | `src/components/SettingsPanel.vue` |
| EditModal | 编辑弹窗（添加/编辑/删除链接） | `src/components/EditModal.vue` |

### src/layouts/ 布局组件

| 组件 | 功能 | 文件路径 |
|------|------|----------|
| DefaultLayout | 默认布局（Header + Content + Footer + 弹窗容器） | `src/layouts/DefaultLayout.vue` |

### src/composables/ 组合式函数

| Composable | 功能 | 文件路径 |
|------------|------|----------|
| useNavData | 导航数据管理（加载、添加、更新、删除） | `src/composables/useNavData.js` |
| useLocalStorage | 本地存储管理（设置保存、加载、导出、导入、重置） | `src/composables/useLocalStorage.js` |
| useCyberTheme | 赛博主题管理（背景样式、主题色、文字颜色） | `src/composables/useCyberTheme.js` |

---

## public/ 目录

| 文件 | 说明 |
|------|------|
| `nav.json` | 导航数据源（必填）- 所有导航链接、分类、搜索引擎、置顶项配置 |

### nav.json Schema 示例

```json
{
  "title": "MyNav 个人导航站",
  "subtitle": "赛博朋克风 个人聚合导航",
  "themeColor": "cyan",
  "categories": [
    {"title": "开发工具", "filter": ["dev", "tools"]}
  ],
  "searchEngines": [
    {"id": "baidu", "name": "百度", "url": "https://www.baidu.com/s?wd={query}"}
  ],
  "pinnedItems": [
    {"id": "p1", "name": "GitHub", "url": "https://github.com", "icon": "mdi:github", "tags": ["dev"]}
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

---

## .github/workflows/deploy.yml

GitHub Actions 自动部署配置：
- 触发条件：主分支推送
- 环境：Ubuntu + Node 22
- 构建命令：`npm run build`
- 部署到 Cloudflare Pages（需配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`）

---

## 核心技术栈

- **Vue 3.4+**：Composition API + `<script setup>`
- **Vite 5.0+**：前端构建工具
- **Tailwind CSS 3.4+**：CSS 框架（赛博朋克主题预设）
- **Iconify**：在线图标库
- **Autoprefixer + PostCSS**：CSS 自动化工具

---

## 样式定制

### 赛博朋克配色

```javascript
// tailwind.config.js 预设色系
cyber: {
  cyan: '#22d3ee',
  blue: '#818cf8',
  purple: '#e879f9',
  magenta: '#f472b6',
  lime: '#bef264'
}
```

### 自定义 CSS 变量

```css
:root {
  --mynav-cyan-default: #00f0ff;
  --mynav-rgb-cyan-default: rgb(0, 240, 255);
  --mynav-glitch-offset: #ff00aa;
}
```

### URL编码处理

```javascript
// SearchBar 组件中
url.replace('{query}', encodeURIComponent(query))
```

---

## 安全与隐私

- ✅ 无后端、无数据库
- ✅ 所有配置保存在 `localStorage`（浏览器本地）
- ✅ 不包含任何广告、统计、埋点
- ✅ 不收集用户访问数据
- ✅ JSON 导入导出备份

---

## 部署说明

1. **本地运行**
   ```bash
   npm install
   npm run dev
   ```

2. **生产构建**
   ```bash
   npm run build
   ```

3. **上传到 Cloudflare Pages**
   - 手动上传：构建后上传 `dist` 目录
   - 自动部署：推送到 GitHub 并配置 Cloudflare Pages

4. **路由配置**

   在 Cloudflare Pages 设置中添加 SPA 路由规则：
   ```
   https://your-project.pages.dev/* → /index.html
   ```

---

## 开发指南

### 添加新导航链接

1. 编辑 `public/nav.json`
2. 在 `items` 数组中添加新对象

### 修改主题色

1. 打开设置面板
2. 在「基础主题」中选择主题色
3. 或直接编辑 `localStorage`

### 添加新分类

1. 编辑 `public/nav.json`
2. 在 `categories` 数组中添加新对象

---

## 注意事项

1. **图标格式**：使用 Iconify 格式的图标 ID（如 `mdi:vuejs`）
2. **URL 编码**：搜索框会自动对输入内容进行 URL 编码
3. **本地存储优先级**：浏览器 localStorage > nav.json
4. **特殊字符处理**：标签和描述应避免特殊字符（或进行 HTML 转义）

---

## 文件统计

- **Vue 组件**：9 个
- **布局组件**：1 个
- **Composables**：3 个
- **CSS 样式**：1 个（包含所有特效）
- **配置文件**：5 个（package.json、vite.config.js、tailwind.config.js、postcss.config.js、deploy.yml）
- **数据文件**：1 个（nav.json）

**总计**：约 19 个核心文件

---

**创建时间**：2026-10-27
**版本**：1.0.0