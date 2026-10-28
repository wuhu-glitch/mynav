import { ref } from 'vue'
import {
  emptyDiff,
  normalizeDiff,
  applyDiff,
  withOverride,
  withDeletion,
  diffFromItems
} from '../utils/navDiff.js'

/**
 * useNavData —— 导航数据（public/nav.json）管理
 *
 * 设计要点：
 * 1. 模块级单例：整个应用共享同一份 navData，多处调用拿到的都是同一状态；
 * 2. nav.json 始终是配置真相来源，但用户在页面上的新增 / 修改 / 删除
 *    会以「差异」形式存进 localStorage（见 src/utils/navDiff.js），
 *    这样既不会一刷新就丢改动，也不会让 nav.json 后续新增的链接失效。
 */

// 用户本地改动（导航项 / 置顶项）的存储键
const STORAGE_KEY = 'mynav-custom-nav'

// 共享的单例状态（放在模块级，而不是函数体内）
const navData = ref(null)
let loadPromise = null

// nav.json 里的「原始」数组，用于计算差异与重建
let baseItems = []
let basePinnedItems = []

// 当前生效的本地差异
let itemDiff = emptyDiff()
let pinnedDiff = emptyDiff()

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

/** 从 localStorage 读出本地差异（数据损坏时降级为空差异） */
function readStoredDiff() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { items: emptyDiff(), pinned: emptyDiff() }
    const parsed = JSON.parse(raw)
    return {
      items: normalizeDiff(parsed?.items),
      pinned: normalizeDiff(parsed?.pinned)
    }
  } catch (error) {
    console.warn('读取本地导航改动失败，已忽略:', error)
    return { items: emptyDiff(), pinned: emptyDiff() }
  }
}

/** 把当前差异写回 localStorage */
function persistDiff() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ items: itemDiff, pinned: pinnedDiff })
    )
  } catch (error) {
    // 存储写满或隐私模式禁用时，不阻断页面使用，只提示
    console.warn('保存本地导航改动失败:', error)
  }
}

/** 用「原始数据 + 差异」重建 navData 上的 items / pinnedItems */
function rebuildLists() {
  if (!navData.value) return
  navData.value.items = applyDiff(baseItems, itemDiff)
  navData.value.pinnedItems = applyDiff(basePinnedItems, pinnedDiff)
}

/** 记录原始数据并重建列表（加载流程与导入流程共用） */
function setBaseData(data) {
  baseItems = Array.isArray(data?.items) ? data.items : []
  basePinnedItems = Array.isArray(data?.pinnedItems) ? data.pinnedItems : []
  rebuildLists()
}

// 读取共享数据（首次调用时发起请求，之后所有调用方复用同一个 Promise）
async function loadNavData() {
  if (navData.value) return navData.value
  if (!loadPromise) {
    loadPromise = (async () => {
      let loadedData = defaultNavData
      try {
        const response = await fetch('/nav.json')
        if (!response.ok) throw new Error(`加载 nav.json 失败（HTTP ${response.status}）`)
        loadedData = await response.json()
      } catch (error) {
        console.error('加载导航数据失败，使用内置默认数据:', error)
      }

      // 先取本地差异，再组装成最终数据
      const stored = readStoredDiff()
      itemDiff = stored.items
      pinnedDiff = stored.pinned

      navData.value = {
        ...loadedData,
        items: [],
        pinnedItems: []
      }
      setBaseData(loadedData)

      return navData.value
    })()
  }
  return loadPromise
}

/** 添加新的导航项 */
function addNavItem(item) {
  if (!navData.value || !item?.id) return
  itemDiff = withOverride(itemDiff, item)
  rebuildLists()
  persistDiff()
}

/** 更新导航项（按 id 局部合并） */
function updateNavItem(id, updatedItem) {
  if (!navData.value || !id) return
  const items = navData.value.items || []
  const current = items.find((item) => item.id === id)
  if (!current) return
  itemDiff = withOverride(itemDiff, { ...current, ...updatedItem, id })
  rebuildLists()
  persistDiff()
}

/** 删除导航项 */
function removeNavItem(id) {
  if (!navData.value || !id) return
  itemDiff = withDeletion(itemDiff, id)
  rebuildLists()
  persistDiff()
}

/**
 * 导入备份后整体应用导航数据。
 * 直接按「与 nav.json 原始数据的差异」重建，避免把整份快照写进本地存储。
 *
 * @param {{ items?: object[], pinnedItems?: object[] }} incoming 已通过校验合并的数据
 * @returns {{ items: number, pinnedItems: number }}
 */
function applyImportedData(incoming) {
  if (!navData.value) return { items: 0, pinnedItems: 0 }

  itemDiff = diffFromItems(baseItems, incoming?.items || [])
  pinnedDiff = diffFromItems(basePinnedItems, incoming?.pinnedItems || [])
  rebuildLists()
  persistDiff()

  return {
    items: navData.value.items.length,
    pinnedItems: navData.value.pinnedItems.length
  }
}

/** 清除本地自定义改动，恢复到 nav.json 的原始配置 */
function resetCustomNav() {
  itemDiff = emptyDiff()
  pinnedDiff = emptyDiff()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('清除本地导航改动失败:', error)
  }
  rebuildLists()
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
    removeNavItem,
    applyImportedData,
    resetCustomNav
  }
}
