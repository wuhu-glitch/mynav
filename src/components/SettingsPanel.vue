<script setup>
/**
 * SettingsPanel —— 设置面板（弹出层）
 *
 * 设计说明：
 *   - 不接收 modelValue，也不维护本地副本，直接读写 useLocalStorage 的单例 settings，
 *     因此面板里任何改动都会立刻作用到全站，且自动持久化到 localStorage。
 *   - 只通过事件和父组件通信：
 *       close  —— 关闭面板
 *       import —— 冒泡文件选择事件（由父组件读取备份 JSON）
 */
import { ref, computed } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'
import { useLocalStorage } from '../composables/useLocalStorage'
import { useNavData } from '../composables/useNavData'

const props = defineProps({
  // 只有管理员才看得到「数据与备份」区（导入会改变本地内容）
  canEdit: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'import'])

const { settings, resetSettings, exportData } = useLocalStorage()
const { resetCustomNav } = useNavData()

// 备份导入用的隐藏文件输入框
const importInput = ref(null)

// 主题色候选（与 tailwind.config.js 的 accent 色板保持一致）
const accentColors = [
  { id: 'cyan', name: '霓虹青', hex: '#22d3ee' },
  { id: 'blue', name: '电光蓝', hex: '#3b82f6' },
  { id: 'purple', name: '幻影紫', hex: '#a855f7' },
  { id: 'magenta', name: '洋红', hex: '#f472b6' },
  { id: 'lime', name: '荧光绿', hex: '#a3e635' }
]

// 背景类型（与 useCyberTheme.js 的分支 id 一一对应，名称不能随意改）
const bgTypes = [
  { id: 'gradient-radial-2', name: '霓虹光晕', icon: 'mdi:blur-radial' },
  { id: 'gradient-radial', name: '中心辐射', icon: 'mdi:circle-opacity' },
  { id: 'gradient', name: '渐变霓虹', icon: 'mdi:gradient-horizontal' },
  { id: 'grid', name: '网格', icon: 'mdi:grid' },
  { id: 'circuit-board', name: '电路板', icon: 'mdi:chip' },
  { id: 'solid', name: '纯色', icon: 'mdi:circle' },
  { id: 'image', name: '自定义图片', icon: 'mdi:image' }
]

// 卡片间距（key 必须与 CSS / App 中的读取保持一致：紧凑/标准/宽松）
const spacings = [
  { id: 'compact', name: '紧凑' },
  { id: 'normal', name: '标准' },
  { id: 'spaced', name: '宽松' }
]

// 布局模式
const layoutModes = [
  { id: 'grid', name: '大网格', icon: 'mdi:view-grid' },
  { id: 'compact', name: '紧凑列表', icon: 'mdi:view-list' }
]

// 特效开关配置表（v-model 直接绑定 settings.effects.*）
const effectToggles = [
  { key: 'scanline', name: '扫描线', desc: '全屏 CRT 扫描线氛围' },
  { key: 'glitch', name: '故障文字', desc: '标题故障抖动效果' },
  { key: 'neonBorders', name: '霓虹边框', desc: '卡片边框发光' },
  { key: 'glowText', name: '发光文字', desc: '标题霓虹辉光' },
  { key: 'cursorTrail', name: '光标拖尾', desc: '鼠标移动残影' }
]

// 数据来源说明（隐私优先，全部本地）
const storageTip = computed(() => '所有设置仅保存在本机 localStorage，不会上传到任何服务器。')

// 恢复默认：整体重置外观设置，并清掉本地新增/修改/删除过的链接改动
const handleReset = () => {
  if (
    !window.confirm(
      '确定恢复全部默认设置？\n\n这会重置主题、布局与特效，并丢弃你在页面上对链接做过的增删改（nav.json 原始配置会恢复）。'
    )
  ) {
    return
  }
  resetSettings()
  resetCustomNav()
}

