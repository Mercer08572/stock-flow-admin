<script setup lang="ts">
/**
 * 物料详情页：物料基本信息 + 该物料下的 SKU 子表。
 *
 * 两条关键约定：
 * 1. 子表只按 `material_id` 取数（`GET /skus?material_id=`），不做跨物料查询；
 * 2. 就地新增/编辑 SKU 复用 `EntityFormDrawer` 与 `skus/sku.ts` 的字段定义，
 *    其中「物料」锁定为当前物料——既保证 `material_id` 一定出现在全量替换的载荷里，
 *    也避免用户在详情页把 SKU 挪到另一个物料。
 */

import { ChevronLeft, Pencil, Plus, RefreshCw } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton } from 'naive-ui'

import { getErrorDetail, type ErrorDetail } from '@/api/error'
import { materialsApi } from '@/api/materials'
import { skusApi } from '@/api/skus'
import AsyncState from '@/components/common/AsyncState.vue'
import DataTable from '@/components/common/DataTable.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusTag from '@/components/common/StatusTag.vue'
import EntityFormDrawer from '@/features/master-data/components/EntityFormDrawer.vue'
import { useEntityList } from '@/features/master-data/lib/entity-list'
import { useReferenceOptions } from '@/features/master-data/lib/reference-labels'
import { actionColumn } from '@/features/master-data/lib/row-actions'
import { useUnitCatalog } from '@/features/master-data/lib/unit-catalog'
import MaterialConversionsPanel from '@/features/master-data/materials/MaterialConversionsPanel.vue'
import { materialEditFields } from '@/features/master-data/materials/material'
import { skuDetailColumns, skuFieldsForMaterial } from '@/features/master-data/skus/sku'

import type { Material, SKU } from '@/types/api'

/** 后端 `MaxListLimit`：子表一次取满，超出部分提示去独立的 SKU 列表查 */
const SKU_PAGE_SIZE = 100

const route = useRoute()
const router = useRouter()
const materialId = Number(route.params.id)

const material = ref<Material | null>(null)
const materialLoading = ref(false)
const materialError = ref<ErrorDetail | null>(null)

// 基础信息里的分类与基础单位都要显示「编码 - 名称」，因此需要分类与单位的引用选项
const { label } = useReferenceOptions(['categories', 'units'])

// 单位目录同时服务于换算区块与新增 SKU 的单位下拉，因此在这一层加载并显式刷新
const { units, ensure: ensureUnits, reload: reloadUnits } = useUnitCatalog()

const materialDrawerOpen = ref(false)

const {
  rows,
  loading,
  errorDetail,
  drawerOpen,
  drawerMode,
  editingId,
  reload,
  openCreate,
  openEdit,
  onSaved,
  confirmDelete,
} = useEntityList<SKU>({
  title: 'SKU',
  load: () => skusApi.list({ material_id: materialId, limit: SKU_PAGE_SIZE, offset: 0 }),
  remove: skusApi.remove,
})

/** 物料与单位目录到位后重算 SKU 字段：单位下拉只列与基础单位可公度的单位 */
const fields = computed(() =>
  material.value ? skuFieldsForMaterial(materialId, material.value.base_unit_id, units.value) : [],
)

const columns = computed(() => [
  ...skuDetailColumns(label),
  actionColumn<SKU>({ onEdit: openEdit, onDelete: confirmDelete }),
])

/** 满页说明可能还有更多，后端没有 total，只能按「本页是否取满」提示 */
const skuListMayBeTruncated = computed(() => rows.value.length >= SKU_PAGE_SIZE)

const materialTitle = computed(() =>
  material.value ? `物料 ${material.value.code} - ${material.value.name}` : '物料详情',
)

const editFields = computed(() =>
  material.value ? materialEditFields(material.value.base_unit_id) : [],
)

/** 换算改动后单位可用集合会变，SKU 表单与换算区块都要拿到最新目录 */
async function onConversionsChanged() {
  await reloadUnits()
}

async function loadMaterial() {
  materialLoading.value = true
  materialError.value = null
  try {
    material.value = await materialsApi.get(materialId)
  } catch (error) {
    material.value = null
    materialError.value = getErrorDetail(error)
  } finally {
    materialLoading.value = false
  }
}

function backToList() {
  void router.push('/master-data/materials')
}

