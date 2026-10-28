/**
 * 图标离线注册
 *
 * collections.json 由 scripts/build-icons.mjs 生成，保存首屏硬编码引用的
 * Iconify 图标矢量数据。这里在应用启动时一次性注册进 @iconify/vue：
 * 之后这些图标全部来自本地内存，不再向 api.iconify.design 发起请求。
 */
import { addCollection } from '@iconify/vue'
import collections from './collections.json'

for (const collection of collections) {
  addCollection(collection)
}