// 选择背景图片
// 注意：图片会转成 DataURL 存进 localStorage，主流浏览器单域名上限约 5MB，
// 因此这里限制在 1.5MB 以内，避免「设置一存就写满配额」导致整份设置丢失。
const MAX_BG_IMAGE_BYTES = 1.5 * 1024 * 1024
const handleBgImageChange = (event) => {
  const file = event.target?.files?.[0]
  if (!file) return
  if (file.size > MAX_BG_IMAGE_BYTES) {
    window.alert('背景图片不能超过 1.5MB（要存进浏览器 localStorage），请换一张小一点的。')
    event.target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => {
    settings.value.bgImage = String(e.target?.result || '')
  }
  reader.readAsDataURL(file) // 转成 DataURL 存进 localStorage，避免依赖外链
  event.target.value = ''
}

// 触发隐藏的导入输入框
const triggerImport = () => importInput.value?.click()
</script>

<template>
  <div class="mynav-settings-mask" @click.self="emit('close')">
    <aside class="mynav-settings-panel">
      <!-- 面板头部 -->
      <header class="panel-header">
        <h2 class="panel-title">
          <IconifyIcon icon="mdi:cog-outline" />
          设置
        </h2>
        <button class="panel-close" type="button" title="关闭" @click="emit('close')">
          <IconifyIcon icon="mdi:close" />
        </button>
      </header>

      <div class="panel-body">
        <!-- ==================== 1. 站点信息 ==================== -->
        <section class="panel-section">
          <h3 class="section-title">
            <IconifyIcon icon="mdi:information-outline" />
            站点信息
          </h3>

          <div class="field">
            <label class="field-label">站点标题</label>
            <input v-model="settings.siteTitle" class="field-input" placeholder="MyNav 个人导航站" />
          </div>

          <div class="field">
            <label class="field-label">站点副标题</label>
            <input v-model="settings.siteSubtitle" class="field-input" placeholder="赛博朋克风 个人聚合导航" />
          </div>
        </section>

        <!-- ==================== 2. 主题外观 ==================== -->
        <section class="panel-section">
          <h3 class="section-title">
            <IconifyIcon icon="mdi:palette-outline" />
            主题外观
          </h3>

          <!-- 亮/暗色 -->
          <div class="field">
            <label class="field-label">配色模式</label>
            <div class="segmented">
              <button
                class="segmented-btn"
                :class="{ active: settings.theme === 'dark' }"
                type="button"
                @click="settings.theme = 'dark'"
              >
                <IconifyIcon icon="mdi:weather-night" />
                暗色
              </button>
              <button
                class="segmented-btn"
                :class="{ active: settings.theme === 'light' }"
                type="button"
                @click="settings.theme = 'light'"
              >
                <IconifyIcon icon="mdi:white-balance-sunny" />
                亮色
              </button>
            </div>
          </div>

          <!-- 主题色 -->
          <div class="field">
            <label class="field-label">主题色</label>
            <div class="color-swatches">
              <button
                v-for="color in accentColors"
                :key="color.id"
                class="swatch"
                :class="{ active: settings.accentColor === color.id }"
                type="button"
                :title="color.name"
                :style="{ backgroundColor: color.hex }"
                @click="settings.accentColor = color.id"
              >
                <IconifyIcon v-if="settings.accentColor === color.id" icon="mdi:check" />
              </button>
            </div>
          </div>
        </section>

        <!-- ==================== 3. 背景 ==================== -->
        <section class="panel-section">
          <h3 class="section-title">
            <IconifyIcon icon="mdi:image-filter-center-focus" />
            背景
          </h3>

          <div class="bg-grid">
            <button
              v-for="type in bgTypes"
              :key="type.id"
              class="bg-option"
              :class="{ active: settings.bgType === type.id }"
              type="button"
              :title="type.name"
              @click="settings.bgType = type.id"
            >
              <IconifyIcon :icon="type.icon" />
              <span>{{ type.name }}</span>
            </button>
          </div>

          <!-- 自定义背景图（仅 image 模式展示） -->
          <div v-if="settings.bgType === 'image'" class="field">
            <label class="field-label">背景图片</label>
            <div class="flex gap-2">
              <input v-model="settings.bgImage" class="field-input" placeholder="图片 URL，或点击右侧上传本地图片" />
              <label class="upload-btn">
                <IconifyIcon icon="mdi:upload" />
                <input type="file" accept="image/*" class="hidden" @change="handleBgImageChange" />
              </label>
            </div>
          </div>

          <!-- 遮罩透明度 -->
          <div class="field">
            <label class="field-label">
              背景遮罩强度
              <span class="field-value">{{ Math.round((settings.bgOverlay ?? 0.7) * 100) }}%</span>
            </label>
            <input
              v-model.number="settings.bgOverlay"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="field-range"
            />
          </div>
        </section>

        <!-- ==================== 4. 布局 ==================== -->
        <section class="panel-section">
          <h3 class="section-title">
            <IconifyIcon icon="mdi:view-dashboard-outline" />
            布局
          </h3>

          <div class="field">
            <label class="field-label">排序方式</label>
            <div class="segmented">
              <button
                v-for="mode in layoutModes"
                :key="mode.id"
                class="segmented-btn"
                :class="{ active: settings.layoutMode === mode.id }"
                type="button"
                @click="settings.layoutMode = mode.id"
              >
                <IconifyIcon :icon="mode.icon" />
                {{ mode.name }}
              </button>
            </div>
          </div>

          <div class="field">
            <label class="field-label">卡片间距</label>
            <div class="segmented">
              <button
                v-for="spacing in spacings"
                :key="spacing.id"
                class="segmented-btn"
                :class="{ active: settings.cardiSpacing === spacing.id }"
                type="button"
                @click="settings.cardiSpacing = spacing.id"
              >
                {{ spacing.name }}
              </button>
            </div>
          </div>
        </section>

        <!-- ==================== 5. 显示项 ==================== -->
        <section class="panel-section">
          <h3 class="section-title">
            <IconifyIcon icon="mdi:eye-outline" />
            显示项
          </h3>

          <label class="switch-row">
            <span class="switch-text">显示时钟</span>
            <button
              class="switch"
              :class="{ 'switch-on': settings.showClock }"
              type="button"
              role="switch"
              :aria-checked="Boolean(settings.showClock)"
              @click="settings.showClock = !settings.showClock"
            >
              <span class="switch-knob"></span>
            </button>
          </label>

          <label class="switch-row">
            <span class="switch-text">显示一言</span>
            <button
              class="switch"
              :class="{ 'switch-on': settings.showHitokoto }"
              type="button"
              role="switch"
              :aria-checked="Boolean(settings.showHitokoto)"
              @click="settings.showHitokoto = !settings.showHitokoto"
            >
              <span class="switch-knob"></span>
            </button>
          </label>

          <label class="switch-row">
            <span class="switch-text">显示置顶快捷区</span>
            <button
              class="switch"
              :class="{ 'switch-on': settings.showPinned }"
              type="button"
              role="switch"
              :aria-checked="Boolean(settings.showPinned)"
              @click="settings.showPinned = !settings.showPinned"
            >
              <span class="switch-knob"></span>
            </button>
          </label>
        </section>

        <!-- ==================== 6. 赛博特效 ==================== -->
        <section class="panel-section">
          <h3 class="section-title">
            <IconifyIcon icon="mdi:lightning-bolt-outline" />
            赛博特效
          </h3>

          <label v-for="toggle in effectToggles" :key="toggle.key" class="switch-row">
            <span class="switch-text">
              {{ toggle.name }}
              <em class="switch-desc">{{ toggle.desc }}</em>
            </span>
            <button
              class="switch"
              :class="{ 'switch-on': settings.effects[toggle.key] }"
              type="button"
              role="switch"
              :aria-checked="Boolean(settings.effects[toggle.key])"
              @click="settings.effects[toggle.key] = !settings.effects[toggle.key]"
            >
              <span class="switch-knob"></span>
            </button>
          </label>
        </section>

        <!-- ==================== 7. 快捷键 ==================== -->
        <section class="panel-section">
          <h3 class="section-title">
            <IconifyIcon icon="mdi:keyboard-outline" />
            快捷键
          </h3>

          <div class="field">
            <label class="field-label">聚焦搜索框的按键</label>
            <input v-model="settings.searchShortcut" class="field-input" maxlength="8" placeholder="/" />
          </div>
        </section>

        <!-- ==================== 8. 数据（仅管理员可见） ==================== -->
        <section v-if="props.canEdit" class="panel-section">
          <h3 class="section-title">
            <IconifyIcon icon="mdi:database-outline" />
            数据与备份
          </h3>

          <p class="section-tip">{{ storageTip }}</p>

          <div class="data-actions">
            <button class="data-btn" type="button" @click="exportData">
              <IconifyIcon icon="mdi:download" />
              导出备份
            </button>
            <button class="data-btn" type="button" @click="triggerImport">
              <IconifyIcon icon="mdi:upload" />
              导入备份
            </button>
            <button class="data-btn danger" type="button" @click="handleReset">
              <IconifyIcon icon="mdi:restore" />
              恢复默认
            </button>
          </div>

          <!-- 由父组件读取并合并备份中的链接 -->
          <input
            ref="importInput"
            type="file"
            accept="application/json"
            class="hidden"
            @change="emit('import', $event)"
          />

          <p class="section-tip">
            备份内容：外观设置 + 你新增/修改过的链接。分类与搜索引擎始终以 nav.json 为准，不会被备份覆盖。
          </p>
        </section>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.mynav-settings-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
}

