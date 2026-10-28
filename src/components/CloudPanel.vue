<script setup>
/**
 * CloudPanel —— 云端公共配置（管理员）
 *
 * 职责：
 *   - 显示当前云端版本与来源（KV / 本地缓存 / 静态回退）；
 *   - 把页面当前的导航配置「发布」成一个新版本（带备注）；
 *   - 版本时间轴与一键回滚。
 *
 * 边界：
 *   - 只有管理员才能调版本列表与发布，未登录时只展示状态与说明；
 *   - 所有失败都就地提示，不抛错、不白屏；发布成功后才刷新版本列表。
 */
import { ref, onMounted, computed } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'
import { useNavData } from '../composables/useNavData'
import { useLocalStorage } from '../composables/useLocalStorage'
import { fetchVersions, publishCloudNav, rollbackVersion } from '../utils/cloudNav'

const props = defineProps({
  // 是否可见（父组件用 v-if 控制卸载，这里保留 show 便于未来做动画）
  show: { type: Boolean, default: false },
  // 是否管理员：决定能不能发布/回滚
  canEdit: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'published'])

const { navData, cloudMeta, commitPublishedNav } = useNavData()
const { settings } = useLocalStorage()

const versions = ref([])           // 版本列表（新在前）
const currentVersion = ref('')     // 远端当前版本号
const loading = ref(false)         // 版本列表加载中
const busy = ref(false)            // 发布/回滚进行中
const note = ref('')               // 本次发布备注
const notice = ref(null)           // { type: 'ok' | 'error', lines: [] }

const itemCount = computed(() => {
  const items = navData.value?.items?.length || 0
  const pinned = navData.value?.pinnedItems?.length || 0
  return items + pinned
})

const sourceLabel = computed(() => {
  switch (cloudMeta.source) {
    case 'kv':
      return '云端 KV'
    case 'cache':
      return '本地缓存（云端暂不可用）'
    default:
      return '静态 nav.json（云端无配置）'
  }
})

/** 把 ISO 时间转成本地可读格式；解析失败就原样显示，绝不抛错 */
function formatTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-CN', { hour12: false })
}

function showNotice(type, lines) {
  notice.value = { type, lines: lines.filter(Boolean) }
}

/** 读取版本时间轴（仅管理员；失败给出可操作的提示） */
async function loadVersions() {
  if (!props.canEdit) return
  loading.value = true
  try {
    const result = await fetchVersions()
    if (!result) {
      showNotice('error', ['版本列表读取失败：可能未登录、会话过期，或 Pages 未绑定 MYNAV_KV'])
      versions.value = []
      return
    }
    versions.value = result.versions
    currentVersion.value = result.currentVersion
    notice.value = null
  } finally {
    loading.value = false
  }
}

/** 发布当前页面配置到云端 */
async function handlePublish() {
  if (!props.canEdit || busy.value) return
  busy.value = true
  try {
    const result = await publishCloudNav(navData.value, note.value.trim())
    if (!result.ok) {
      showNotice('error', [`发布失败：${result.message}`])
      return
    }
    // 发布成功后把当前配置记为新的基线并清空本地差异，避免重复叠加
    commitPublishedNav()
    note.value = ''
    currentVersion.value = result.version
    showNotice('ok', [
      `已发布版本 ${result.version}`,
      ...(result.warnings || [])
    ])
    emit('published', result.version)
    await loadVersions()
  } finally {
    busy.value = false
  }
}

/** 回滚到指定版本（回滚本身也会生成一个新版本，审计轨迹不断） */
async function handleRollback(version) {
  if (!props.canEdit || busy.value) return
  const ok = window.confirm(`确定回滚到 ${version}？回滚会生成一个新版本，历史版本不会被删除。`)
  if (!ok) return

  busy.value = true
  try {
    const result = await rollbackVersion(version)
    if (!result.ok) {
      showNotice('error', [`回滚失败：${result.message}`])
      return
    }
    showNotice('ok', [`已回滚：${version} → 新版本 ${result.version}`])
    emit('published', result.version)
    await loadVersions()
  } finally {
    busy.value = false
  }
}

