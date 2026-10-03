<script setup lang="ts">
import EntityListPage from '@/features/master-data/components/EntityListPage.vue'
import { warehouseConfig, warehouseDisableHint } from '@/features/master-data/warehouses/warehouse'
</script>

<template>
  <EntityListPage :config="warehouseConfig" :disable-hint="warehouseDisableHint" />
</template>
