<script setup>
/**
 * EditModal —— 链接「新增 / 编辑 / 删除」弹窗
 *
 * 说明：
 *   - props.item 为 null 时是「新增链接」，否则是「编辑链接」
 *   - 保存 / 删除直接操作 useNavData 的单例 navData，页面即时刷新
 *   - 分类下拉选项来自 nav.json 的 categories，保持数据驱动
 */
import { ref, computed, watch, nextTick } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'
import { useNavData } from '../composables/useNavData'
import { normalizeUrl } from '../utils/url'

const props = defineProps({
  show: { type: Boolean, default: false },
  item: { type: Object, default: null },
  // 新增时的默认分类：跟随当前所在分类标签，省得每次都手动选
  defaultCategory: { type: String, default: '' }
})

const emit = defineEmits(['update:show', 'save'])

const { navData, addNavItem, updateNavItem, removeNavItem } = useNavData()

// 分类选项来自导航数据
const categories = computed(() => navData.value?.categories || [])

// 是否处于「编辑已有链接」状态
const isEditing = computed(() => Boolean(props.item?.id))

// 空白表单
const createEmptyForm = () => ({
  name: '',
  url: '',
  icon: 'mdi:link',
  tags: '',
  category: '',
  desc: ''
})

const formRef = ref(null)
const formData = ref(createEmptyForm())
const errors = ref({})

// 打开弹窗时回填表单；关闭时不做处理（下次打开会重置）
watch(() => props.show, (visible) => {
  if (!visible) return
  if (props.item?.id) {
    formData.value = {
      name: props.item.name ?? '',
      url: props.item.url ?? '',
      icon: props.item.icon || 'mdi:link',
      tags: (props.item.tags || []).join(', '),
      category: props.item.category || '',
      desc: props.item.desc || ''
    }
  } else {
    // 新增：带上「当前分类」，避免保存后因为没分类而在分类视图里消失
    formData.value = { ...createEmptyForm(), category: props.defaultCategory || '' }
  }
  errors.value = {}
  nextTick(() => {
    formRef.value?.querySelector('input[name="name"]')?.focus()
  })
})

// URL 校验：允许省略协议（自动补 https），但只认 http/https
const isValidUrl = (url) => normalizeUrl(url) !== ''

// 表单校验
const validate = () => {
  errors.value = {}
  if (!formData.value.name.trim()) errors.value.name = '名称不能为空'
  const url = formData.value.url.trim()
  if (!url) errors.value.url = 'URL 不能为空'
  else if (!isValidUrl(url)) errors.value.url = 'URL 格式不正确（只支持 http / https）'
  return Object.keys(errors.value).length === 0
}

// 标签字符串 → 数组（支持中文逗号）
const parseTags = (raw) =>
  (raw || '')
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)

const close = () => emit('update:show', false)

// 保存
const handleSubmit = () => {
  if (!validate()) return

  const payload = {
    name: formData.value.name.trim(),
    // 存规范化后的绝对地址：用户写 github.com 也会被补成 https://github.com，
    // 避免把不含协议的字符串存进 navData 后被当成站内相对路径打开
    url: normalizeUrl(formData.value.url),
    icon: formData.value.icon.trim() || 'mdi:link',
    tags: parseTags(formData.value.tags),
    desc: formData.value.desc.trim()
  }
  // 分类为空时不写入该字段
  if (formData.value.category) payload.category = formData.value.category

  if (isEditing.value) {
    const merged = { ...props.item, ...payload, id: props.item.id }
    updateNavItem(props.item.id, payload)
    emit('save', { action: 'updated', item: merged })
  } else {
    const created = { id: `custom-${Date.now()}`, ...payload }
    addNavItem(created)
    emit('save', { action: 'added', item: created })
  }
  close()
}

// 删除（仅编辑模式可见）
const handleDelete = () => {
  if (!props.item?.id) return
  if (!window.confirm(`确定删除「${props.item.name}」？`)) return
  const removed = { ...props.item }
  removeNavItem(props.item.id)
  emit('save', { action: 'deleted', item: removed })
  close()
}
</script>

