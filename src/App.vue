<script setup>
/**
 * App.vue —— MyNav 根组件
 *
 * 负责把「数据（useNavData）」「设置（useLocalStorage）」「布局（DefaultLayout）」
 * 和各业务组件接到一起：
 *   - 头部：标题 / 时钟 / 编辑与设置入口 / 搜索框 / 分类标签
 *   - 主体：置顶快捷区 + 链接卡片网格（按分类或关键词过滤）
 *   - 页脚：版权与新增入口
 *   - 全局：设置面板、编辑弹窗、赛博特效
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, onErrorCaptured, defineAsyncComponent } from 'vue'
import DefaultLayout from './layouts/DefaultLayout.vue'
import Clock from './components/Clock.vue'
import SearchBar from './components/SearchBar.vue'
import CategoryGroup from './components/CategoryGroup.vue'
import LinkCard from './components/LinkCard.vue'
// 设置面板与编辑弹窗只在用户点开时才需要，改成异步组件后它们会单独切成
// 一个 chunk：首屏 JS 明显变小，打开面板时才按需下载（浏览器会缓存）。
const SettingsPanel = defineAsyncComponent(() => import('./components/SettingsPanel.vue'))
const EditModal = defineAsyncComponent(() => import('./components/EditModal.vue'))
import CyberEffect from './components/CyberEffect.vue'
import Header from './components/Header.vue'
import { useNavData } from './composables/useNavData'
import { useLocalStorage } from './composables/useLocalStorage'
import { useCyberTheme } from './composables/useCyberTheme'
import { parseBackup, mergeNavData } from './utils/backup'
import { bootstrapAdmin } from './utils/adminMode'

// ==================== 数据与设置（单例共享） ====================
const { navData, loadNavData, applyImportedData } = useNavData()
const { settings, saveSettings, setNavDataProvider } = useLocalStorage()

// 背景样式由主题组合式函数统一计算（背景类型 / 自定义图片 / 遮罩浓度）
const { bgStyles, bgOverlayStyle } = useCyberTheme(settings)

// 主题色 → CSS 变量：发光、滚动条、扫描线等跟随设置变化
const ACCENT_MAP = {
  cyan: { main: '#22d3ee', glow: 'rgba(34, 211, 238, 0.55)' },
  blue: { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.55)' },
  purple: { main: '#a855f7', glow: 'rgba(168, 85, 247, 0.55)' },
  magenta: { main: '#ec4899', glow: 'rgba(236, 72, 153, 0.55)' },
  lime: { main: '#a3e635', glow: 'rgba(163, 230, 53, 0.55)' },
  amber: { main: '#fbbf24', glow: 'rgba(251, 191, 36, 0.55)' }
}

watch(
  () => settings.value.accentColor,
  (name) => {
    const color = ACCENT_MAP[name] || ACCENT_MAP.cyan
    const root = document.documentElement.style
    root.setProperty('--mynav-cyan-default', color.main)
    root.setProperty('--mynav-cyan-400', color.main)
    root.setProperty('--mynav-shadow-glow', color.glow)
  },
  { immediate: true }
)

// 把导航数据交给存储模块，供「导出备份」使用（避免循环依赖）
setNavDataProvider(() => navData.value)

// ==================== 页面状态 ====================
const filterCtrl = ref('')        // 搜索关键词（同时驱动卡片实时过滤）
const categoryTab = ref('全部')   // 当前分类标签
/**
 * 是否管理员（默认只读）。
 * 访客可以正常点开所有链接，但看不到编辑入口；
 * 站点主人访问 `?admin=1` 一次后会被记住，之后正常打开也有编辑入口。
 */
const isAdmin = ref(false)
const isEditMode = ref(false)     // 是否处于编辑模式
const isSettingsOpen = ref(false) // 设置面板开关
const editingItem = ref(null)     // 正在编辑的链接（null = 新增）
const showEditModal = ref(false)  // 编辑弹窗开关
const searchBarRef = ref(null)    // 搜索框组件引用（供快捷键聚焦）

// 导入结果提示（成功 / 失败都就地反馈，不再用阻塞式 alert）
const importNotice = ref(null)    // { type: 'ok' | 'error', lines: string[] }
let noticeTimer = null

