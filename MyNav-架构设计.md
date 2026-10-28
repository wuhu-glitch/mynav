# MyNav 个人导航站架构设计

## 一、项目概述

- **项目名称**: MyNav 个人导航站
- **技术栈**: Vue 3 + Vite + Tailwind CSS v3 + Iconify
- **部署目标**: Cloudflare Pages（免费托管）
- **部署方式**: 生成 `dist` 目录后上传/关联到 Cloudflare Pages

---

## 二、项目目录结构

```
mynav/
├── public/
│   ├── nav.json                    # 导航数据源（核心配置文件）
│   ├── favicon.ico                 # 网站图标
│   └── robots.txt                  # 爬虫规则（可选）
├── src/
│   ├── assets/
│   │   └── styles/
│   │       └── main.css            # 全局样式入口（Tailwind + 自定义特效）
│   ├── components/
│   │   ├── Header.vue              # 导航头部（搜索框、主题切换）
│   │   ├── Footer.vue              # 页脚（版权、备案等）
│   │   ├── NavGrid.vue             # 导航分类网格
│   │   ├── QuickLinkCard.vue       # 快速入口卡片
│   │   ├── CyberEffect.vue         # 赛博朋克故障特效组件
│   │   └── SettingsPanel.vue       # 设置面板
│   ├── composables/
│   │   ├── useNavData.js           # 统一读取 nav.json
│   │   ├── useLocalStorage.js      # localStorage 持久化封装
│   │   └── useCyberTheme.js        # 赛博主题色管理
│   ├── router/
│   │   └── index.js                # Cloudflare SPA 路由配置
│   ├── layouts/
│   │   └── DefaultLayout.vue       # 默认布局（包含 Header + Footer）
│   ├── App.vue                     # 根组件
│   └── main.js                     # 应用入口
├── .github/
│   └── workflows/
│       └── deploy.yml              # Cloudflare Pages 自动部署配置单文件版
├── index.html                      # HTML 入口
├── package.json                    # 项目依赖配置
├── vite.config.js                  # Vite 构建配置
├── tailwind.config.js              # Tailwind CSS 配置
├── BABEL_MACRO.md                  # Babel Macro 配置说明（自定义插件可移除，建议使用 Vite）
└── README.md                       # 项目说明与部署流程文档
```

### 文件说明

| 路径 | 说明 |
|------|------|
| `public/nav.json` | 导航数据源，使用 CRUD 修改内容，不触碰业务代码 |
| `src/assets/styles/main.css` | CSS 入口；引入 Tailwind CDN（开发环境）/ 本地 Tailwind（生产环境）+ 自定义赛博特效 |
| `src/components/*.vue` | 细粒度组件，每个组件单一职责 |
| `src/composables/*.js` | 组合式函数，复用逻辑（读取数据、本地存储、主题） |
| `src/router/index.js` | SPA 路由，支持 Cloudflare Pages 路由规则兼容 |
| `src/layouts/DefaultLayout.vue` | 布局组件，包裹 Header 和下游内容 |
| `index.html` | Cloudflare Pages 打包输出根文件 |
| `deploy.yml` | GitHub Actions 自动化部署 Cloudflare Pages（单文件精简版） |

---

## 三、nav.json 数据 Schema（核心配置）

**路径**: `public/nav.json`  
**模式**: 监守单一数据源原则，所有导航内容从此文件读取  

### 单条导航项结构
每个导航项为一个对象，必填字段为 `name` 和 `url`，其余为可选。

```json
{
  "id": "news",                     // [必填，唯一标识] 字符串，建议小写 + 下划线或连字符，如 "news"、"tools"
  "name": "新闻资讯",                // [必填] 人类可读名称，显示在UI，中文为主，多彩推荐
  "url": "https://news.ycombinator.com", // [必填] 目标URL
  "icon": "mdi:newspaper",           // [可选] 图标ID（Iconify 格式），如 "mdi:newspaper" 或 "tabler:lang"
  "tags": ["news", "daily"],        // [可选] 标签数组（用于分类筛选），如 ["news", "daily"]
  "desc": "重要页面必要时才加描述，不宜过多", // [可选] 简短描述（建议 <50字符），部分卡片可能不展示
  "category": "工具类"               // [可选] 分类名称（可作为分组标题），如 "工具类"、"娱乐类"
}
```

### 根级配置字段
根对象可选附加字段，用于全局/分类设置（如隐私模式、开关设项等）。

```json
{
  "title": "MyNav 个人导航站",       // [推荐] 全局标题（全局状态中可用于自定义设置页的可编辑Title）
  "subtitle": "赛博朋克风 个人聚合导航",
  "themeColor": "cyan",             // [可选] 默认主题色：cyan|blue|purple|magenta|lime
  "categories": [                   // [可选，替代 category 字段的隐形分类] 对象数组，用于显式分栏
    {
      "title": "常用工具",
      "filter": ["tools", "dev"]
    },
    {
      "title": "资讯",
      "filter": ["news"]
    }
  ],
  "urgentWarning": "本站默认免登录、不记录Cookie，浏览机制由浏览器本地策略决定。如遇页面空白或加载异常，请检查是否有拦截拦截器或广告插件。"
}
```

### 举例如下（可照抄/修改后缀）

```json
{
  "title": "MyNav 个人导航站",
  "subtitle": "赛博朋克风 个人聚合导航",
  "themeColor": "cyan",
  "categories": [
    {
      "title": "常用工具",
      "filter": ["tools", "dev"]
    },
    {
      "title": "资讯",
      "filter": ["news"]
    }
  ],
  "urgentWarning": "本站默认免登录、不记录Cookie，浏览机制由浏览器本地策略决定。如遇页面空白或加载异常，请检查是否有拦截拦截器或广告插件。",
  "items": [
    {
      "id": "devtools",
      "name": "开发工具",
      "url": "https://devdocs.io/",
      "icon": "mdi:code-tags",
      "tags": ["dev", "tools"],
      "desc": "开发者文档聚合，单词多"
    },
    {
      "id": "news",
      "name": "Hacker News",
      "url": "https://news.ycombinator.com",
      "icon": "mdi:newspaper",
      "tags": ["news"]
    }
  ]
}
```

---

## 四、Cloudflare Pages 关键部署要点

1. **构建命令** (Node.js):
   ```
   npm install && npm run build
   ```
2. **输出目录**:
   ```
   dist
   ```
3. **路由模式**: SPA（单页应用），需在 Cloudflare Pages 规则中支持 `/` -> `index.html`  
   示例 Cloudflare 规则：
   ```
   https://mynav.example.com/*         -> /index.html
   https://mynav.example.com/*/*      -> /index.html
   ```
4. **数据存储**:  
   所有用户偏好（主题色、开关等）存储在 localStorage，不上传服务端，隐私优先。
5. **构建环境**:  
   建议设置 —— Runtime: Node.js 18+，Cache Buckets: Enabled（要点）。

---

## 五、自行创建的基础配置文件（建议按顺序创建）

1. `package.json` - 定义依赖
2. `vite.config.js` - Vite 打包配置
3. `tailwind.config.js` - Tailwind 赛博主题色 + 特效开关
4. `index.html` - HTML 入口 + 脚本注入点
5. `src/main.js` & `src/App.vue` - Vue 入口
6. `public/nav.json` - 导航数据（模板）

---

## 六、未来页面设计方向

- 首页：展示分类网格 + 自定义主题色 + 快速开关（故障特效、扫描线）
- 设置页：主题色切换、开关开关、URL列表管理
- 通用特征：赛博朋克霓虹配色；低饱和不刺眼；CRT 扫描线；文字故障（Glitch）；深色基底