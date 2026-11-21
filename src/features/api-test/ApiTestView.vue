<script setup lang="ts">
/* global navigator */
import { Copy, Eraser, Play, RefreshCw } from '@lucide/vue'
import {
  NAlert,
  NButton,
  NCollapse,
  NCollapseItem,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NTag,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { getErrorDetail, type ErrorDetail } from '@/api/error'
import PageHeader from '@/components/common/PageHeader.vue'
import { apiTestApi } from '@/features/api-test/api'
import {
  API_TEST_OPERATIONS,
  DEFAULT_API_TEST_OPERATION,
  QTY_PRESETS,
  buildOperationBody,
  createIdempotencyKey,
  findOperation,
  operationLabel,
  operationUrl,
  validateApiTestForm,
  type ApiTestFormState,
  type ApiTestOperation,
} from '@/features/api-test/operations'

import type { Reservation, SKU, StockBalance, StockOperationResult, Warehouse } from '@/types/api'

interface SelectOption {
  label: string
  value: number
}

interface ResponseMeta {
  status: number
  elapsedMs: number
  at: string
}

const message = useMessage()

const operation = ref<ApiTestOperation>('increase')
const definition = computed(() => findOperation(operation.value) ?? DEFAULT_API_TEST_OPERATION)

const form = reactive<ApiTestFormState>({
  warehouseId: null,
  skuId: null,
  batchId: null,
  reservationId: null,
  qty: '1',
  idempotencyKey: createIdempotencyKey(),
  sourceType: '',
  sourceId: '',
  sourceLineId: '',
})

const warehouseOptions = ref<SelectOption[]>([])
const skuOptions = ref<SelectOption[]>([])
const reservationOptions = ref<SelectOption[]>([])
const reservations = ref<Reservation[]>([])
const optionsLoading = ref(false)
const optionsError = ref('')
const optionsErrorTraceId = ref('')

const stock = ref<StockBalance | null>(null)
const stockLoading = ref(false)
const stockError = ref('')
const stockErrorTraceId = ref('')

const sending = ref(false)
const showValidation = ref(false)
const result = ref<StockOperationResult | null>(null)
const errorDetail = ref<ErrorDetail | null>(null)
const responseMeta = ref<ResponseMeta | null>(null)

const validationErrors = computed(() => validateApiTestForm(form, definition.value))

/** 请求体：仓库 / SKU 未选时无法组装，预览留空 */
const previewBody = computed(() => {
  try {
    return JSON.stringify(buildOperationBody(form, definition.value), null, 2)
  } catch {
    return ''
  }
})
const previewUrl = computed(() => operationUrl(definition.value.endpoint))
const requestPreview = computed(() =>
  previewBody.value === '' ? '' : `POST ${previewUrl.value}\n\n${previewBody.value}`,
)

const resultJson = computed(() => (result.value ? JSON.stringify(result.value, null, 2) : ''))

/** 当前库存里的批次 ID（去重），点击即可填入批次字段 */
const batchIds = computed(() => {
  const ids = new Set<number>()
  for (const layer of stock.value?.layers ?? []) {
    if (layer.batch_id !== null) ids.add(layer.batch_id)
  }
  return [...ids]
})

function warehouseLabel(warehouse: Warehouse): string {
  return `${warehouse.code} - ${warehouse.name}`
}

function skuLabel(sku: SKU): string {
  return `${sku.code} - ${sku.name}`
}

function reservationLabel(reservation: Reservation): string {
  const warehouse = reservation.warehouse?.code || `#${reservation.warehouse_id}`
  const sku = reservation.sku?.code || `#${reservation.sku_id}`
  return `#${reservation.id} · ${warehouse}/${sku} · 剩余 ${reservation.remaining_qty}`
}

function reservationStatusText(status: string): string {
  return status === 'active' ? '预留中' : '已关闭'
}

function applyReservations(items: Reservation[]) {
  reservations.value = items
  reservationOptions.value = items.map((item) => ({
    label: reservationLabel(item),
    value: item.id,
  }))
}

async function loadOptions() {
  optionsLoading.value = true
  optionsError.value = ''
  optionsErrorTraceId.value = ''
  try {
    const [warehouses, skus, activeReservations] = await Promise.all([
      apiTestApi.listWarehouses(),
      apiTestApi.listSkus(),
      apiTestApi.listActiveReservations(),
    ])
    warehouseOptions.value = warehouses.items.map((item) => ({
      label: warehouseLabel(item),
      value: item.id,
    }))
    skuOptions.value = skus.items.map((item) => ({ label: skuLabel(item), value: item.id }))
    applyReservations(activeReservations.items)
  } catch (error) {
    const detail = getErrorDetail(error)
    optionsError.value = detail.message
    optionsErrorTraceId.value = detail.traceId ?? ''
  } finally {
    optionsLoading.value = false
  }
}

/** 变更后预留单会减少/关闭，静默刷新；失败时保留原选项，不打断主流程 */
async function refreshReservations() {
  try {
    const activeReservations = await apiTestApi.listActiveReservations()
    applyReservations(activeReservations.items)
    if (
      form.reservationId !== null &&
      !activeReservations.items.some((item) => item.id === form.reservationId)
    ) {
      form.reservationId = null
    }
  } catch {
    // 下拉刷新失败不应覆盖已有数据：用户仍可用当前选项继续调试
  }
}

/** 防止旧请求覆盖新选择（快速切换仓库 / SKU 时） */
let stockRequestId = 0

async function loadStock() {
  const { warehouseId, skuId } = form
  if (warehouseId === null || skuId === null) {
    stock.value = null
    stockError.value = ''
    stockErrorTraceId.value = ''
    stockLoading.value = false
    return
  }

  const requestId = ++stockRequestId
  stockLoading.value = true
  stockError.value = ''
  stockErrorTraceId.value = ''
  try {
    const data = await apiTestApi.getStock(warehouseId, skuId)
    if (requestId === stockRequestId) stock.value = data
  } catch (error) {
    if (requestId !== stockRequestId) return
    stock.value = null
    const detail = getErrorDetail(error)
    stockError.value = detail.message
    stockErrorTraceId.value = detail.traceId ?? ''
  } finally {
    if (requestId === stockRequestId) stockLoading.value = false
  }
}

function onReservationChange(value: string | number | null) {
  const id = typeof value === 'number' ? value : null
  form.reservationId = id
  if (id === null) return

  const reservation = reservations.value.find((item) => item.id === id)
  if (!reservation) return

  // 预留单的仓库 / SKU 与来源是后端校验的一部分，选中后直接回填，避免手填错行
  form.warehouseId = reservation.warehouse_id
  form.skuId = reservation.sku_id
  message.info(`已按预留单 #${id} 回填仓库与 SKU`)
}

function setQty(value: string) {
  form.qty = value
}

function regenerateKey() {
  form.idempotencyKey = createIdempotencyKey()
}

function resetForm() {
  form.warehouseId = null
  form.skuId = null
  form.batchId = null
  form.reservationId = null
  form.qty = '1'
  form.sourceType = ''
  form.sourceId = ''
  form.sourceLineId = ''
  form.idempotencyKey = createIdempotencyKey()
  result.value = null
  errorDetail.value = null
  responseMeta.value = null
  showValidation.value = false
  stock.value = null
  stockError.value = ''
}

async function copy(text: string, label: string) {
  if (text === '') return
  try {
    if (!navigator.clipboard) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(text)
    message.success(`${label}已复制`)
  } catch {
    message.warning('当前浏览器不允许写入剪贴板，请手动选择复制')
  }
}

async function send() {
  if (sending.value) return

  showValidation.value = true
  const errors = validationErrors.value
  if (errors.length > 0) {
    message.error(errors[0] ?? '请检查参数')
    return
  }

  let body
  try {
    body = buildOperationBody(form, definition.value)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '请求体组装失败')
    return
  }

  sending.value = true
  errorDetail.value = null
  result.value = null
  const startedAt = Date.now()
  const labels = definition.value.label

  try {
    const data = await apiTestApi.send(definition.value.endpoint, body)
    result.value = data
    responseMeta.value = {
      status: 200,
      elapsedMs: Date.now() - startedAt,
      at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    }
    message.success(`${labels}成功`)
    void loadStock()
    if (definition.value.requiresReservation) void refreshReservations()
  } catch (error) {
    const detail = getErrorDetail(error)
    errorDetail.value = detail
    responseMeta.value = {
      status: detail.status ?? 0,
      elapsedMs: Date.now() - startedAt,
      at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    }
  } finally {
    sending.value = false
  }
}

