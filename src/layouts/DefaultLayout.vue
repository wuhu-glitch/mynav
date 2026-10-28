<script setup>
/**
 * DefaultLayout —— 通用布局壳
 *
 * 只负责纵向骨架（头部 / 主体 / 页脚），全部内容通过插槽注入：
 *   #header          顶部区域
 *   （默认插槽）      主体内容
 *   #settings-panel  设置面板弹出层
 *   #footer          页脚
 * 业务组件统一由 App.vue 挂载，本组件不持有任何业务状态。
 */
</script>

<template>
  <div class="mynav-layout">
    <slot name="header" />

    <main class="mynav-content">
      <slot />
    </main>

    <slot name="settings-panel" />
    <slot name="footer" />
  </div>
</template>

<style scoped>
.mynav-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  /* 统一页面左右留白：头部/主体/页脚共用，避免头部贴边 */
  @apply px-4 md:px-6 lg:px-10;
  @apply pt-6 pb-0;
}

.mynav-content {
  flex: 1;
  position: relative;
}
</style>
