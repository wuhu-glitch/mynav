import { createApp } from 'vue'
import App from './App.vue'
import './assets/styles/main.css'
// 先注册离线图标集合，再挂载应用，避免首屏图标出现空白方块
import './icons'

const app = createApp(App)

app.mount('#app')