function showNotice(type, lines) {
  importNotice.value = { type, lines: lines.filter(Boolean) }
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    importNotice.value = null
  }, 8000)
}

// ==================== 数据加载与全局同步 ====================
onMounted(async () => {
  // 先判定只读/管理员：?admin=1 开启后会把标记记在 localStorage，并清理地址栏
  isAdmin.value = bootstrapAdmin()
  await loadNavData()
  prefetchPanels()
})

/**
 * 渲染错误兜底
 *
 * 纯静态站最怕的是「某个组件抛错 → 整棵组件树被卸载 → 白屏，用户不知道该做什么」。
 * 这里把错误拦下来记到 renderError，页面主体继续可用，同时在顶部给出
 * 「重新加载 / 清空本地数据并重载」两个自救入口。
 * 返回 false 表示不再向上冒泡，避免 Vue 把根节点也卸掉。
 */
const renderError = ref('')
onErrorCaptured((error, _instance, info) => {
  console.error('[MyNav] 渲染异常:', info, error)
  renderError.value = `${info}：${error?.message || error}`
  return false
})

const reloadPage = () => window.location.reload()

/** 清空本站写入 localStorage 的全部键后再重载（本地数据损坏时的最后手段） */
const resetLocalAndReload = () => {
  try {
    localStorage.removeItem('mynav-settings')
    localStorage.removeItem('mynav-custom-nav')
    localStorage.removeItem('mynav-admin')
  } catch (error) {
    console.warn('清空本地数据失败（可能是隐私模式）:', error)
  }
  window.location.reload()
}

/**
 * 首屏渲染完成后、浏览器空闲时预取设置面板与编辑弹窗的 chunk。
 * 这样首屏不计入这两块体积，而用户点开时又几乎感觉不到加载。
 */
function prefetchPanels() {
  const load = () => {
    import('./components/SettingsPanel.vue')
    import('./components/EditModal.vue')
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(load, { timeout: 3000 })
  } else {
    setTimeout(load, 1500)
  }
}

// 把主题类挂到 <body> 上：main.css 里 dark/light 两套 CSS 变量靠它生效
watch(
  () => settings.value.theme,
  (theme) => {
    document.body.classList.toggle('dark', theme === 'dark')
    document.body.classList.toggle('light', theme !== 'dark')
  },
  { immediate: true }
)

// 同步浏览器标签页标题
watch(
  () => settings.value.siteTitle,
  (title) => {
    document.title = title || 'MyNav 导航站'
  },
  { immediate: true }
)

// ==================== 分类 ====================
// 第一个固定为「全部」，其余来自 nav.json 的 categories
const categories = computed(() => {
  const cats = [{ title: '全部', filter: null }]
  for (const cat of navData.value?.categories || []) {
    cats.push({ title: cat.title, filter: cat.filter })
  }
  return cats
})

// 置顶快捷链接（来自 nav.json 的 pinnedItems）
const pinnedItems = computed(() => navData.value?.pinnedItems || [])

// ==================== 过滤与搜索 ====================
const filteredLinks = computed(() => {
  const keyword = filterCtrl.value.toLowerCase().trim()

  // 未输入关键词：按当前分类过滤
  if (!keyword) {
    if (categoryTab.value === '全部') return navData.value?.items || []
    const cat = categories.value.find((c) => c.title === categoryTab.value)
    if (!cat?.filter) return navData.value?.items || []
    return (navData.value?.items || []).filter((item) =>
      item.tags?.some((tag) => cat.filter.includes(tag))
    )
  }

  // 输入关键词：全文匹配 名称/描述/标签/分类
  return (navData.value?.items || []).filter(
    (item) =>
      item.name?.toLowerCase().includes(keyword) ||
      item.desc?.toLowerCase().includes(keyword) ||
      item.tags?.some((tag) => tag.toLowerCase().includes(keyword)) ||
      item.category?.toLowerCase().includes(keyword)
  )
})

// ==================== 编辑弹窗 ====================
const openEdit = (item) => {
  // 只读模式下即使有人强行触发事件，也不打开编辑弹窗
  if (!isAdmin.value) return
  editingItem.value = item
  showEditModal.value = true
}