onMounted(loadVersions)
</script>

<template>
  <div class="mynav-cloud-mask" @click.self="emit('close')">
    <aside class="mynav-cloud-panel">
      <header class="panel-header">
        <h2 class="panel-title">
          <IconifyIcon icon="mdi:cloud-cog-outline" />
          云端公共配置
        </h2>
        <button class="panel-close" type="button" title="关闭" @click="emit('close')">
          <IconifyIcon icon="mdi:close" />
        </button>
      </header>

      <div class="panel-body">
        <!-- 当前状态 -->
        <section class="panel-section">
          <h3 class="section-title">
            <IconifyIcon icon="mdi:information-outline" />
            当前状态
          </h3>
          <dl class="stat-grid">
            <div class="stat">
              <dt>数据来源</dt>
              <dd>{{ sourceLabel }}</dd>
            </div>
            <div class="stat">
              <dt>当前版本</dt>
              <dd class="mono">{{ cloudMeta.version || currentVersion || '—' }}</dd>
            </div>
            <div class="stat">
              <dt>更新时间</dt>
              <dd>{{ formatTime(cloudMeta.updatedAt) }}</dd>
            </div>
            <div class="stat">
              <dt>链接总数</dt>
              <dd>{{ itemCount }} 条</dd>
            </div>
          </dl>

          <p v-if="!settings.cloudSync" class="section-tip warn">
            云端公共配置处于关闭状态：整站不访问任何接口，当前展示的是静态 nav.json。
            在「设置 → 云端公共配置」打开开关后才会读取 KV。
          </p>
        </section>

        <!-- 发布 -->
        <section class="panel-section">
          <h3 class="section-title">
            <IconifyIcon icon="mdi:cloud-upload-outline" />
            发布新版本
          </h3>

          <template v-if="props.canEdit">
            <div class="field">
              <label class="field-label">版本备注（可选）</label>
              <input
                v-model="note"
                class="field-input"
                maxlength="120"
                placeholder="例如：新增三个开发工具站点"
              />
            </div>

            <button class="action-btn" type="button" :disabled="busy" @click="handlePublish">
              <IconifyIcon :icon="busy ? 'mdi:loading' : 'mdi:rocket-launch-outline'" :class="{ spin: busy }" />
              {{ busy ? '处理中…' : `发布当前配置（${itemCount} 条）` }}
            </button>

            <p class="section-tip">
              发布即写入 Cloudflare KV：访客刷新后看到同一份链接；每次发布都会留一个带时间戳的快照，可随时回滚。
            </p>
          </template>

          <p v-else class="section-tip warn">
            发布需要管理员身份。点击页头「解锁」输入口令后即可编辑与发布；
            访客只能查看，不能修改任何内容。
          </p>
        </section>

        <!-- 版本时间轴 -->
        <section class="panel-section">
          <h3 class="section-title">
            <IconifyIcon icon="mdi:history" />
            版本时间轴
            <button v-if="props.canEdit" class="refresh-btn" type="button" :disabled="loading" @click="loadVersions">
              <IconifyIcon icon="mdi:refresh" :class="{ spin: loading }" />
            </button>
          </h3>

          <p v-if="!props.canEdit" class="section-tip">登录后可查看历史版本并回滚。</p>
          <p v-else-if="loading" class="section-tip">读取中…</p>
          <p v-else-if="!versions.length" class="section-tip">还没有历史版本。发布一次后这里会出现时间轴。</p>

          <ol v-else class="version-list">
            <li v-for="version in versions" :key="version.version" class="version-item">
              <div class="version-main">
                <span class="version-time">{{ formatTime(version.createdAt) }}</span>
                <span class="version-id mono">{{ version.version }}</span>
                <span class="version-count">{{ version.itemCount }} 条</span>
                <span v-if="version.version === currentVersion" class="version-badge">当前</span>
              </div>
              <p v-if="version.note" class="version-note">{{ version.note }}</p>
              <button
                class="rollback-btn"
                type="button"
                :disabled="busy || version.version === currentVersion"
                @click="handleRollback(version.version)"
              >
                <IconifyIcon icon="mdi:backup-restore" />
                回滚到此版本
              </button>
            </li>
          </ol>
        </section>

        <!-- 结果提示 -->
        <div v-if="notice" class="notice" :class="notice.type">
          <p v-for="(line, index) in notice.lines" :key="index">{{ line }}</p>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.mynav-cloud-mask {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
}

