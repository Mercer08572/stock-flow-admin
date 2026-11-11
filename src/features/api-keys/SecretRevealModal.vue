<script setup lang="ts">
/* global navigator */
import { Check, Copy, ShieldAlert } from '@lucide/vue'
import { NAlert, NButton, NModal, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

import type { APIApp, IssuedAPISecret } from '@/types/api'

/**
 * 一次性明文弹窗。
 *
 * 明文只存在于父组件传入的 `issued` 中；关闭时父组件必须清空它。
 * 弹窗刻意禁止点遮罩和 ESC 关闭，避免用户误触后永久丢失密钥。
 */
const props = defineProps<{
  show: boolean
  app: APIApp | null
  issued: IssuedAPISecret | null
}>()

const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const message = useMessage()
const copied = ref<'app' | 'secret' | null>(null)

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

async function copy(kind: 'app' | 'secret', value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = kind
    message.success('已复制')
  } catch {
    message.error('复制失败，请手动选择文本复制')
  }
}

function close() {
  copied.value = null
  visible.value = false
}
</script>

<template>
  <NModal
    v-model:show="visible"
    preset="card"
    :mask-closable="false"
    :close-on-esc="false"
    :closable="false"
    :style="{ width: 'min(560px, 92vw)' }"
    title="密钥已签发"
  >
    <template v-if="app && issued">
      <NAlert type="warning" :show-icon="true" class="reveal-warning">
        <template #icon><ShieldAlert :size="18" /></template>
        <div>
          密钥明文<strong>只显示这一次</strong>。关闭弹窗后无法再次查看，只能重新签发；
          请立即复制并妥善保存。
        </div>
      </NAlert>

      <dl class="credential">
        <div class="credential__row">
          <dt>应用</dt>
          <dd>{{ app.name }}</dd>
        </div>
        <div class="credential__row">
          <dt>App ID</dt>
          <dd class="credential__value">
            <code>{{ app.app_id }}</code>
            <NButton
              size="tiny"
              quaternary
              :aria-label="copied === 'app' ? 'App ID 已复制' : '复制 App ID'"
              @click="copy('app', app.app_id)"
            >
              <template #icon>
                <Check v-if="copied === 'app'" :size="14" />
                <Copy v-else :size="14" />
              </template>
            </NButton>
          </dd>
        </div>
        <div class="credential__row">
          <dt>Secret</dt>
          <dd class="credential__value">
            <code class="credential__secret">{{ issued.secret }}</code>
            <NButton
              size="tiny"
              quaternary
              :aria-label="copied === 'secret' ? 'Secret 已复制' : '复制 Secret'"
              @click="copy('secret', issued.secret)"
            >
              <template #icon>
                <Check v-if="copied === 'secret'" :size="14" />
                <Copy v-else :size="14" />
              </template>
            </NButton>
          </dd>
        </div>
      </dl>

      <p class="usage">
        调用受保护接口时同时发送请求头
        <code>X-Stock-Flow-App-ID: {{ app.app_id }}</code>
        与
        <code>X-Stock-Flow-Secret: &lt;Secret&gt;</code>。
      </p>
    </template>

    <template #footer>
      <div class="modal-footer">
        <NButton type="primary" @click="close">我已妥善保存</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.reveal-warning {
  margin-bottom: 16px;
}

.credential {
  margin: 0;
  padding: 4px 0;
}

.credential__row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
}

.credential__row:last-child {
  border-bottom: 0;
}

.credential dt {
  width: 76px;
  flex: none;
  color: var(--color-text-muted);
  font-size: 13px;
}

.credential dd {
  min-width: 0;
  flex: 1;
  margin: 0;
  color: var(--color-text);
  word-break: break-all;
}

.credential__value {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.credential code {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-bg);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.credential__secret {
  line-height: 1.7;
}

.usage {
  margin: 16px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.7;
  word-break: break-all;
}

.usage code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .credential__row {
    flex-direction: column;
    gap: 4px;
  }

  .credential dt {
    width: auto;
  }
}
</style>
