<script setup lang="ts">
import { useBreakpoints } from '@vueuse/core'
import {
  Boxes,
  Building2,
  ChevronDown,
  CircleGauge,
  KeyRound,
  Layers3,
  LogOut,
  Menu,
  PackageSearch,
  Ruler,
  Tags,
  Warehouse,
} from '@lucide/vue'
import { NIcon, type DropdownOption, type MenuOption, useMessage } from 'naive-ui'
import { computed, h, ref, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getErrorMessage } from '@/api/error'
import { useAuthStore } from '@/features/auth/auth.store'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')
const mobileMenuOpen = ref(false)
const loggingOut = ref(false)

const icon = (component: Component) => () => h(NIcon, null, { default: () => h(component) })

const menuOptions: MenuOption[] = [
  { label: '工作台', key: '/', icon: icon(CircleGauge) },
  { label: '库存余额', key: '/inventory/stocks', icon: icon(PackageSearch) },
  {
    label: '主数据',
    key: 'master-data',
    icon: icon(Layers3),
    children: [
      { label: '物料', key: '/master-data/materials', icon: icon(Boxes) },
      { label: 'SKU', key: '/master-data/skus', icon: icon(Tags) },
      { label: '物料分类', key: '/master-data/categories', icon: icon(Layers3) },
      { label: '计量单位', key: '/master-data/units', icon: icon(Ruler) },
      { label: '仓库', key: '/master-data/warehouses', icon: icon(Warehouse) },
    ],
  },
]

const userOptions: DropdownOption[] = [
  { label: '修改密码', key: 'password', icon: icon(KeyRound) },
  { type: 'divider', key: 'divider' },
  { label: '退出登录', key: 'logout', icon: icon(LogOut) },
]

const activeMenu = computed(() => route.path)
const pageTitle = computed(() => route.meta.title || 'Stock Flow')

async function navigate(key: string | number) {
  mobileMenuOpen.value = false
  await router.push(String(key))
}

async function onUserAction(key: string | number) {
  if (key === 'password') {
    await router.push({ name: 'change-password' })
    return
  }
  if (key !== 'logout') return

  loggingOut.value = true
  try {
    await auth.logout()
    await router.replace({ name: 'login' })
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <NLayout class="app-shell" has-sider>
    <NLayoutSider
      v-if="!isMobile"
      bordered
      class="app-sidebar"
      :width="232"
      :native-scrollbar="false"
    >
      <div class="brand">
        <span class="brand__mark"><Building2 :size="20" /></span>
        <span>Stock Flow</span>
      </div>
      <NMenu
        :value="activeMenu"
        :options="menuOptions"
        :indent="20"
        inverted
        @update:value="navigate"
      />
    </NLayoutSider>

    <NDrawer v-model:show="mobileMenuOpen" placement="left" :width="280">
      <NDrawerContent body-content-style="padding: 0; background: #18211f" closable>
        <template #header>
          <span class="drawer-title">Stock Flow</span>
        </template>
        <NMenu
          :value="activeMenu"
          :options="menuOptions"
          :indent="20"
          inverted
          @update:value="navigate"
        />
      </NDrawerContent>
    </NDrawer>

    <NLayout>
      <header class="topbar">
        <NButton
          v-if="isMobile"
          quaternary
          circle
          aria-label="打开导航"
          @click="mobileMenuOpen = true"
        >
          <template #icon><Menu :size="20" /></template>
        </NButton>
        <h2>{{ pageTitle }}</h2>
        <NDropdown :options="userOptions" trigger="click" @select="onUserAction">
          <NButton quaternary class="user-button" :loading="loggingOut">
            <span class="user-avatar">{{ auth.admin?.username.slice(0, 1).toUpperCase() }}</span>
            <span class="user-name">{{ auth.admin?.username }}</span>
            <ChevronDown :size="15" />
          </NButton>
        </NDropdown>
      </header>
      <NLayoutContent class="app-content">
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-sidebar {
  min-height: 100vh;
  background: var(--color-sidebar);
}

.brand {
  display: flex;
  height: 64px;
  align-items: center;
  gap: 11px;
  padding: 0 20px;
  color: #f5faf8;
  font-size: 16px;
  font-weight: 700;
}

.brand__mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 7px;
  color: #10201b;
  background: #64d4ae;
}

.topbar {
  position: sticky;
  z-index: 10;
  top: 0;
  display: flex;
  height: 64px;
  align-items: center;
  gap: 12px;
  padding: 0 22px;
  border-bottom: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.96);
}

.topbar h2 {
  min-width: 0;
  flex: 1;
  margin: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-button {
  height: 38px;
}

.user-avatar {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border-radius: 50%;
  color: #0e5948;
  background: var(--color-primary-soft);
  font-size: 12px;
  font-weight: 700;
}

.user-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-content {
  background: var(--color-bg);
}

.drawer-title {
  color: #fff;
  font-weight: 700;
}

@media (max-width: 767px) {
  .topbar {
    padding: 0 12px;
  }

  .user-name {
    display: none;
  }
}
</style>
