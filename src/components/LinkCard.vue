<script setup>
/**
 * LinkCard —— 单条导航链接卡片
 *
 * 交互约定：
 *   - 点击卡片本体：新标签打开链接
 *   - 编辑模式下右上角出现编辑按钮，点击只触发 edit 事件（不跳转）
 *   - 标签用 v-for 渲染，不使用 v-html，避免注入风险
 */
import { computed } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'
import { useLocalStorage } from '../composables/useLocalStorage'

const props = defineProps({
  // 链接数据，字段见 nav.json schema
  item: { type: Object, required: true },
  // 是否使用更宽松的间距（置顶区等场景）
  spaced: { type: Boolean, default: false },
  // 是否处于编辑模式
  editable: { type: Boolean, default: false }
})

const emit = defineEmits(['edit'])

const { settings } = useLocalStorage()

// 标签中文映射（未收录的标签原样显示）
const TAG_LABELS = {
  dev: '开发',
  tools: '工具',
  design: '设计',
  creative: '创意',
  learn: '学习',
  edu: '教育',
  fun: '娱乐',
  media: '媒体',
  news: '资讯',
  common: '常用',
  daily: '日常'
}

const iconName = computed(() => props.item?.icon || 'mdi:link-variant')
const tagList = computed(() => (Array.isArray(props.item?.tags) ? props.item.tags : []))
const labelOf = (tag) => TAG_LABELS[tag] || tag

// 霓虹边框开关
const neonClass = computed(() => (settings.value.effects?.neonBorders ? 'neon-border' : ''))

// 打开链接
const openLink = () => {
  const url = props.item?.url
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

// 进入编辑（不触发跳转）
const handleEdit = (event) => {
  event.preventDefault()
  event.stopPropagation()
  emit('edit', props.item)
}
</script>

<template>
  <article
    class="mynav-link-card"
    :class="[spaced ? 'is-spaced' : '', neonClass]"
    role="link"
    tabindex="0"
    @click="openLink"
    @keydown.enter.prevent="openLink"
  >
    <!-- 编辑按钮（仅编辑模式显示） -->
    <button
      v-if="editable"
      class="card-edit-btn"
      type="button"
      title="编辑这条链接"
      @click="handleEdit"
    >
      <IconifyIcon icon="mdi:pencil-outline" />
    </button>

    <!-- 图标 + 名称 -->
    <div class="card-head">
      <span class="card-icon">
        <IconifyIcon :icon="iconName" />
      </span>
      <h3 class="card-name">{{ item.name }}</h3>
    </div>

    <!-- 描述 -->
    <p v-if="item.desc" class="card-desc">{{ item.desc }}</p>

    <!-- 标签 -->
    <div v-if="tagList.length" class="card-tags">
      <span v-for="tag in tagList" :key="tag" class="card-tag">{{ labelOf(tag) }}</span>
    </div>
  </article>
</template>

<style scoped>
.mynav-link-card {
  @apply relative flex flex-col gap-3
         p-4 rounded-xl
         border border-gray-700
         bg-gray-900/70
         cursor-pointer
         transition-all duration-300;
}

/* 置顶区卡片更宽松 */
.mynav-link-card.is-spaced {
  @apply p-5 gap-4;
}

/* 悬停：轻微上浮 + 青色描边发光 */
.mynav-link-card:hover,
.mynav-link-card:focus-visible {
  @apply border-cyan-400 bg-gray-900;
  transform: translateY(-4px);
  box-shadow: 0 8px 28px rgba(34, 211, 238, 0.25);
  outline: none;
}

.neon-border:hover {
  box-shadow: 0 8px 28px rgba(34, 211, 238, 0.35),
              0 0 0 1px rgba(34, 211, 238, 0.35) inset;
}

.card-head {
  @apply flex items-center gap-3 min-w-0;
}

.card-icon {
  @apply flex items-center justify-center
         w-9 h-9 rounded-lg
         bg-cyan-500/10 text-cyan-300 text-xl
         shrink-0;
}

.card-name {
  @apply text-base font-semibold text-white truncate m-0;
}

.card-desc {
  @apply text-xs text-gray-400 leading-relaxed m-0;
}

.card-tags {
  @apply flex flex-wrap gap-2 mt-auto;
}

.card-tag {
  @apply px-2 py-0.5 rounded
         text-[10px] text-cyan-300/80
         border border-cyan-500/20 bg-cyan-500/5;
}

.card-edit-btn {
  @apply absolute top-2 right-2
         p-1.5 rounded-md
         text-gray-400 bg-gray-800/80
         border border-gray-700
         transition-colors duration-200
         hover:text-cyan-300 hover:border-cyan-400;
  z-index: 2;
}
</style>
