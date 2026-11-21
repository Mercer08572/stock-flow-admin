/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PROXY_TARGET?: string
  /** 仅开发：`true` 时注册「API 测试」调试页（菜单 + 路由），未开启时页面不可达 */
  readonly VITE_ENABLE_API_TEST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
