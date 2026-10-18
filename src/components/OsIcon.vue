<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Client } from "../data/client";
import { osIcon } from "../domain/format";
const props = defineProps<{ os?: string; client: Client }>();
const failed = ref(false);
const url = computed(() => {
  const path = osIcon(props.os);
  return path ? props.client.asset(path) : "";
});
watch(url, () => (failed.value = false));
</script>
<template>
  <img
    v-if="url && !failed"
    class="os-icon"
    :src="url"
    alt=""
    @error="failed = true"
  />
  <svg v-else class="os-icon" viewBox="0 0 24 24" aria-hidden="true">
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 4h18v13H3zM8 21h8m-4-4v4M7 8l3 3-3 3m6 0h4" />
    </g>
  </svg>
</template>
