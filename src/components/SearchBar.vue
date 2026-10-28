<script setup>
/**
 * SearchBar —— 搜索框组件
 *
 * 功能：
 *   - v-model 双向绑定搜索词（父组件用它做卡片实时过滤）
 *   - 多搜索引擎切换（引擎来自 nav.json 的 searchEngines）
 *   - Enter / 点击按钮跳转到搜索引擎结果页
 *   - 暴露 focus()，供全局快捷键（默认 "/"）聚焦
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'
import { useLocalStorage } from '../composables/useLocalStorage'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '输入关键词搜索' },
  searchEngines: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'search'])

const { settings } = useLocalStorage()

// 兜底引擎：nav.json 未配置 searchEngines 时也能用
const FALLBACK_ENGINE = { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={query}' }

const inputEl = ref(null)
const searchInput = ref(props.modelValue)
const showEngineSelector = ref(false)
const selectedEngine = ref(props.searchEngines?.[0] || FALLBACK_ENGINE)

// 外部改动搜索词（如快捷键清空）时同步输入框，避免互相覆盖
watch(() => props.modelValue, (val) => {
  const next = val ?? ''
  if (next !== searchInput.value) searchInput.value = next
})

// 输入时同步给父组件（供实时过滤）
watch(searchInput, (val) => {
  if (val !== props.modelValue) emit('update:modelValue', val)
})

// 引擎列表异步到位后，若当前引擎已失效则回退到第一个
watch(() => props.searchEngines, (list) => {
  if (!Array.isArray(list) || !list.length) return
  if (!list.some((engine) => engine.id === selectedEngine.value?.id)) {
    selectedEngine.value = list[0]
  }
}, { deep: true })

const currentEngine = computed(() => selectedEngine.value || FALLBACK_ENGINE)
const currentEngineName = computed(() => currentEngine.value.name)
const currentPlaceholder = computed(() => `${currentEngineName.value} · ${props.placeholder}`)
const shortcut = computed(() => settings.value.searchShortcut || '/')

// 引擎图标映射（找不到就用放大镜兜底）
const ENGINE_ICONS = {
  baidu: 'simple-icons:baidu',
  bing: 'mdi:microsoft-bing',
  github: 'mdi:github',
  zhihu: 'simple-icons:zhihu',
  bilibili: 'simple-icons:bilibili'
}
const engineIcon = computed(() => ENGINE_ICONS[currentEngine.value.id] || 'mdi:magnify')

const selectEngine = (engine) => {
  selectedEngine.value = engine
  showEngineSelector.value = false
}

// 提交搜索：替换 url 中的 {query} 占位符，新标签打开
const handleSubmit = () => {
  const query = searchInput.value.trim()
  if (!query) {
    inputEl.value?.focus()
    return
  }
  const url = currentEngine.value.url.replace('{query}', encodeURIComponent(query))
  emit('search', query)
  window.open(url, '_blank', 'noopener,noreferrer')
}

// 点击下拉框外部时收起（避免一直挡着界面）
const handleOutsideClick = (event) => {
  if (!event.target?.closest?.('.mynav-search-bar')) showEngineSelector.value = false
}
onMounted(() => document.addEventListener('click', handleOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', handleOutsideClick))

// 供全局快捷键调用
const focus = () => {
  inputEl.value?.focus()
  inputEl.value?.select?.()
}
defineExpose({ focus })
</script>

<template>
  <div class="mynav-search-bar">
    <div class="mynav-search-box">
      <!-- 搜索引擎切换 -->
      <button
        v-if="searchEngines.length > 1"
        class="mynav-search-engine-btn"
        type="button"
        @click="showEngineSelector = !showEngineSelector"
      >
        <IconifyIcon :icon="engineIcon" />
        <span>{{ currentEngineName }}</span>
        <IconifyIcon icon="mdi:chevron-down" class="mynav-chevron" />
      </button>

      <!-- 搜索输入框 -->
      <input
        ref="inputEl"
        v-model="searchInput"
        type="text"
        :placeholder="currentPlaceholder"
        class="mynav-search-input"
        @keyup.enter="handleSubmit"
      />

      <!-- 搜索按钮 -->
      <button class="mynav-search-btn" type="button" title="搜索（Enter）" @click="handleSubmit">
        <IconifyIcon icon="mdi:magnify" />
      </button>
    </div>

    <!-- 引擎下拉 -->
    <div v-if="showEngineSelector" class="mynav-engine-dropdown">
      <div
        v-for="engine in searchEngines"
        :key="engine.id"
        class="mynav-engine-option"
        @click="selectEngine(engine)"
      >
        <IconifyIcon :icon="ENGINE_ICONS[engine.id] || 'mdi:magnify'" />
        <span>{{ engine.name }}</span>
      </div>
    </div>

    <!-- 快捷键提示 -->
    <div class="mynav-search-hint">
      <span>快捷键</span>
      <kbd>{{ shortcut }}</kbd>
      <span>聚焦搜索框</span>
    </div>
  </div>
</template>

<style scoped>
.mynav-search-bar {
  @apply relative;
}

.mynav-search-box {
  @apply relative flex items-center gap-2
         rounded-lg
         transition-all duration-300
         border border-gray-700
         bg-gray-900
         focus-within:border-cyan-500;
}

.mynav-search-box:focus-within {
  box-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
}

.mynav-search-engine-btn {
  @apply flex items-center gap-2 px-4 py-2
         text-sm text-gray-400
         transition-colors
         border-r border-gray-700
         hover:text-cyan-400;
  /* 触摸友好：按钮高度不低于 40px（原 py-2 只有 36px，手机上不好点） */
  min-height: 40px;
}

.mynav-chevron {
  @apply w-3 h-3;
}

.mynav-search-input {
  @apply flex-1 px-4 py-2
         bg-transparent
         text-white
         outline-none;
  /* 移动端字号 < 16px 时 iOS Safari 会自动放大页面，这里强制 16px 防跳 */
  font-size: 16px;
}

.mynav-search-btn {
  @apply p-2 mr-1 rounded-lg
         flex items-center justify-center
         text-cyan-400
         hover:bg-cyan-500/10;
  /* 触摸友好：原来 p-2 + 24px 图标只有 32×32，手指容易点空 */
  width: 40px;
  height: 40px;
}

/* 窄屏再放大一点，保证拇指可点 */
@media (max-width: 640px) {
  .mynav-search-btn {
    width: 44px;
    height: 44px;
  }
}

.mynav-search-btn:hover {
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.4);
}

.mynav-search-hint {
  @apply flex items-center justify-center gap-2 mt-3 text-xs text-gray-500;
}

/* 手机上没物理键盘，「按 / 聚焦」提示没有意义，直接隐藏省出竖向空间 */
@media (max-width: 640px) {
  .mynav-search-hint {
    display: none;
  }
}

kbd {
  @apply px-2 py-0.5 rounded bg-gray-800
         text-gray-400 border border-gray-700;
}

.mynav-engine-dropdown {
  @apply absolute top-full left-0 mt-2
         w-40 rounded-lg
         bg-gray-900 border border-gray-700
         shadow-xl overflow-hidden
         z-50;
}

.mynav-engine-option {
  @apply flex items-center gap-2 px-4 py-3
         text-sm text-gray-400
         cursor-pointer
         transition-colors
         hover:bg-cyan-500/10 hover:text-cyan-400;
}
</style>
