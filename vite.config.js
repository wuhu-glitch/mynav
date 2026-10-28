import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Vite 构建配置（面向 Cloudflare Pages 静态托管）
export default defineConfig({
  // Vue 3 单文件组件支持
  plugins: [vue()],

  // 静态资源目录（nav.json、_redirects 等会原样拷贝进 dist）
  publicDir: 'public',

  build: {
    outDir: 'dist',           // Cloudflare Pages 要求的输出目录
    sourcemap: false,         // 生产构建不产出 sourcemap，减小 dist 体积
    emptyOutDir: true,        // 每次构建清空 dist，避免残留旧文件
    assetsInlineLimit: 4096   // 4KB 以下的资源内联为 base64（减少请求数）
  },

  resolve: {
    alias: {
      // 路径别名：@ 指向 src 目录
      '@': resolve(__dirname, 'src')
    }
  },

  server: {
    host: '0.0.0.0', // 允许局域网访问，方便真机调试
    port: 5173,
    open: true
  },

  css: {
    // 使用项目根目录的 PostCSS 配置（内含 Tailwind 与 Autoprefixer）
    postcss: './postcss.config.js'
  }
})