watch(operation, () => {
  showValidation.value = false
  result.value = null
  errorDetail.value = null
  responseMeta.value = null
  // 切换操作后清掉不适用的参数，避免「预留扣减带着 batch_id」这类必定 400 的组合
  if (!definition.value.allowsBatch) form.batchId = null
  if (!definition.value.requiresReservation) form.reservationId = null
})

watch([() => form.warehouseId, () => form.skuId], () => {
  void loadStock()
})

onMounted(() => {
  void loadOptions()
})
</script>

<template>
  <main class="page api-test">
    <PageHeader
      title="API 测试"
      description="开发调试专用（仅开发环境可见）：直接调用库存变更接口，会真实写入库存与流水。"
    />

    <NAlert type="warning" :bordered="false" title="此页会真实变更库存">
      请求直接落到后端库存接口，会产生库存流水并改变余额。请只在开发 /
      测试库操作；重复提交时复用同一个幂等键可验证幂等行为。
    </NAlert>

    <NAlert v-if="optionsError" type="error" :bordered="false" title="下拉选项加载失败">
      <p class="error-message">{{ optionsError }}</p>
      <p v-if="optionsErrorTraceId" class="error-meta">trace_id {{ optionsErrorTraceId }}</p>
      <NButton size="tiny" secondary :loading="optionsLoading" @click="loadOptions">重试</NButton>
    </NAlert>

    <div class="api-test__layout">
      <section class="card form-card">
        <header class="card-head">
          <h2>操作与参数</h2>
          <span class="card-meta"
            >五个操作覆盖库存增加 / 预留 / 预留扣减 / 直接扣减 / 预留释放</span
          >
        </header>

        <NForm label-placement="top" class="api-test-form">
          <NFormItem label="操作类型">
            <NRadioGroup
              v-model:value="operation"
              class="operation-radios"
              aria-label="库存操作类型"
            >
              <NRadioButton
                v-for="item in API_TEST_OPERATIONS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </NRadioButton>
            </NRadioGroup>
          </NFormItem>
          <p class="operation-desc">{{ definition.description }}</p>

          <div class="field-grid">
            <NFormItem label="仓库" required>
              <NSelect
                v-model:value="form.warehouseId"
                :options="warehouseOptions"
                :loading="optionsLoading"
                filterable
                clearable
                placeholder="选择仓库（编码 - 名称）"
              />
            </NFormItem>

            <NFormItem label="SKU" required>
              <NSelect
                v-model:value="form.skuId"
                :options="skuOptions"
                :loading="optionsLoading"
                filterable
                clearable
                placeholder="选择 SKU（编码 - 名称）"
              />
            </NFormItem>

            <NFormItem
              v-if="definition.requiresReservation"
              label="预留单"
              required
              class="field-grid__wide"
            >
              <NSelect
                :value="form.reservationId"
                :options="reservationOptions"
                :loading="optionsLoading"
                filterable
                clearable
                placeholder="选择预留中且仍有剩余数量的预留单"
                @update:value="onReservationChange"
              />
            </NFormItem>

            <NFormItem v-if="definition.allowsBatch" label="批次 ID（可选）">
              <NInputNumber
                v-model:value="form.batchId"
                class="full-width"
                :min="1"
                :precision="0"
                :show-button="false"
                placeholder="留空 = 非批次库存"
              />
            </NFormItem>

            <NFormItem
              :label="definition.qtyOptional ? '数量（留空 = 全部剩余）' : '数量'"
              :required="!definition.qtyOptional"
            >
              <div class="qty-field">
                <NInput
                  v-model:value="form.qty"
                  placeholder="如 1 或 0.5（最多 6 位小数）"
                  inputmode="decimal"
                />
                <div class="qty-presets">
                  <NButton
                    v-for="preset in QTY_PRESETS"
                    :key="preset"
                    size="tiny"
                    secondary
                    @click="setQty(preset)"
                  >
                    {{ preset }}
                  </NButton>
                </div>
              </div>
            </NFormItem>
          </div>

          <p v-if="!definition.allowsBatch" class="field-hint">
            预留扣减 / 预留释放的批次由预留分配决定，接口禁止传 batch_id。
          </p>

          <NFormItem label="幂等键" required>
            <div class="idempotency-field">
              <NInput
                v-model:value="form.idempotencyKey"
                placeholder="每次变更必须唯一，重复提交请复用"
              />
              <NButton size="small" secondary @click="regenerateKey">
                <template #icon><RefreshCw :size="14" /></template>
                重新生成
              </NButton>
              <NButton
                size="small"
                quaternary
                aria-label="复制幂等键"
                @click="copy(form.idempotencyKey, '幂等键')"
              >
                <template #icon><Copy :size="14" /></template>
              </NButton>
            </div>
          </NFormItem>

          <NCollapse class="advanced">
            <NCollapseItem title="高级参数（来源信息，可选）" name="advanced">
              <div class="field-grid">
                <NFormItem label="来源类型 source_type">
                  <NInput v-model:value="form.sourceType" placeholder="如 dev_test" />
                </NFormItem>
                <NFormItem label="来源 ID source_id">
                  <NInput v-model:value="form.sourceId" placeholder="如 DEMO-001" />
                </NFormItem>
                <NFormItem label="来源行 ID source_line_id">
                  <NInput v-model:value="form.sourceLineId" placeholder="如 DEMO-001-1" />
                </NFormItem>
              </div>
            </NCollapseItem>
          </NCollapse>

          <ul v-if="showValidation && validationErrors.length" class="validation-list" role="alert">
            <li v-for="error in validationErrors" :key="error">{{ error }}</li>
          </ul>

          <div class="form-actions">
            <NButton type="primary" :loading="sending" @click="send">
              <template #icon><Play :size="16" /></template>
              发送请求
            </NButton>
            <NButton secondary @click="resetForm">
              <template #icon><Eraser :size="16" /></template>
              重置参数
            </NButton>
          </div>
        </NForm>
      </section>

      <div class="api-test__side">
        <section class="card">
          <header class="card-head">
            <h2>请求预览</h2>
            <NButton
              text
              size="small"
              :disabled="previewBody === ''"
              @click="copy(requestPreview, '请求')"
            >
              <template #icon><Copy :size="14" /></template>
              复制
            </NButton>
          </header>
          <p class="endpoint"><span class="method">POST</span> {{ previewUrl }}</p>
          <pre class="code-block code-block--compact" aria-label="请求体">{{
            previewBody || '选择仓库与 SKU 后显示请求体'
          }}</pre>
        </section>

        <section class="card">
          <header class="card-head">
            <h2>当前库存</h2>
            <NButton
              text
              size="small"
              :loading="stockLoading"
              :disabled="form.warehouseId === null || form.skuId === null"
              @click="loadStock"
            >
              <template #icon><RefreshCw :size="14" /></template>
              刷新
            </NButton>
          </header>

          <NAlert v-if="stockError" type="error" :bordered="false" class="stock-error">
            <p class="error-message">{{ stockError }}</p>
            <p v-if="stockErrorTraceId" class="error-meta">trace_id {{ stockErrorTraceId }}</p>
            <NButton size="tiny" secondary @click="loadStock">重试</NButton>
          </NAlert>

          <p v-else-if="form.warehouseId === null || form.skuId === null" class="muted">
            选择仓库与 SKU 后展示当前余额与批次。
          </p>
          <p v-else-if="stockLoading" class="muted">加载中…</p>
          <template v-else-if="stock">
            <dl class="qty-grid">
              <div>
                <dt>在库</dt>
                <dd>{{ stock.on_hand_qty }}</dd>
              </div>
              <div>
                <dt>预留</dt>
                <dd>{{ stock.reserved_qty }}</dd>
              </div>
              <div>
                <dt>可用</dt>
                <dd>{{ stock.available_qty }}</dd>
              </div>
            </dl>

            <div v-if="definition.allowsBatch && batchIds.length" class="batch-chips">
              <span class="muted">批次：</span>
              <NButton
                v-for="id in batchIds"
                :key="id"
                size="tiny"
                secondary
                @click="form.batchId = id"
              >
                {{ id }}
              </NButton>
            </div>
            <p v-else-if="definition.allowsBatch" class="muted">当前没有带批次的库存层。</p>
          </template>
          <p v-else class="muted">该仓库 + SKU 还没有库存行，先执行一次「库存增加」。</p>
        </section>
      </div>
    </div>

    <section class="card response-card" aria-live="polite">
      <header class="card-head">
        <h2>响应</h2>
        <span v-if="responseMeta" class="card-meta">
          HTTP {{ responseMeta.status }} · {{ responseMeta.elapsedMs }} ms · {{ responseMeta.at }}
        </span>
      </header>

      <NAlert v-if="errorDetail" type="error" :bordered="false" title="请求失败">
        <p class="error-message">{{ errorDetail.message }}</p>
        <p class="error-meta">
          <span v-if="errorDetail.status">HTTP {{ errorDetail.status }}</span>
          <span v-if="errorDetail.code !== undefined">code {{ errorDetail.code }}</span>
          <span v-if="errorDetail.errorCode">error_code {{ errorDetail.errorCode }}</span>
          <span v-if="errorDetail.traceId">trace_id {{ errorDetail.traceId }}</span>
        </p>
      </NAlert>

      <template v-else-if="result">
        <div class="result-head">
          <NTag type="success" size="small" :bordered="false">
            {{ operationLabel(result.operation_type) }}
          </NTag>
          <span class="muted">数量 {{ result.qty }}</span>
          <span class="muted">流水 {{ result.movements.length }} 条</span>
          <NButton text size="small" @click="copy(resultJson, '响应 JSON')">
            <template #icon><Copy :size="14" /></template>
            复制 JSON
          </NButton>
        </div>

        <dl class="qty-grid">
          <div>
            <dt>在库</dt>
            <dd>{{ result.stock_after.on_hand_qty }}</dd>
          </div>
          <div>
            <dt>预留</dt>
            <dd>{{ result.stock_after.reserved_qty }}</dd>
          </div>
          <div>
            <dt>可用</dt>
            <dd>{{ result.stock_after.available_qty }}</dd>
          </div>
        </dl>

        <div v-if="result.reservation" class="reservation-snapshot">
          <span>预留单 #{{ result.reservation.id }}</span>
          <NTag size="small" :bordered="false">
            {{ reservationStatusText(result.reservation.status) }}
          </NTag>
          <span class="muted">剩余 {{ result.reservation.remaining_qty }}</span>
          <span v-if="result.reservation.close_reason" class="muted">
            关闭原因 {{ result.reservation.close_reason }}
          </span>
        </div>

        <div v-if="result.movements.length" class="movement-chips">
          <span class="muted">流水：</span>
          <NTag
            v-for="movement in result.movements"
            :key="movement.id"
            size="small"
            :bordered="false"
          >
            #{{ movement.id }} · 层 {{ movement.stock_layer_id ?? '无' }} · {{ movement.qty }}
          </NTag>
        </div>

        <pre class="code-block" aria-label="响应 JSON">{{ resultJson }}</pre>
      </template>

      <p v-else class="muted response-empty">
        发送请求后在此展示状态码、耗时、trace_id、库存快照与原始 JSON。
      </p>
    </section>
  </main>
