<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import EntityListPage from '@/features/master-data/components/EntityListPage.vue'
import { skuColumns, skuConfig, skuFields } from '@/features/master-data/skus/sku'
import { useUnitCatalog } from '@/features/master-data/lib/unit-catalog'
import { useMaterialUnitOptions } from '@/features/master-data/materials/material-conversion'

import type { FieldConfig } from '@/features/master-data/lib/entity-form'

// 引用列（物料 / 单位）直接渲染后端内联的快照，无需再加载引用选项表
const columns = skuColumns()

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
