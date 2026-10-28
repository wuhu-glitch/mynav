<script setup>
/**
 * AdminLogin —— 管理员登录弹窗
 *
 * 只在需要时加载（App.vue 用 defineAsyncComponent 引入），首屏不计入体积。
 * 口径：
 *   - 口令只在本次请求里发给 /api/auth，前端不做任何"本地校验"，避免误导；
 *   - 成功后服务端 Set-Cookie（HttpOnly），本组件只把结果告诉父组件；
 *   - 错误文案统一走 describeLoginError，不在模板里堆 if。
 */
import { ref, watch, nextTick, computed } from 'vue'
import { loginAdmin, describeLoginError } from '../utils/adminMode'

const props = defineProps({
  show: { type: Boolean, default: false }
})

const emit = defineEmits(['update:show', 'success'])

const password = ref('')
const submitting = ref(false)
const errorText = ref('')
const inputRef = ref(null)

const canSubmit = computed(() => password.value.length > 0 && !submitting.value)

// 打开时聚焦输入框并清空上一次的口令/错误
watch(
  () => props.show,
  async (visible) => {
    if (!visible) return
    password.value = ''
    errorText.value = ''
    await nextTick()
    inputRef.value?.focus?.()
  }
)

function close() {
  if (submitting.value) return
  emit('update:show', false)
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  errorText.value = ''

  const result = await loginAdmin(password.value)
  submitting.value = false

  if (result.ok) {
    password.value = ''
    emit('update:show', false)
    emit('success')
    return
  }
  errorText.value = describeLoginError(result.reason, result.message)
  // 失败后保留输入内容，方便用户发现打错的地方
  await nextTick()
  inputRef.value?.select?.()
}
</script>

<template>
  <div v-if="props.show" class="mynav-login-mask" role="presentation" @click.self="close">
    <section class="mynav-login" role="dialog" aria-modal="true" aria-labelledby="mynav-login-title">
      <header class="mynav-login-head">
        <h2 id="mynav-login-title" class="mynav-login-title">管理员登录</h2>
        <button type="button" class="mynav-login-close" aria-label="关闭" @click="close">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </header>

      <form class="mynav-login-body" @submit.prevent="submit">
        <label class="mynav-login-label" for="mynav-admin-password">管理员口令</label>
        <input
          id="mynav-admin-password"
          ref="inputRef"
          v-model="password"
          class="mynav-login-input"
          type="password"
          name="password"
          autocomplete="current-password"
          spellcheck="false"
          placeholder="由站点所有者在部署时设置"
        />

        <p v-if="errorText" class="mynav-login-error" role="alert">{{ errorText }}</p>

        <p class="mynav-login-hint">
          口令由服务端校验，会话保存在 HttpOnly Cookie 里（页面脚本读不到），有效期 12 小时。
        </p>

        <div class="mynav-login-actions">
          <button type="button" class="mynav-login-btn ghost" :disabled="submitting" @click="close">
            取消
          </button>
          <button type="submit" class="mynav-login-btn" :disabled="!canSubmit">
            {{ submitting ? '验证中…' : '登录' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.mynav-login-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(3, 7, 16, 0.72);
  backdrop-filter: blur(6px);
}

.mynav-login {
  width: min(420px, 100%);
  border: 1px solid rgba(34, 211, 238, 0.35);
  border-radius: 14px;
  background: rgba(9, 16, 28, 0.96);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
  color: #e2e8f0;
}

.mynav-login-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.mynav-login-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #22d3ee;
}

.mynav-login-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.mynav-login-close:hover,
.mynav-login-close:focus-visible {
  color: #f0f8ff;
  outline: none;
  background: rgba(148, 163, 184, 0.12);
}

.mynav-login-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

.mynav-login-label {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  color: #94a3b8;
}

.mynav-login-input {
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.9);
  color: #f0f8ff;
  font-size: 0.95rem;
}

.mynav-login-input:focus {
  border-color: rgba(34, 211, 238, 0.7);
  outline: 2px solid rgba(34, 211, 238, 0.25);
  outline-offset: 1px;
}

.mynav-login-error {
  margin: 0;
  font-size: 0.82rem;
  color: #fda4af;
}

.mynav-login-hint {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.6;
  color: #64748b;
}

.mynav-login-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.mynav-login-btn {
  min-height: 40px;
  padding: 0 18px;
  border: 1px solid rgba(34, 211, 238, 0.6);
  border-radius: 10px;
  background: rgba(34, 211, 238, 0.16);
  color: #ecfeff;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.mynav-login-btn:hover:not(:disabled),
.mynav-login-btn:focus-visible:not(:disabled) {
  background: rgba(34, 211, 238, 0.3);
  outline: none;
}

.mynav-login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mynav-login-btn.ghost {
  background: transparent;
  border-color: rgba(148, 163, 184, 0.35);
  color: #cbd5e1;
}
</style>
