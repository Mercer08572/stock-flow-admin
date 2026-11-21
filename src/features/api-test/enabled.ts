/**
 * 「API 测试」开发调试页的构建期总闸。
 *
 * 只有 `VITE_ENABLE_API_TEST=true` 时才注册路由与菜单项；关闭后：
 * - 「系统设置」里不渲染入口；
 * - `/settings/api-test` 路由不存在，直接访问会落到 catch-all 的「页面不存在」。
 *
 * 值在构建期确定，修改后需要重启 dev server 或重新构建才生效。
 * 生产构建不带该变量，因此页面天然不可达。
 */
export function isApiTestEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true'
}

export const apiTestEnabled = isApiTestEnabled(import.meta.env.VITE_ENABLE_API_TEST)
