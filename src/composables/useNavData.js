import { ref } from 'vue'

/**
 * useNavData —— 导航数据（public/nav.json）管理
 *
 * 设计为模块级单例：整个应用共享同一份 navData，
 * 多处调用 useNavData() 拿到的是同一个状态，避免各组件各自请求产生不一致。
 */

// 共享的单例状态（放在模块级，而不是函数体内）
const navData = ref(null)
let loadPromise = null

// nav.json 加载失败（本地开发 404、JSON 损坏等）时的内置兜底数据
const defaultNavData = {
  title: 'MyNav 个人导航站',
  subtitle: '赛博朋克风 个人聚合导航',
  themeColor: 'cyan',
  categories: [
    { title: '开发工具', filter: ['dev', 'tools'] },
    { title: '创意设计', filter: ['design', 'creative'] },
    { title: '学习资源', filter: ['learn', 'edu'] },
    { title: '娱乐休闲', filter: ['fun', 'media'] },
    { title: '常用网站', filter: ['common', 'daily'] }
  ],
  searchEngines: [
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={query}' },
    { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q={query}' },
    { id: 'github', name: 'GitHub', url: 'https://github.com/search?q={query}' },
    { id: 'zhihu', name: '知乎', url: 'https://www.zhihu.com/search?type=content&q={query}' },
    { id: 'bilibili', name: 'B站', url: 'https://search.bilibili.com/all?keyword={query}' }
  ],
  pinnedItems: [],
  items: []
}

// 读取共享数据（首次调用时发起请求，之后所有调用方复用同一个 Promise）
async function loadNavData() {
  if (navData.value) return navData.value
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const response = await fetch('/nav.json')
        if (!response.ok) throw new Error(`加载 nav.json 失败（HTTP ${response.status}）`)
        navData.value = await response.json()
      } catch (error) {
        console.error('加载导航数据失败，使用内置默认数据:', error)
        navData.value = defaultNavData
      }
      return navData.value
    })()
  }
  return loadPromise
}

// 添加新的导航项
function addNavItem(item) {
  if (!navData.value) return
  if (!Array.isArray(navData.value.items)) navData.value.items = []
  navData.value.items.push(item)
}

// 更新导航项（按 id 局部合并）
function updateNavItem(id, updatedItem) {
  if (!navData.value) return
  const items = navData.value.items || []
  const index = items.findIndex((item) => item.id === id)
  if (index !== -1) {
    items[index] = { ...items[index], ...updatedItem }
  }
}

// 删除导航项
function removeNavItem(id) {
  if (!navData.value || !Array.isArray(navData.value.items)) return
  navData.value.items = navData.value.items.filter((item) => item.id !== id)
}

/**
 * 导航数据组合式函数。
 * 兼容旧用法：组件内解构 { navData, loadNavData }。
 */
export function useNavData() {
  return {
    navData,
    loadNavData,
    addNavItem,
    updateNavItem,
    removeNavItem
  }
}
