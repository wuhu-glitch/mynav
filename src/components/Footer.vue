<script setup>
/**
 * Footer —— 页脚
 *
 * 显示站点副标题 + 年份 + 隐私说明；
 * 编辑模式下额外显示「新增链接」按钮。
 */
import { Icon as IconifyIcon } from '@iconify/vue'
import { useLocalStorage } from '../composables/useLocalStorage'

const props = defineProps({
  // 是否处于编辑模式（由父组件控制）
  editable: { type: Boolean, default: false }
})

const emit = defineEmits(['add'])

const { settings } = useLocalStorage()

const currentYear = new Date().getFullYear()

// 新增链接（交给父组件打开弹窗）
const handleAdd = () => emit('add')
</script>

<template>
  <footer class="mynav-footer">
    <p class="mynav-footer-text">
      {{ settings.siteSubtitle }} · {{ currentYear }} · 隐私优先：所有数据仅保存在本浏览器
    </p>

    <button v-if="props.editable" class="mynav-footer-add" @click="handleAdd">
      <IconifyIcon icon="mdi:plus" />
      新增链接
    </button>
  </footer>
</template>

<style scoped>
.mynav-footer {
  @apply mt-12 py-6 border-t border-gray-800
         flex items-center justify-between flex-wrap gap-3;
}

.mynav-footer-text {
  @apply text-xs text-gray-500 m-0;
}

.mynav-footer-add {
  @apply flex items-center gap-2
         px-4 py-2 rounded-lg
         bg-cyan-600 hover:bg-cyan-500
         text-white text-sm font-medium
         transition-all duration-200 active:scale-95;
}
</style>
