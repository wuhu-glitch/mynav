// PostCSS 配置
// 注意：package.json 声明了 "type": "module"，
// 因此 PostCSS 以 ESM 方式加载本文件，必须使用 export default 写法。
export default {
  plugins: {
    tailwindcss: {}, // Tailwind CSS v3 编译插件
    autoprefixer: {} // 自动补全浏览器前缀
  }
}