</template>

<style scoped>
.api-test {
  max-width: 1280px;
}

.api-test__layout {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 16px;
  align-items: start;
}

.api-test__side {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.card {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.card-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
}

.card-meta {
  color: var(--color-text-muted);
  font-size: 12px;
}

.api-test-form {
  min-width: 0;
}

.operation-radios {
  /*
   * Naive 的按钮组样式给根节点写死了 `height: var(--n-height)`（34px）。
   * 只加 flex-wrap 时第二行会溢出到描述文案上，必须把高度交还给内容。
   */
  display: flex;
  height: auto;
  flex-wrap: wrap;
  gap: 6px;
  line-height: normal;
}

.operation-desc {
  margin: -8px 0 14px;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0 14px;
}

.field-grid__wide {
  grid-column: 1 / -1;
}

.field-hint {
  margin: -4px 0 12px;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.full-width {
  width: 100%;
}

.qty-field {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 6px;
}

.qty-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.idempotency-field {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  gap: 8px;
}

.idempotency-field .n-input {
  min-width: 0;
  flex: 1 1 220px;
}

.advanced {
  margin: 4px 0 12px;
}

.validation-list {
  margin: 0 0 12px;
  padding-left: 18px;
  color: #d03050;
  font-size: 12px;
  line-height: 1.7;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.endpoint {
  margin: 0 0 8px;
  color: var(--color-text-muted);
  font-size: 12px;
  word-break: break-all;
}

.method {
  color: var(--color-primary);
  font-weight: 700;
}

.code-block {
  max-height: 360px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border-radius: 6px;
  background: #0f1a17;
  color: #d8f3e9;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.code-block--compact {
  max-height: 240px;
}

.qty-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 12px;
}

.qty-grid div {
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--color-bg);
}

.qty-grid dt {
  color: var(--color-text-muted);
  font-size: 12px;
}

.qty-grid dd {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 650;
  word-break: break-all;
}

.batch-chips,
.movement-chips,
.reservation-snapshot,
.result-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
}

.result-head {
  font-size: 13px;
}

.muted {
  color: var(--color-text-muted);
  font-size: 12px;
}

.response-empty {
  margin: 0;
  line-height: 1.6;
}

.error-message {
  margin: 0 0 6px;
}

.error-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0 0 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.stock-error {
  margin-bottom: 8px;
}

@media (max-width: 1024px) {
  .api-test__layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 480px) {
  .qty-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
