import { ref, computed } from 'vue'

export function useCyberTheme(settingsRef) {
  const isDarkMode = computed(() => settingsRef.value.theme === 'dark')
  const accentColor = computed(() => settingsRef.value.accentColor)
  const bgType = computed(() => settingsRef.value.bgType)
  const bgImage = computed(() => settingsRef.value.bgImage)

  // 获取背景样式对象
  const bgStyles = computed(() => {
    const baseColor = isDarkMode.value ? '#0f172a' : '#f8fafc'
    let bgGradient = ''

    switch (bgType.value) {
      case 'grid':
        return {
          backgroundImage: 'none',
          background: `repeating-linear-gradient(
            0deg,
            rgba(34, 211, 238, 0.03) 0px,
            rgba(34, 211, 238, 0.03) 1px,
            transparent 1px,
            transparent 20px
          ),
          repeating-linear-gradient(
            90deg,
            rgba(34, 211, 238, 0.03) 0px,
            rgba(34, 211, 238, 0.03) 1px,
            transparent 1px,
            transparent 20px
          )`
        }

      case 'circuit-board':
        return {
          backgroundImage: 'none',
          background: `radial-gradient(circle at center, var(--mynav-cyan) 0%, ${baseColor} 100%),
          url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2334d399' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }

      case 'gradient':
        bgGradient = 'linear-gradient(135deg, var(--mynav-cyan) 0%, var(--mynav-purple) 50%, var(--mynav-magenta) 100%)'
        break

      case 'gradient-radial':
        bgGradient = 'radial-gradient(circle at center, var(--mynav-cyan) 0%, transparent 70%)'
        break

      case 'gradient-radial-2':
        bgGradient = 'radial-gradient(circle at center, rgba(34, 211, 238, 0.1) 0%, transparent 70%)'
        break

      case 'image':
        bgGradient = `url(${bgImage.value})`
        if (bgImage.value) {
          return {
            backgroundImage: bgGradient,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }
        }
        break

      case 'solid':
      default:
        bgGradient = baseColor
        break
    }

    return {
      backgroundImage: isDarkMode.value
        ? bgGradient === '#f8fafc'
          ? `radial-gradient(circle at center, rgba(34, 211, 238, 0.05) 0%, #020617 100%)`
          : bgGradient
        : bgGradient
    }
  })

  // 获取背景遮罩样式
  const bgOverlayStyle = computed(() => ({
    backgroundColor: isDarkMode.value ? `rgba(0, 0, 0, ${settingsRef.value.bgOverlay})` : `rgba(255, 255, 255, ${settingsRef.value.bgOverlay})`,
    backdropFilter: 'blur(8px)'
  }))

  // 获取主题色CSS变量
  const themeColors = computed(() => {
    const colorMap = {
      cyan: { primary: 'var(--mynav-cyan)', secondary: 'var(--mynav-cyan-400)' },
      blue: { primary: 'var(--mynav-blue)', secondary: 'var(--mynav-blue-400)' },
      purple: { primary: 'var(--mynav-purple)', secondary: 'var(--mynav-purple-400)' },
      magenta: { primary: 'var(--mynav-magenta)', secondary: 'var(--mynav-magenta-400)' },
      lime: { primary: 'var(--mynav-lime)', secondary: 'var(--mynav-lime-400)' }
    }
    return colorMap[accentColor.value] || colorMap.cyan
  })

  // 获取文本颜色
  const textColor = computed(() => ({
    main: isDarkMode.value ? '#f8fafc' : '#0f172a',
    dim: isDarkMode.value ? '#94a3b8' : '#64748b'
  }))

  // 应用主题类名
  const themeClass = computed(() => ({
    'dark': isDarkMode.value,
    'light': !isDarkMode.value
  }))

  return {
    isDarkMode,
    accentColor,
    bgStyles,
    bgOverlayStyle,
    themeColors,
    textColor,
    themeClass
  }
}