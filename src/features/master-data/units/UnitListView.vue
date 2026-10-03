<script setup lang="ts">
import EntityListPage from '@/features/master-data/components/EntityListPage.vue'
import { unitConfig } from '@/features/master-data/units/unit'
</script>

<template>
  <EntityListPage :config="unitConfig" />
</template>
