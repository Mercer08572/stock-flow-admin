<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import EntityListPage from '@/features/master-data/components/EntityListPage.vue'
import { useReferenceOptions } from '@/features/master-data/lib/reference-labels'
import { useUnitCatalog } from '@/features/master-data/lib/unit-catalog'
import { useMaterialUnitOptions } from '@/features/master-data/materials/material-conversion'
import { skuColumns, skuConfig, skuFields, skuReferenceKeys } from '@/features/master-data/skus/sku'

import type { FieldConfig } from '@/features/master-data/lib/entity-form'

// 引用列需要「编码 - 名称」；选项到位后表格会自动重渲染
const { label } = useReferenceOptions(skuReferenceKeys)
const columns = skuColumns(label)

// 单位候选取决于选中的物料：基础单位 ∪ 该物料已建立换算的单位
const { ensure: ensureUnits } = useUnitCatalog()
const materialUnits = useMaterialUnitOptions()
const selectedMaterialId = ref<number | null>(null)

const fields = computed<readonly FieldConfig[]>(() =>
  skuFields.map((field) => {
    if (field.key === 'material_id') {
      return {
        ...field,
        onChange: (value: unknown) => {
          selectedMaterialId.value = typeof value === 'number' ? value : null
        },
      }
    }

    if (field.key === 'unit_id') {
      // 未选物料、或换算还在加载时禁用：此前没有任何已确认的候选，选什么都可能被后端拒绝
      return {
        ...field,
        options: materialUnits.options(selectedMaterialId.value),
        disabled: selectedMaterialId.value === null || materialUnits.loading.value,
      }
    }

    return field
  }),
)

watch(selectedMaterialId, (materialId) => {
  void materialUnits.load(materialId)
})

onMounted(() => {
  void ensureUnits()
})
</script>

<template>
  <EntityListPage :config="skuConfig" :columns="columns" :fields="fields" />
</template>
