import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/features/auth/auth.store'
import { pinia } from '@/stores'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    public?: boolean
    shell?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  /**
   * 外壳把顶栏与标签条固定住后，窗口本身不再滚动，滚动发生在内容区 `.app-content`。
   * 因此导航后要重置内容区的滚动位置（否则切标签会继承上一个页面滚到一半的位置）。
   * 登录页 / 404 没有外壳，取不到该元素，保持原来的窗口滚动行为，
   * 同时避免 vue-router 在找不到 `el` 时打警告。
   */
  scrollBehavior: () => {
    const content = document.querySelector<HTMLElement>('.app-content')
    if (!content) return { top: 0 }
    content.scrollTop = 0
    return false
  },
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AdminShell.vue'),
      meta: { shell: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/features/dashboard/DashboardView.vue'),
          meta: { title: '工作台' },
        },
        {
          path: 'inventory/stocks',
          name: 'inventory-stocks',
          component: () => import('@/features/inventory/StockListView.vue'),
          meta: { title: '库存余额' },
        },
        {
          path: 'master-data/materials',
          name: 'material-list',
          component: () => import('@/features/master-data/materials/MaterialListView.vue'),
          meta: { title: '物料' },
        },
        {
          // 静态路径优先于动态段：`master-data/materials` 仍命中上面的列表页
          path: 'master-data/materials/:id(\\d+)',
          name: 'material-detail',
          component: () => import('@/features/master-data/materials/MaterialDetailView.vue'),
          meta: { title: '物料详情' },
        },
        {
          path: 'master-data/skus',
          name: 'sku-list',
          component: () => import('@/features/master-data/skus/SkuListView.vue'),
          meta: { title: 'SKU' },
        },
        {
          path: 'master-data/categories',
          name: 'category-list',
          component: () => import('@/features/master-data/categories/CategoryListView.vue'),
          meta: { title: '物料分类' },
        },
        {
          path: 'master-data/units',
          name: 'unit-list',
          component: () => import('@/features/master-data/units/UnitListView.vue'),
          meta: { title: '计量单位' },
        },
        {
          path: 'master-data/warehouses',
          name: 'warehouse-list',
          component: () => import('@/features/master-data/warehouses/WarehouseListView.vue'),
          meta: { title: '仓库' },
        },
        {
          path: 'account/password',
          name: 'change-password',
          component: () => import('@/features/auth/ChangePasswordView.vue'),
          meta: { title: '修改密码' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/app/NotFoundView.vue'),
      meta: { title: '页面不存在', public: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia)

  if (to.meta.public) {
    if (to.name === 'login' && auth.isAuthenticated) return { name: 'dashboard' }
    return true
  }

  try {
    await auth.bootstrap()
  } catch {
    auth.clearSession()
  }

  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (auth.admin?.must_change_password && to.name !== 'change-password') {
    return { name: 'change-password' }
  }

  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | Stock Flow` : 'Stock Flow'
})
