<script setup lang="ts">
import EntityListPage from '@/features/master-data/components/EntityListPage.vue'
import { categoryConfig } from '@/features/master-data/categories/category'
</script>

<template>
  <EntityListPage :config="categoryConfig" />
</template>
