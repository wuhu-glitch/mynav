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
const TRAIL_LIFETIME = 420        // 单个光点存活时间（ms），与 CSS 动画时长一致
const TRAIL_INTERVAL = 48         // 生成节流间隔（ms）：比原来 24ms 少一半节点
const TRAIL_MAX = 8               // 同时存在的最大光点数（原来 24，太多会拖慢合成）

let lastEmit = 0
let reducedMotion = false
let coarsePointer = false
const liveDots = new Set()        // 自己记数，避免每次移动都 querySelectorAll 扫 DOM

const handleMouseMove = (event) => {
  if (!cursorTrailEnabled.value || coarsePointer) return

  const now = performance.now()
  if (now - lastEmit < TRAIL_INTERVAL) return
  lastEmit = now

  // 防止极端情况下光点堆积
  if (liveDots.size >= TRAIL_MAX) return

  const dot = document.createElement('span')
  dot.className = 'mynav-cursor-dot'
  dot.style.left = `${event.clientX}px`
  dot.style.top = `${event.clientY}px`
  document.body.appendChild(dot)
  liveDots.add(dot)

  // 动画结束后移除（同时用定时器兜底，避免后台标签页动画不触发）
  let removed = false
  const remove = () => {
    if (removed) return
    removed = true
    liveDots.delete(dot)
    dot.remove()
  }
  dot.addEventListener('animationend', remove, { once: true })
  window.setTimeout(remove, TRAIL_LIFETIME + 150)
}

onMounted(() => {
  reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  // 触摸设备（无悬停能力）不生成拖尾，手指拖动时既看不到又白耗性能
  coarsePointer = window.matchMedia?.('(hover: none)')?.matches ?? false
  if (!reducedMotion) {
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  // 清理可能残留的光点
  liveDots.forEach((dot) => dot.remove())
  liveDots.clear()
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
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 9999px;
  pointer-events: none;
  z-index: 9999;
  /* 性能说明：原来用 radial-gradient + box-shadow，每个光点都会多一层
     阴影绘图；改成纯色 + 透明度动画，合成器只处理 transform/opacity。 */
  background: rgba(34, 211, 238, 0.85);
  animation: mynav-trail-fade 420ms ease-out forwards;
  will-change: transform, opacity;
}

@keyframes mynav-trail-fade {
  0% {
    opacity: 0.75;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.35);
  }
}

/* 尊重系统「减少动态效果」设置 */
@media (prefers-reduced-motion: reduce) {
  .mynav-cursor-dot {
    display: none;
  }
}
</style>
