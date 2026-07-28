<script setup lang="ts">
import { Building2, Eye, EyeOff, LockKeyhole, UserRound } from '@lucide/vue'
import { type FormInst, type FormRules, useMessage } from 'naive-ui'
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getErrorMessage } from '@/api/error'
import { useAuthStore } from '@/features/auth/auth.store'

interface LoginForm {
  username: string
  password: string
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const formRef = ref<FormInst | null>(null)
const submitting = ref(false)
const showPassword = ref(false)
const form = reactive<LoginForm>({ username: '', password: '' })
const rules: FormRules = {
  username: { required: true, message: '请输入管理员账号', trigger: ['input', 'blur'] },
  password: { required: true, message: '请输入密码', trigger: ['input', 'blur'] },
}

const redirectPath = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    await auth.login(form)
    const destination = auth.admin?.must_change_password ? '/account/password' : redirectPath.value
    await router.replace(destination)
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-brand" aria-label="Stock Flow">
      <div class="login-brand__mark"><Building2 :size="28" /></div>
      <div>
        <p>STOCK FLOW</p>
        <h1>库存管理后台</h1>
      </div>
      <div class="login-brand__rule" />
      <p class="login-brand__caption">仓储、物料与库存数据的统一工作台</p>
    </section>

    <section class="login-panel">
      <div class="login-panel__heading">
        <p>管理员登录</p>
        <h2>欢迎回来</h2>
      </div>

      <NForm ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="submit">
        <NFormItem label="账号" path="username">
          <NInput
            v-model:value="form.username"
            placeholder="请输入账号"
            autocomplete="username"
            aria-label="账号"
          >
            <template #prefix><UserRound :size="17" /></template>
          </NInput>
        </NFormItem>
        <NFormItem label="密码" path="password">
          <NInput
            v-model:value="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            autocomplete="current-password"
            aria-label="密码"
            @keyup.enter="submit"
          >
            <template #prefix><LockKeyhole :size="17" /></template>
            <template #suffix>
              <NButton
                quaternary
                circle
                size="small"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                <template #icon>
                  <EyeOff v-if="showPassword" :size="17" />
                  <Eye v-else :size="17" />
                </template>
              </NButton>
            </template>
          </NInput>
        </NFormItem>
        <NButton type="primary" attr-type="submit" block size="large" :loading="submitting">
          登录
        </NButton>
      </NForm>

      <footer>Stock Flow Admin</footer>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(320px, 1fr) minmax(420px, 520px);
  background: #eef2f1;
}

.login-brand {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;
  padding: clamp(48px, 8vw, 120px);
  color: #f4faf7;
  background: #18211f;
}

.login-brand__mark {
  display: grid;
  width: 52px;
  height: 52px;
  margin-bottom: 36px;
  place-items: center;
  border-radius: 8px;
  color: #10201b;
  background: #64d4ae;
}

.login-brand p {
  margin: 0 0 10px;
  color: #8fa49d;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.login-brand h1 {
  margin: 0;
  font-size: clamp(34px, 4.5vw, 62px);
  font-weight: 680;
  letter-spacing: 0;
  line-height: 1.16;
}

.login-brand__rule {
  width: 56px;
  height: 3px;
  margin: 42px 0 24px;
  background: #64d4ae;
}

.login-brand .login-brand__caption {
  max-width: 360px;
  color: #b6c4bf;
  font-size: 15px;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 1.8;
}

.login-panel {
  display: flex;
  align-self: center;
  justify-self: center;
  width: min(100% - 48px, 380px);
  flex-direction: column;
  padding: 28px 0;
}

.login-panel__heading {
  margin-bottom: 30px;
}

.login-panel__heading p {
  margin: 0 0 7px;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 650;
}

.login-panel__heading h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 28px;
  font-weight: 680;
  letter-spacing: 0;
}

.login-panel footer {
  margin-top: 36px;
  color: #85908c;
  font-size: 12px;
  text-align: center;
}

@media (max-width: 767px) {
  .login-page {
    display: flex;
    flex-direction: column;
    background: #fff;
  }

  .login-brand {
    min-height: 210px;
    justify-content: flex-end;
    padding: 30px 24px;
  }

  .login-brand__mark {
    width: 42px;
    height: 42px;
    margin-bottom: 22px;
  }

  .login-brand h1 {
    font-size: 30px;
  }

  .login-brand__rule,
  .login-brand__caption {
    display: none;
  }

  .login-panel {
    width: min(100% - 40px, 420px);
    flex: 1;
    justify-content: center;
  }
}
</style>
