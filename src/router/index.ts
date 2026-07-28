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
  scrollBehavior: () => ({ top: 0 }),
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
          path: 'master-data/:resource(units|categories|materials|skus|warehouses)',
          name: 'master-data',
          component: () => import('@/features/master-data/MasterDataListView.vue'),
          meta: { title: '主数据' },
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
