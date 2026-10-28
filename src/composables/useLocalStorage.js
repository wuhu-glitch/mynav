import { ref, watch } from 'vue'

/**
 * useLocalStorage —— 用户偏好持久化（隐私优先）
 *
 * 设计为模块级单例：整个应用共享同一份 settings（模块级 ref），
 * 任何组件通过 useLocalStorage() 修改设置，其它组件立即同步。
 *
 * 关键约束：
 *   - settings 永远是「完整」对象：读取旧备份时与 DEFAULT_SETTINGS 深合并，
 *     避免旧版本缺字段导致模板里 settings.effects.xxx 报 undefined。
 *   - 所有数据只写 localStorage，绝不上传。
 */

const STORAGE_KEY = 'mynav-settings'

// ==================== 默认设置 ====================
export const DEFAULT_SETTINGS = {
  // 主题
  theme: 'dark',            // 'dark' | 'light'
  accentColor: 'cyan',      // 'cyan' | 'blue' | 'purple' | 'magenta' | 'lime' | 'amber'

  // 背景
  bgType: 'gradient-radial-2',
  bgImage: '',
  bgOverlay: 0.7,           // 背景遮罩不透明度 0~1

  // 布局
  layoutMode: 'grid',       // 'grid' | 'compact'
  cardiSpacing: 'normal',   // 'compact' | 'normal' | 'spaced'

  // 站点信息（可被 nav.json 覆盖）
  siteTitle: 'MyNav 个人导航站',
  siteSubtitle: '赛博朋克风 个人聚合导航',

  // 交互
  searchShortcut: '/',

  // 赛博特效开关
  effects: {
    scanline: true,
    glitch: true,
    neonBorders: true,
    glowText: true,
    cursorTrail: true
  },

  // 显示开关
  showClock: true,
  showHitokoto: false,
  showPinned: true
}

// 深合并：保证嵌套对象（如 effects）不会因为旧备份缺键而丢字段
function deepMerge(base, override) {
  const result = Array.isArray(base) ? [...base] : { ...base }
  if (!override || typeof override !== 'object') return result
  for (const key of Object.keys(override)) {
    const value = override[key]
    const current = result[key]
    const bothPlainObject =
      value && current &&
      typeof value === 'object' && typeof current === 'object' &&
      !Array.isArray(value) && !Array.isArray(current)
    result[key] = bothPlainObject ? deepMerge(current, value) : value
  }
  return result
}

// 创建共享状态（首次访问时从 localStorage 恢复）
function createSettings() {
  const state = ref({ ...DEFAULT_SETTINGS })

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      state.value = deepMerge(DEFAULT_SETTINGS, JSON.parse(saved))
    }
  } catch (error) {
    console.error('读取本地设置失败，已回退默认设置:', error)
    state.value = { ...DEFAULT_SETTINGS }
  }

  // 任何修改自动落盘（深监听，组件里直接改 settings 也会被保存）
  watch(
    state,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch (error) {
        console.error('保存设置失败:', error)
      }
    },
    { deep: true }
  )

  return state
}

const settings = createSettings()

// 导航数据提供者（由 App.vue 注入，导出备份时需要，避免循环依赖）
// 必须放在模块级：面板、头部等多处都会调用 useLocalStorage()，
// 若放在函数体内，各调用方的导出备份就取不到导航数据。
let navDataProvider = () => null
const setNavDataProvider = (fn) => {
  navDataProvider = typeof fn === 'function' ? fn : () => null
}

// ==================== 组合式函数 ====================
export function useLocalStorage() {

  /**
   * 保存设置：与默认值深合并后再写入，保证结构完整
   */
  const saveSettings = (patch) => {
    settings.value = deepMerge(DEFAULT_SETTINGS, patch || {})
  }

  /**
   * 恢复默认设置
   */
  const resetSettings = () => {
    settings.value = deepMerge(DEFAULT_SETTINGS, {})
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    } catch (error) {
      console.error('重置设置失败:', error)
    }
  }

  /**
   * 导出备份：设置 + 当前导航数据，下载为 JSON 文件
   */
  const exportData = () => {
    const payload = {
      app: 'MyNav',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: settings.value,
      navData: navDataProvider()
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mynav-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * 导入备份：读取 JSON 文件并合并设置，返回完整备份内容（含 navData）
   * 导航数据的合并由调用方（App.vue）处理。
   */
  const importData = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result)
          if (data && data.settings) {
            settings.value = deepMerge(DEFAULT_SETTINGS, data.settings)
          }
          resolve(data)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error('读取文件失败'))
      reader.readAsText(file)
    })
  }

  return {
    settings,
    saveSettings,
    resetSettings,
    exportData,
    importData,
    setNavDataProvider
  }
}
