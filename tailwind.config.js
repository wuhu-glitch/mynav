/** @type {import('tailwindcss').Config} */

// Tailwind CSS v3 配置：赛博朋克霓虹色系 + 特效关键帧
// 注意：不要配置 `important` 或会破坏工具类选择器的选项，
// 否则组件内 @apply / 模板中的工具类将全部失效。
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        /* 霓虹色系（低饱和，不刺眼） */
        cyber: {
          cyan:    { DEFAULT: '#22d3ee', 400: '#67e8f9', 500: '#22d3ee', 600: '#06b6d4' },
          blue:    { DEFAULT: '#818cf8', 400: '#a5b4fc', 500: '#818cf8', 600: '#6366f1' },
          purple:  { DEFAULT: '#e879f9', 400: '#f0abfc', 500: '#e879f9', 600: '#d946ef' },
          magenta: { DEFAULT: '#f472b6', 400: '#f9a8d4', 500: '#f472b6', 600: '#ec4899' },
          lime:    { DEFAULT: '#bef264', 400: '#d9f99d', 500: '#bef264', 600: '#84cc16' }
        },
        /* 深色基底 */
        bg: {
          base:   '#0f172a',                 // 深蓝黑基底
          darker: '#020617',                 // 更深背景
          card:   '#1e293b',                 // 卡片基底
          glass:  'rgba(30, 41, 59, 0.7)'    // 玻璃拟态
        },
        text: {
          main: '#f8fafc',   // 主文本
          dim:  '#94a3b8',   // 暗淡文本
          neon: '#22d3ee'    // 霓虹高亮
        }
      },
      backgroundImage: {
        'gradient-radial':   'radial-gradient(var(--tw-gradient-stops))',
        'gradient-radial-2': 'radial-gradient(circle at center, rgba(34, 211, 238, 0.1) 0%, transparent 70%)'
      },
      /* 特效动画 */
      animation: {
        glitch:       'glitch 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite',
        'glitch-slow':'glitch 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite',
        scanline:     'scanline 8s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite'
      },
      keyframes: {
        glitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' }
        },
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1',   boxShadow: '0 0 10px rgba(34, 211, 238, 0.5)' },
          '50%':      { opacity: '0.8', boxShadow: '0 0 20px rgba(34, 211, 238, 0.8)' }
        }
      }
    }
  },
  plugins: []
}
