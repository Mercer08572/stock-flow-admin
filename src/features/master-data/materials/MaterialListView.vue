<script setup lang="ts">
import EntityListPage from '@/features/master-data/components/EntityListPage.vue'
import { useReferenceOptions } from '@/features/master-data/lib/reference-labels'
import {
  materialColumns,
  materialConfig,
  materialReferenceKeys,
} from '@/features/master-data/materials/material'

// 引用列需要「编码 - 名称」；选项到位后表格会自动重渲染
const { label } = useReferenceOptions(materialReferenceKeys)
const columns = materialColumns(label)
</script>

<template>
  <EntityListPage :config="materialConfig" :columns="columns" />
</template>
