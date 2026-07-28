import {
  create,
  NAlert,
  NButton,
  NConfigProvider,
  NDialogProvider,
  NDrawer,
  NDrawerContent,
  NDropdown,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NLayout,
  NLayoutContent,
  NLayoutSider,
  NLoadingBarProvider,
  NMenu,
  NMessageProvider,
  NTag,
} from 'naive-ui'
import { createApp } from 'vue'

import App from '@/app/App.vue'
import { router } from '@/router'
import { pinia } from '@/stores'
import '@/styles/main.css'

const naive = create({
  components: [
    NAlert,
    NButton,
    NConfigProvider,
    NDialogProvider,
    NDrawer,
    NDrawerContent,
    NDropdown,
    NForm,
    NFormItem,
    NIcon,
    NInput,
    NInputNumber,
    NLayout,
    NLayoutContent,
    NLayoutSider,
    NLoadingBarProvider,
    NMenu,
    NMessageProvider,
    NTag,
  ],
})

createApp(App).use(naive).use(pinia).use(router).mount('#app')
