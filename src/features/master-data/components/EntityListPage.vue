<script setup lang="ts">
/**
 * 主数据列表页的共享模板。
 *
 * 5 个资源各自的 `*ListView.vue` 把本目录的 `*.ts` 配置交给这里渲染，
 * 差异全部来自配置（列、字段、接口绑定、是否支持停用），模板只有一份。
 */

import { Plus, RefreshCw } from '@lucide/vue'
import { computed } from 'vue'
import { NButton, NPagination } from 'naive-ui'
import { useRouter } from 'vue-router'

import DataTable from '@/components/common/DataTable.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EntityFormDrawer from '@/features/master-data/components/EntityFormDrawer.vue'
import { useEntityList } from '@/features/master-data/lib/entity-list'
import { actionColumn } from '@/features/master-data/lib/row-actions'

import type { DataTableColumn } from '@/components/common/data-table'
import type { FieldConfig } from '@/features/master-data/lib/entity-form'
import type { ResourceConfig } from '@/features/master-data/lib/list-config'
import type { BaseEntity } from '@/types/api'

const props = withDefaults(
  defineProps<{
    config: ResourceConfig<BaseEntity>
    /** 停用确认框里的补充说明；仅仓库传入 */
    disableHint?: string
    /** 列：带引用标签的资源由页面传入；其余资源用配置里的 columns */
    columns?: readonly DataTableColumn<BaseEntity>[]
    /** 字段：需要按选中项联动的资源（如 SKU 的单位候选）由页面传入 */
    fields?: readonly FieldConfig[]
  }>(),
  { disableHint: '', columns: undefined, fields: undefined },
)

const {
  rows,
  loading,
  errorDetail,
  drawerOpen,
  drawerMode,
  editingId,
  total,
  page,
  pageCount,
  pageSize,
  reload,
  goToPage,
  openCreate,
  openEdit,
  onSaved,
  confirmDelete,
  confirmDisable,
} = useEntityList<BaseEntity>({
  title: props.config.title,
  load: (offset) => props.config.load(offset),
  remove: (id) => props.config.remove(id),
  disable: props.config.disable,
  disableHint: props.disableHint,
})

const router = useRouter()

const columns = computed(() => [
  ...(props.columns ?? props.config.columns ?? []),
  actionColumn<BaseEntity>({
    onEdit: openEdit,
    onDelete: confirmDelete,
    ...(props.config.disable ? { onDisable: confirmDisable } : {}),
    ...(props.config.detailRoute ? { onDetail: openDetail } : {}),
  }),
])

/** 有详情页的资源：整行可点击 + 操作列「详情」按钮 */
const detailRoute = computed(() => props.config.detailRoute)

function openDetail(row: BaseEntity) {
  const route = props.config.detailRoute?.(row)
  if (route) void router.push(route)
}

// 首屏加载：每个资源页进入时各自拉一次自己的列表
void reload()
</script>

<template>
  <main class="page">
    <PageHeader
      :title="config.title"
      :description="`共 ${total} 条 · 第 ${page} / ${pageCount} 页`"
    >
      <template #actions>
        <NButton type="primary" @click="openCreate">
          <template #icon><Plus :size="16" /></template>
          新增
        </NButton>
        <NButton :loading="loading" @click="reload">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <section class="panel">
      <DataTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :error="errorDetail?.message ?? ''"
        :error-trace-id="errorDetail?.traceId ?? ''"
        :export-file-name="config.title"
        :row-clickable="Boolean(detailRoute)"
        @row-click="openDetail"
        @retry="reload"
      />

      <footer v-if="total > 0" class="pager">
        <span class="pager__hint">共 {{ total }} 条，每页 {{ pageSize }} 条</span>
        <NPagination
          :page="page"
          :item-count="total"
          :page-size="pageSize"
          :disabled="loading"
          show-quick-jumper
          @update:page="goToPage"
        >
          <template #goto>跳至</template>
        </NPagination>
      </footer>
    </section>

    <EntityFormDrawer
      v-model:show="drawerOpen"
      :fields="fields ?? config.fields"
      :title="config.title"
      :mode="drawerMode"
      :entity-id="editingId"
      :load="config.get"
      :create="config.create"
      :update="config.update"
      @saved="onSaved"
    />
  </main>
</template>

<style scoped>
.row-actions {
  display: inline-flex;
  justify-content: flex-end;
  gap: 2px;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
}

.pager__hint {
  color: var(--color-text-muted);
  font-size: 12px;
}

.pager :deep(.n-pagination) {
  flex-wrap: wrap;
  justify-content: flex-end;
}

@media (max-width: 680px) {
  .pager {
    align-items: stretch;
    flex-direction: column;
  }

  .pager :deep(.n-pagination) {
    justify-content: flex-start;
  }
}
</style>
