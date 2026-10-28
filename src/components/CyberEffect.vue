<script setup>
/**
 * CyberEffect —— 赛博朋克全局特效层
 *
 * 两项特效均由设置控制，可随时开关：
 *   1) 扫描线：固定在视口最上层的半透明横扫线（样式见 main.css）
 *   2) 光标拖尾：鼠标移动时留下短暂衰减的光点（本组件用 JS 动态生成）
 *
 * 性能与可访问性：
 *   - 光标拖尾做节流（约 24ms），并对同时存在的拖尾点数量设上限
 *   - 检测到系统开启「减少动态效果」时，自动禁用拖尾
 */
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useLocalStorage } from '../composables/useLocalStorage'

const props = defineProps({
  // 父级总开关（可整体关闭本特效层）
  enabled: { type: Boolean, default: true }
})

const { settings } = useLocalStorage()

const scanlineEnabled = computed(() => props.enabled && Boolean(settings.value.effects?.scanline))
const cursorTrailEnabled = computed(() => props.enabled && Boolean(settings.value.effects?.cursorTrail))

// ==================== 光标拖尾 ====================
const TRAIL_LIFETIME = 600        // 单个光点存活时间（ms），与 CSS 动画时长一致
const TRAIL_INTERVAL = 24         // 生成节流间隔（ms）
const TRAIL_MAX = 24              // 同时存在的最大光点数

let lastEmit = 0
let reducedMotion = false

const handleMouseMove = (event) => {
  if (!cursorTrailEnabled.value) return

  const now = performance.now()
  if (now - lastEmit < TRAIL_INTERVAL) return
  lastEmit = now

  // 防止极端情况下光点堆积
  if (document.querySelectorAll('.mynav-cursor-dot').length >= TRAIL_MAX) return

  const dot = document.createElement('span')
  dot.className = 'mynav-cursor-dot'
  dot.style.left = `${event.clientX}px`
  dot.style.top = `${event.clientY}px`
  document.body.appendChild(dot)

  // 动画结束后移除（同时用定时器兜底，避免后台标签页动画不触发）
  const remove = () => dot.remove()
  dot.addEventListener('animationend', remove, { once: true })
  window.setTimeout(remove, TRAIL_LIFETIME + 200)
}

onMounted(() => {
  reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  if (!reducedMotion) {
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  // 清理可能残留的光点
  document.querySelectorAll('.mynav-cursor-dot').forEach((dot) => dot.remove())
})
</script>

<template>
  <!-- 扫描线：铺满视口的扫掠动画层 -->
  <div v-if="scanlineEnabled" class="scanline-overlay" aria-hidden="true"></div>
</template>

<style>
/* 光标拖尾光点：必须是非 scoped 样式，因为节点被动态挂到 body 上 */
.mynav-cursor-dot {
  position: fixed;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 9999px;
  pointer-events: none;
  z-index: 9999;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.9) 0%, rgba(34, 211, 238, 0) 70%);
  box-shadow: 0 0 8px rgba(34, 211, 238, 0.6);
  animation: mynav-trail-fade 600ms ease-out forwards;
}

@keyframes mynav-trail-fade {
  0% {
    opacity: 0.9;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.2);
  }
}

/* 尊重系统「减少动态效果」设置 */
@media (prefers-reduced-motion: reduce) {
  .mynav-cursor-dot {
    display: none;
  }
}
</style>
