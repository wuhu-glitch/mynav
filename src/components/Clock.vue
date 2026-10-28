<script setup>
/**
 * Clock —— 赛博风时钟
 *
 * 每秒刷新一次时间；组件卸载时清理定时器，避免内存泄漏。
 * 发光效果跟随设置里的 effects.glowText 与当前主题。
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useLocalStorage } from '../composables/useLocalStorage'

const { settings } = useLocalStorage()

const now = ref(new Date())
let timer = null

// 补零工具：9 → "09"
const pad = (value) => String(value).padStart(2, '0')

const timeText = computed(() => {
  const date = now.value
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
})

const dateText = computed(() => {
  const date = now.value
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
})

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const weekdayText = computed(() => WEEKDAYS[now.value.getDay()])

// 发光开关（返回合法 Tailwind 类名，避免拼接出无效类）
const glowClass = computed(() => {
  if (!settings.value.effects?.glowText) return ''
  return settings.value.theme === 'dark' ? 'clock-glow' : 'clock-glow-light'
})

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
})
</script>

<template>
  <div class="mynav-clock" :class="glowClass" title="当前时间">
    <div class="clock-time">{{ timeText }}</div>
    <div class="clock-meta">
      <span>{{ dateText }}</span>
      <span class="clock-dot">·</span>
      <span>{{ weekdayText }}</span>
    </div>
  </div>
</template>

<style scoped>
.mynav-clock {
  @apply hidden sm:flex flex-col items-end
         px-4 py-2 rounded-lg
         border border-gray-700 bg-gray-900/60;
  min-width: 150px;
}

.clock-time {
  @apply font-mono text-2xl font-bold tracking-widest text-cyan-400;
  line-height: 1.2;
}

.clock-meta {
  @apply flex items-center gap-1 text-xs text-gray-500 mt-1;
}

.clock-dot {
  @apply text-gray-600;
}

.clock-glow .clock-time {
  text-shadow: 0 0 10px rgba(34, 211, 238, 0.7), 0 0 24px rgba(34, 211, 238, 0.35);
}

.clock-glow-light .clock-time {
  @apply text-cyan-700;
  text-shadow: none;
}
</style>