.mynav-settings-panel {
  @apply w-full max-w-md
         bg-gray-950/95
         border-l border-cyan-500/30;
  height: 100%;
  overflow-y: auto;
  box-shadow: -10px 0 40px rgba(34, 211, 238, 0.15);
}

.panel-header {
  @apply sticky top-0 z-10 px-5 py-4
         flex items-center justify-between
         bg-gray-950/95 border-b border-gray-800;
  backdrop-filter: blur(8px);
}

.panel-title {
  @apply flex items-center gap-2 text-lg font-bold text-cyan-400;
  margin: 0;
}

.panel-close {
  @apply p-2 rounded-lg text-gray-400
         hover:text-white hover:bg-gray-800
         transition-colors;
  /* 触摸友好：右上角关闭键是手机上最常点的目标 */
  min-width: 40px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.panel-body {
  @apply px-5 py-4;
  @apply flex flex-col gap-6;
}

.panel-section {
  @apply flex flex-col gap-4;
}

.section-title {
  @apply flex items-center gap-2
         text-sm font-semibold text-gray-300
         uppercase tracking-wider;
  margin: 0;
}

.section-tip {
  @apply text-xs text-gray-500 leading-relaxed m-0;
}

.field {
  @apply flex flex-col gap-2;
}

.field-label {
  @apply flex items-center justify-between
         text-xs font-medium text-gray-400;
}

.field-value {
  @apply text-cyan-400;
}

.field-input {
  @apply w-full px-3 py-2 rounded-lg
         bg-gray-900 border border-gray-700
         text-sm text-white
         outline-none
         focus:border-cyan-500;
}

.field-range {
  @apply w-full h-1.5 rounded-full
         bg-gray-700 appearance-none cursor-pointer;
}

.field-range::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 9999px;
  background: #22d3ee;
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.6);
  cursor: pointer;
}