<template>
  <div v-if="show" class="mynav-edit-modal" @click.self="close">
    <div class="modal-content" @click.stop>
      <!-- 头部 -->
      <div class="header">
        <h2 class="title">
          <IconifyIcon :icon="isEditing ? 'mdi:pencil' : 'mdi:link-plus'" />
          {{ isEditing ? '编辑链接' : '新增链接' }}
        </h2>

        <div class="actions">
          <button v-if="isEditing" class="action-btn danger" type="button" @click="handleDelete">
            <IconifyIcon icon="mdi:delete-outline" />
            删除
          </button>
          <button class="action-btn close" type="button" @click="close">
            <IconifyIcon icon="mdi:close" />
            关闭
          </button>
          <button class="action-btn primary" type="button" @click="handleSubmit">
            <IconifyIcon icon="mdi:check" />
            保存
          </button>
        </div>
      </div>

      <!-- 表单 -->
      <div ref="formRef" class="body">
        <div class="form-group">
          <label class="form-label">名称 <span class="required">*</span></label>
          <input
            v-model="formData.name"
            name="name"
            class="form-input"
            placeholder="例如：GitHub"
          />
          <span v-if="errors.name" class="error-msg">{{ errors.name }}</span>
        </div>

        <div class="form-group">
          <label class="form-label">URL <span class="required">*</span></label>
          <input
            v-model="formData.url"
            name="url"
            class="form-input"
            placeholder="https://github.com"
          />
          <span v-if="errors.url" class="error-msg">{{ errors.url }}</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">图标（Iconify ID）</label>
            <input v-model="formData.icon" class="form-input" placeholder="mdi:github" />
          </div>

          <div class="form-group">
            <label class="form-label">分类</label>
            <select v-model="formData.category" class="form-input">
              <option value="">不分类</option>
              <option v-for="cat in categories" :key="cat.title" :value="cat.title">
                {{ cat.title }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">标签（逗号分隔）</label>
          <input v-model="formData.tags" class="form-input" placeholder="dev, tools" />
        </div>

        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea
            v-model="formData.desc"
            class="form-input form-textarea"
            placeholder="简短描述这个链接"
            rows="3"
          ></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mynav-edit-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
}

.modal-content {
  @apply w-full max-w-2xl
         bg-gray-900/95
         rounded-xl
         border border-cyan-500/30;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  box-shadow: 0 0 50px rgba(34, 211, 238, 0.2);
}

.header {
  @apply px-6 py-4 border-b border-gray-800
         flex items-center justify-between flex-wrap gap-4;
}

.title {
  @apply text-xl font-bold text-cyan-400 flex items-center gap-2;
  margin: 0;
}

.actions {
  @apply flex items-center gap-3;
}

.action-btn {
  @apply px-3 py-2 rounded-lg
         flex items-center gap-2
         text-sm font-medium
         transition-all duration-200
         active:scale-95;
  /* 触摸友好：py-2 只有 36px 高，手机上点「保存」容易点偏 */
  min-height: 40px;
}

.action-btn.close {
  @apply bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700;
}

.action-btn.primary {
  @apply bg-cyan-600 text-white hover:bg-cyan-500;
}

.action-btn.primary:hover {
  box-shadow: 0 0 20px rgba(34, 211, 238, 0.4);
}

.action-btn.danger {
  @apply bg-red-600/20 text-red-400 border border-red-600/30
         hover:bg-red-600/30 hover:text-red-300;
}

.body {
  @apply p-6;
}

.form-group {
  @apply mb-5;
}

.form-row {
  @apply grid gap-4;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-label {
  @apply block mb-2 text-sm font-medium text-gray-400;
}

.required {
  @apply text-red-400;
}

.form-input {
  @apply w-full px-4 py-3
         rounded-lg
         bg-gray-800/50
         border border-gray-700
         text-white
         outline-none
         transition-all
         focus:border-cyan-500;
}

.form-input:focus {
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.3);
}

.form-textarea {
  min-height: 90px;
  resize: vertical;
}

.error-msg {
  @apply mt-1 text-xs text-red-400;
}

@media (max-width: 640px) {
  /* 弹窗几乎占满窄屏：外层缩小留白，头部缩小内边距，避免内容被挤成一列 */
  .mynav-edit-modal {
    padding: 0.5rem;
    align-items: flex-start;
  }

  .modal-content {
    max-height: calc(100dvh - 1rem);
  }

  .header {
    padding: 0.75rem 1rem;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  /* 窄屏收窄内边距，把宽度让给输入框 */
  .body {
    padding: 1rem;
  }

  .actions {
    gap: 0.5rem;
  }
}
</style>
