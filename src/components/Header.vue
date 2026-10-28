<script setup>
/**
 * Header —— 头部区域（展示型组件）
 *
 * 职责：标题 / 副标题 / 右上角工具按钮（时钟、编辑、设置、新增）。
 * 搜索框与分类标签栏通过插槽注入，保持布局与业务解耦：
 *   #actions     右上角扩展区（例如时钟）
 *   #search      搜索框
 *   #categories  分类标签
 *
 * 状态由父组件（App.vue）持有，本组件只负责发出事件。
 */
import { computed } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'
import { useLocalStorage } from '../composables/useLocalStorage'

const props = defineProps({
  title: { type: String, default: 'MyNav 个人导航站' },
  subtitle: { type: String, default: '' },
  // 是否处于编辑模式
  isEditMode: { type: Boolean, default: false },
  // 设置面板是否打开
  isSettingsOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-edit', 'toggle-settings', 'add'])

const { settings } = useLocalStorage()

// 标题特效类：发光 / 故障文字分别受设置开关控制
const titleClass = computed(() => [
  settings.value.effects?.glowText ? 'glow-text' : '',
  settings.value.effects?.glitch ? 'glitch-text' : ''
])
</script>

<template>
  <header class="mynav-header">
    <!-- 标题区 + 工具按钮 -->
    <div class="mynav-header-main">
      <div class="mynav-header-left">
        <h1 class="mynav-title font-mono" :class="titleClass" :data-text="props.title">
          {{ props.title }}
        </h1>
        <p v-if="props.subtitle" class="mynav-subtitle">{{ props.subtitle }}</p>
      </div>

      <div class="mynav-header-actions">
        <!-- 扩展区：时钟等 -->
        <slot name="actions" />

        <!-- 编辑模式开关 -->
        <button
          class="mynav-icon-btn"
          :class="{ active: props.isEditMode }"
          type="button"
          :title="props.isEditMode ? '退出编辑模式' : '进入编辑模式'"
          @click="emit('toggle-edit')"
        >
          <IconifyIcon icon="mdi:pencil" />
        </button>

        <!-- 设置面板开关 -->
        <button
          class="mynav-icon-btn"
          :class="{ active: props.isSettingsOpen }"
          type="button"
          title="设置"
          @click="emit('toggle-settings')"
        >
          <IconifyIcon icon="mdi:cog" />
        </button>

        <!-- 编辑模式下才显示「新增链接」 -->
        <button
          v-if="props.isEditMode"
          class="mynav-icon-btn mynav-add-btn"
          type="button"
          title="新增链接"
          @click="emit('add')"
        >
          <IconifyIcon icon="mdi:plus" />
        </button>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="mynav-search-wrapper">
      <slot name="search" />
    </div>

    <!-- 分类标签栏 -->
    <div class="mynav-category-tabs">
      <slot name="categories" />
    </div>
  </header>
</template>

<style scoped>
.mynav-header {
  position: relative;
  z-index: 10;
  margin-bottom: 2rem;
  @apply flex flex-col gap-4;
}

.mynav-header-main {
  @apply flex flex-col items-start;
  gap: 0.5rem;
}

@media (min-width: 768px) {
  .mynav-header-main {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
}

.mynav-header-left {
  @apply flex flex-col;
  gap: 0.25rem;
}

/* 标题 / 副标题：字号统一读 main.css 里的 CSS 变量，
   响应式断点放在本组件的 scoped 样式里 —— 保证不会被全局同名规则盖掉 */
.mynav-title {
  font-size: var(--mynav-title-size, 2.25rem);
  font-weight: 700;
  color: #f0f8ff;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  line-height: 1.25;
  margin: 0;
  /* 长标题不换行撑破布局：优先整体缩放，实在放不下才折行 */
  overflow-wrap: anywhere;
}

.mynav-subtitle {
  font-size: var(--mynav-subtitle-size, 0.9rem);
  color: #94a3b8;
  letter-spacing: 0.05em;
  line-height: 1.5;
  margin: 0;
}

@media (max-width: 640px) {
  .mynav-title {
    font-size: var(--mynav-title-size-sm, 1.75rem);
    letter-spacing: 0.06em;
  }

  .mynav-subtitle {
    font-size: var(--mynav-subtitle-size-sm, 0.75rem);
  }
}

.mynav-header-actions {
  @apply flex items-center gap-3 flex-wrap;
}

.mynav-icon-btn {
  @apply relative p-2 rounded-lg
         transition-all duration-200 border border-gray-700
         bg-gray-900 text-gray-400 hover:text-white
         hover:border-cyan-500 hover:bg-gray-800
         active:scale-95
         inline-flex items-center justify-center;
  width: 40px;
  height: 40px;
}

.mynav-icon-btn.active {
  @apply text-cyan-400 border-cyan-400;
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.5);
}

.mynav-add-btn {
  @apply bg-cyan-600 text-white border-cyan-500 hover:bg-cyan-500;
}

.mynav-search-wrapper {
  @apply mb-2;
}

.mynav-category-tabs {
  @apply flex flex-wrap gap-2;
}
</style>