// ==================== 导入备份 ====================
/**
 * 导入流程：文件 → 解析校验 → 与当前数据合并 → 设置与链接分别落地 → 就地反馈结果
 *
 * 校验规则全部集中在 src/utils/backup.js（纯函数，有单测覆盖）：
 *   - 文件大小、JSON 合法性、来源标记、版本号
 *   - 链接必须带 name + 合法 http(s) url，非法条目跳过而不是整单失败
 *   - 只导入 items / pinnedItems，分类与搜索源始终以 nav.json 为准
 */
const handleImport = async (event) => {
  const file = event.target?.files?.[0]
  if (!file) return

  try {
    // 1) 解析 + 校验（超限、格式错误都在这里抛出可读错误）
    const parsed = parseBackup(await file.text())

    // 2) 与运行时数据合并：同 id 用备份覆盖，新 id 新增，其余保留
    const merged = mergeNavData(
      {
        items: navData.value?.items || [],
        pinnedItems: navData.value?.pinnedItems || []
      },
      parsed.navData
    )

    // 3) 设置写回本地存储；链接按「与 nav.json 的差异」持久化，刷新后仍在
    if (parsed.settings && Object.keys(parsed.settings).length) {
      saveSettings(parsed.settings)
    }
    if (!navData.value) await loadNavData()
    applyImportedData(merged)

    // 4) 反馈：条数 + 所有跳过/告警原因（不静默吞掉问题）
    const report = merged.report || {}
    showNotice('ok', [
      `导入完成：新增 ${report.added || 0} 条，更新 ${report.updated || 0} 条，置顶 ${report.pinnedAdded || 0} 条`,
      ...(parsed.warnings || []).slice(0, 4),
      ...(report.warnings || []).slice(0, 4)
    ])
  } catch (error) {
    showNotice('error', [error?.message || '导入失败，请检查备份文件'])
  } finally {
    // 清空 input，使同一文件可被重复选择
    if (event.target) event.target.value = ''
  }
}

// ==================== 全局快捷键 ====================
// "/"（可配置）聚焦搜索框；输入框聚焦时、或面板打开时不抢焦点
const handleGlobalKeydown = (e) => {
  if (isSettingsOpen.value || showEditModal.value) return
  const shortcut = settings.value.searchShortcut || '/'
  const el = document.activeElement
  const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
  if (e.key === shortcut && !typing) {
    e.preventDefault()
    searchBarRef.value?.focus()
  }
}

onMounted(() => window.addEventListener('keydown', handleGlobalKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  if (noticeTimer) clearTimeout(noticeTimer)
})
</script>

