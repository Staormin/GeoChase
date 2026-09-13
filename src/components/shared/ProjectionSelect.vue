<template>
  <v-select
    v-model="projection"
    data-testid="project-projection-select"
    density="compact"
    :hint="$t('project.projection.hint')"
    :items="options"
    :label="$t('project.projection.label')"
    persistent-hint
    variant="outlined"
  />
</template>

<script setup lang="ts">
import type { ProjectProjection } from '@/types/project';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const projection = defineModel<ProjectProjection>({ required: true });
const { t } = useI18n();
const options = computed(() => [
  { title: t('project.projection.mercator'), value: 'mercator' },
  { title: t('project.projection.geodesic'), value: 'geodesic' },
]);
</script>
