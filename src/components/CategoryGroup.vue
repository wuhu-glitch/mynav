<script setup>
/**
 * CategoryGroup —— 分类标签按钮
 *
 * 数据来自 nav.json 的 categories，由父组件遍历渲染；
 * 每个按钮只负责「显示图标 + 标题」并在点击时向上抛出分类标题。
 */
import { computed } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'

const props = defineProps({
  // { title, filter } —— filter 仅用于数据过滤，组件不关心其内容
  category: { type: Object, required: true },
  active: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

// 分类 → 图标（找不到时用通用标签图标兜底）
const CATEGORY_ICONS = {
  全部: 'mdi:apps',
  开发工具: 'mdi:code-tags',
  创意设计: 'mdi:palette',
  学习资源: 'mdi:school',
  娱乐休闲: 'mdi:gamepad-variant',
  常用网站: 'mdi:web',
  媒体搜索: 'mdi:newspaper'
}

const iconName = computed(() => CATEGORY_ICONS[props.category?.title] || 'mdi:tag-outline')

const handleClick = () => emit('select', props.category?.title)
</script>

<template>
  <button class="mynav-category" :class="{ active }" type="button" @click="handleClick">
    <IconifyIcon :icon="iconName" />
    <span>{{ category?.title || '未命名分类' }}</span>
  </button>
</template>

<style scoped>
.mynav-category {
  @apply relative flex items-center gap-2
         px-4 py-2 rounded-lg
         border border-gray-700
         bg-gray-900/60
         text-sm text-gray-400
         transition-all duration-300
         hover:border-cyan-500/60 hover:text-cyan-300;
  /* 触摸友好：py-2 实际高度只有 38px，统一抬到 40px */
  min-height: 40px;
}

/* 窄屏把分类按钮做成 44px 高的「胶囊」，两行排列也不会太挤 */
@media (max-width: 640px) {
  .mynav-category {
    min-height: 44px;
    padding-left: 0.875rem;
    padding-right: 0.875rem;
    flex: 0 0 auto;
  }
}

.mynav-category.active {
  @apply border-cyan-400 text-cyan-300 bg-cyan-500/10;
  box-shadow: 0 0 16px rgba(34, 211, 238, 0.35);
}

.mynav-category:active {
  @apply scale-95;
}
</style>