.mynav-cloud-panel {
  @apply w-full max-w-lg
         bg-gray-950/95
         border-l border-cyan-500/30;
  height: 100%;
  overflow-y: auto;
  box-shadow: -10px 0 40px rgba(34, 211, 238, 0.18);
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
  @apply w-8 h-8 flex items-center justify-center rounded
         text-gray-400 hover:text-cyan-300 hover:bg-gray-800/80;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.panel-body {
  @apply px-5 py-4 space-y-5;
}

.panel-section {
  @apply space-y-3;
}

.section-title {
  @apply flex items-center gap-2 text-sm font-semibold text-cyan-300/90;
  margin: 0;
}

.section-tip {
  @apply text-xs leading-relaxed text-gray-500;
  margin: 0;
}

.section-tip.warn {
  @apply text-amber-300/80;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
}

.stat {
  @apply rounded border border-gray-800 bg-gray-900/60 px-3 py-2;
}

.stat dt {
  @apply text-[11px] uppercase tracking-wide text-gray-500;
}

.stat dd {
  @apply mt-1 text-sm text-gray-200;
  margin-left: 0;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
}

.field {
  @apply space-y-1;
}

.field-label {
  @apply text-xs text-gray-400;
}

.field-input {
  @apply w-full rounded border border-gray-800 bg-gray-900/70 px-3 py-2 text-sm text-gray-200
         outline-none focus:border-cyan-500/60;
}

.action-btn {
  @apply flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium
         text-gray-950;
  border: 0;
  cursor: pointer;
  background: linear-gradient(90deg, #22d3ee, #67e8f9);
  box-shadow: 0 0 18px rgba(34, 211, 238, 0.35);
}

.action-btn:disabled {
  @apply cursor-not-allowed opacity-60;
}

.refresh-btn {
  @apply ml-auto w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-cyan-300;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.version-list {
  @apply space-y-2;
  list-style: none;
  margin: 0;
  padding: 0;
}

.version-item {
  @apply rounded border border-gray-800 bg-gray-900/50 px-3 py-2 space-y-1;
}

.version-main {
  @apply flex flex-wrap items-center gap-2 text-xs;
}

.version-time {
  @apply text-gray-300;
}

.version-id {
  @apply text-cyan-300/70;
}

.version-count {
  @apply text-gray-500;
}

.version-badge {
  @apply rounded px-1.5 py-0.5 text-[10px] text-gray-950;
  background: #67e8f9;
}

.version-note {
  @apply text-xs text-gray-400;
  margin: 0;
}

.rollback-btn {
  @apply inline-flex items-center gap-1 rounded px-2 py-1 text-xs
         text-cyan-300/90 border border-cyan-500/30 hover:bg-cyan-500/10;
  background: transparent;
  cursor: pointer;
}

.rollback-btn:disabled {
  @apply cursor-not-allowed opacity-40;
}

.notice {
  @apply rounded border px-3 py-2 space-y-1 text-xs;
}

.notice.ok {
  @apply border-emerald-500/30 bg-emerald-500/10 text-emerald-300;
}

.notice.error {
  @apply border-rose-500/30 bg-rose-500/10 text-rose-300;
}

.notice p {
  margin: 0;
}

.spin {
  animation: cloud-spin 0.9s linear infinite;
}

@keyframes cloud-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