onMounted(() => {
  void loadMaterial()
  void reload()
  void ensureUnits()
})
</script>

<template>
  <main class="page">
    <PageHeader :title="materialTitle" description="该物料下的 SKU">
      <template #actions>
        <NButton @click="backToList">
          <template #icon><ChevronLeft :size="16" /></template>
          返回列表
        </NButton>
        <NButton :disabled="!material" @click="materialDrawerOpen = true">
          <template #icon><Pencil :size="16" /></template>
          编辑物料
        </NButton>
        <NButton type="primary" :disabled="!material" @click="openCreate">
          <template #icon><Plus :size="16" /></template>
          新增 SKU
        </NButton>
        <NButton :loading="loading" @click="reload">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <section class="panel">
      <AsyncState
        :loading="materialLoading"
        :error="materialError?.message ?? ''"
        :error-trace-id="materialError?.traceId ?? ''"
        @retry="loadMaterial"
      >
        <dl v-if="material" class="material-facts">
          <div class="material-fact">
            <dt>编码</dt>
            <dd>{{ material.code }}</dd>
          </div>
          <div class="material-fact">
            <dt>名称</dt>
            <dd>{{ material.name }}</dd>
          </div>
          <div class="material-fact">
            <dt>分类</dt>
            <dd>{{ label('categories', material.category_id) }}</dd>
          </div>
          <div class="material-fact">
            <dt>基础单位</dt>
            <dd>{{ label('units', material.base_unit_id) }}</dd>
          </div>
          <div class="material-fact">
            <dt>状态</dt>
            <dd>
              <StatusTag :status="material.status" />
            </dd>
          </div>
          <div class="material-fact material-fact--wide">
            <dt>备注</dt>
            <dd>{{ material.remark || '-' }}</dd>
          </div>
        </dl>
      </AsyncState>
    </section>

    <MaterialConversionsPanel
      v-if="material"
      :material-id="materialId"
      :base-unit-id="material.base_unit_id"
      :units="units"
      @changed="onConversionsChanged"
    />

    <section class="panel">
      <div class="panel-head">
        <h2>SKU（{{ rows.length }}）</h2>
        <p>单位必须与基础单位可公度且已建立换算；库存按 SKU 分别记录，不做跨 SKU 自动合并。</p>
      </div>
      <p v-if="skuListMayBeTruncated" class="panel-hint">
        子表最多显示 {{ SKU_PAGE_SIZE }} 条，更多请到 SKU 列表按物料筛选。
      </p>
      <DataTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :error="errorDetail?.message ?? ''"
        :error-trace-id="errorDetail?.traceId ?? ''"
        empty-text="该物料下暂无 SKU"
        export-file-name="SKU"
        @retry="reload"
      />
    </section>

    <EntityFormDrawer
      v-model:show="materialDrawerOpen"
      :fields="editFields"
      title="物料"
      mode="edit"
      :entity-id="materialId"
      :load="materialsApi.get"
      :update="materialsApi.update"
      @saved="loadMaterial"
    />

    <EntityFormDrawer
      v-model:show="drawerOpen"
      :fields="fields"
      title="SKU"
      :mode="drawerMode"
      :entity-id="editingId"
      :load="skusApi.get"
      :create="skusApi.create"
      :update="skusApi.update"
      @saved="onSaved"
    />
  </main>
</template>

<style scoped>
/**
 * 基础信息用「标签 / 取值」成对展示。
 *
 * 之前是一行 flex 直接铺开（`编码：xxx 名称：yyy …`），标签与取值混在一条流里，
 * 值一长就分不清哪个值属于哪个字段。改成网格后每对独占一格，窄屏自动回落成单列。
 */
.material-facts {
  display: grid;
  gap: 14px 24px;
  margin: 0;
  padding: 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
}

.material-fact {
  min-width: 0;
}

.material-fact--wide {
  grid-column: 1 / -1;
}

.material-fact dt {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.material-fact dd {
  margin: 2px 0 0;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .material-facts {
    gap: 12px;
    padding: 14px 16px;
  }
}

.panel-head {
  padding: 14px 16px 10px;
}

.panel-head h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 650;
}

.panel-head p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}

.panel-hint {
  margin: 0;
  padding: 0 16px 10px;
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