.segmented {
  @apply grid gap-2;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
}

.segmented-btn {
  @apply flex items-center justify-center gap-1.5
         px-3 py-2 rounded-lg
         text-xs text-gray-400
         bg-gray-900 border border-gray-700
         transition-all
         hover:text-white hover:border-gray-600;
}

.segmented-btn.active {
  @apply text-cyan-400 border-cyan-500 bg-cyan-500/10;
}

.color-swatches {
  @apply flex items-center gap-3 flex-wrap;
}

.swatch {
  @apply w-9 h-9 rounded-full
         flex items-center justify-center
         text-gray-950
         transition-transform
         hover:scale-110;
  box-shadow: 0 0 0 2px transparent;
}

.swatch.active {
  box-shadow: 0 0 0 2px #0f172a, 0 0 0 4px currentColor;
}

.bg-grid {
  @apply grid gap-2;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.bg-option {
  @apply flex flex-col items-center justify-center gap-1.5
         px-2 py-3 rounded-lg
         text-xs text-gray-400
         bg-gray-900 border border-gray-700
         transition-all
         hover:text-white hover:border-gray-600;
}

.bg-option.active {
  @apply text-cyan-400 border-cyan-500 bg-cyan-500/10;
}

.upload-btn {
  @apply flex items-center justify-center px-3 rounded-lg
         bg-gray-900 border border-gray-700
         text-gray-400 cursor-pointer
         hover:text-cyan-400 hover:border-cyan-500;
}

.switch-row {
  @apply flex items-center justify-between gap-4
         px-3 py-2.5 rounded-lg
         bg-gray-900/60 border border-gray-800;
}

.switch-text {
  @apply text-sm text-gray-300 flex flex-col;
}

.switch-desc {
  @apply text-[11px] not-italic text-gray-500 mt-0.5;
}

.switch {
  @apply relative flex-shrink-0
         w-11 h-6 rounded-full
         bg-gray-700
         transition-colors cursor-pointer;
}

.switch-on {
  @apply bg-cyan-500;
  box-shadow: 0 0 12px rgba(34, 211, 238, 0.5);
}

.switch-knob {
  @apply absolute top-0.5 left-0.5
         w-5 h-5 rounded-full
         bg-white
         transition-transform;
}

.switch-on .switch-knob {
  transform: translateX(20px);
}

.data-actions {
  @apply grid gap-2;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.data-btn {
  @apply flex flex-col items-center justify-center gap-1
         px-2 py-3 rounded-lg
         text-xs text-gray-400
         bg-gray-900 border border-gray-700
         transition-all
         hover:text-cyan-400 hover:border-cyan-500;
}

.data-btn.danger:hover {
  @apply text-red-400 border-red-500;
}
</style>