<template>
  <!-- 渲染降级提示：子组件抛错时不白屏，给用户两个自救入口 -->
  <div v-if="renderError" class="mynav-crash" role="alert">
    <p class="mynav-crash-title">页面出现渲染异常</p>
    <p class="mynav-crash-desc">
      先试着重新加载；如果反复出现，多半是本地缓存里的数据与当前版本不兼容，可以清空本地数据再重试。
      清空只影响本机，不会改动线上的 nav.json。
    </p>
    <div class="mynav-crash-actions">
      <button type="button" class="mynav-crash-btn" @click="reloadPage">重新加载</button>
      <button type="button" class="mynav-crash-btn ghost" @click="resetLocalAndReload">清空本地数据并重载</button>
    </div>
    <p class="mynav-crash-detail">{{ renderError }}</p>
  </div>

  <DefaultLayout>
    <!-- ========== 头部：标题、工具按钮、搜索、分类 ========== -->
    <template #header>
      <!-- 头部拆分为独立组件，搜索框与分类栏通过插槽注入 -->
      <Header
        :title="settings.siteTitle"
        :subtitle="settings.siteSubtitle"
        :is-edit-mode="isEditMode"
        :can-edit="isAdmin"
        :is-settings-open="isSettingsOpen"
        @toggle-edit="isEditMode = isAdmin && !isEditMode"
        @toggle-settings="isSettingsOpen = !isSettingsOpen"
        @add="openEdit(null)"
      >
        <template #actions>
          <Clock v-if="settings.showClock" />
        </template>

        <template #search>
          <SearchBar
            ref="searchBarRef"
            v-model="filterCtrl"
            :search-engines="navData?.searchEngines || []"
          />
        </template>

        <template #categories>
          <CategoryGroup
            v-for="cat in categories"
            :key="cat.title"
            :category="cat"
            :active="categoryTab === cat.title"
            @select="categoryTab = $event"
          />
        </template>
      </Header>
    </template>

    <!-- ========== 背景层（固定在最底层，可开关/换图） ========== -->
    <div class="mynav-background" :style="bgStyles" aria-hidden="true"></div>
    <div class="mynav-background-overlay" :style="bgOverlayStyle" aria-hidden="true"></div>

    <!-- ========== 导入结果提示：成功/失败都就地反馈，逐条列出告警 ========== -->
    <div
      v-if="importNotice"
      class="mynav-notice"
      :class="`mynav-notice--${importNotice.type}`"
      role="status"
      aria-live="polite"
    >
      <p v-for="(line, index) in importNotice.lines" :key="index" class="mynav-notice__line">
        {{ line }}
      </p>
      <button
        class="mynav-notice__close"
        type="button"
        aria-label="关闭提示"
        @click="importNotice = null"
      >
        ×
      </button>
    </div>

    <!-- ========== 主体：置顶区 + 链接网格 ========== -->
    <div v-if="settings.showPinned && pinnedItems.length" class="mynav-pinned">
      <h3 class="mynav-pinned-title">快速访问</h3>
      <div class="mynav-pinned-grid">
        <LinkCard
          v-for="item in pinnedItems"
          :key="item.id"
          :item="item"
          :editable="isEditMode"
          @edit="openEdit"
        />
      </div>
    </div>

    <div class="mynav-grid-container" :class="{ compact: settings.layoutMode === 'compact' }">
      <LinkCard
        v-for="item in filteredLinks"
        :key="item.id"
        :item="item"
        :spaced="settings.cardiSpacing === 'spaced'"
        :editable="isEditMode"
        @edit="openEdit"
      />
    </div>
    <p v-if="!filteredLinks.length" class="mynav-empty">
      没有匹配的链接，换个分类或关键词试试。
    </p>

    <!-- ========== 设置面板（弹出层） ========== -->
    <template #settings-panel>
      <SettingsPanel
        v-if="isSettingsOpen"
        :can-edit="isAdmin"
        @close="isSettingsOpen = false"
        @import="handleImport"
      />
    </template>

    <!-- ========== 页脚 ========== -->
    <template #footer>
      <footer class="mynav-footer">
        <p class="mynav-footer-text">
          {{ settings.siteSubtitle }} · {{ new Date().getFullYear() }} ·
          隐私优先：所有数据仅保存在本浏览器
        </p>
        <button v-if="isEditMode" class="mynav-footer-edit" @click="openEdit(null)">
          ＋ 新增链接
        </button>
      </footer>
    </template>

    <!-- ========== 赛博特效（扫描线 / 光标拖尾） ========== -->
    <CyberEffect />

    <!-- ========== 编辑弹窗 ========== -->
    <EditModal v-model:show="showEditModal" :item="editingItem" />
  </DefaultLayout>
</template>

<style scoped>
.mynav-pinned {
  @apply mb-8 border-l-4 border-cyan-500 pl-4;
}

.mynav-pinned-title {
  @apply text-lg font-bold text-cyan-400 mb-4
         uppercase tracking-wider;
  margin: 0 0 1rem 0;
}

.mynav-pinned-grid {
  @apply grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4;
}

.mynav-grid-container {
  @apply grid gap-6;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
  @media (min-width: 641px) and (max-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (min-width: 769px) and (max-width: 1024px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  @media (min-width: 1025px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

/* 紧凑布局：卡片更密集 */
.mynav-grid-container.compact {
  gap: 0.75rem;
}

.mynav-empty {
  @apply text-sm text-gray-500 py-8 text-center;
}

.mynav-footer {
  @apply mt-12 py-6 border-t border-gray-800
         flex items-center justify-between flex-wrap gap-3;
}

.mynav-footer-text {
  @apply text-xs text-gray-500 m-0;
}

.mynav-footer-edit {
  @apply px-4 py-2 rounded-lg
         bg-cyan-600 hover:bg-cyan-500
         text-white text-sm font-medium
         transition-all duration-200 active:scale-95;
}
.mynav-background {
  position: fixed;
  inset: 0;
  z-index: -2;
  background-size: cover;
  background-position: center;
  transition: background 0.3s ease;
}

.mynav-background-overlay {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}
</style>
