<script setup lang="ts">
import EntityListPage from '@/features/master-data/components/EntityListPage.vue'
import { materialColumns, materialConfig } from '@/features/master-data/materials/material'

const columns = materialColumns()
</script>

<template>
  <EntityListPage :config="materialConfig" :columns="columns" />
</template>
