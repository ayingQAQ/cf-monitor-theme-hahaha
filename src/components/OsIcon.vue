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
const alpine = computed(() => /alpine/i.test(props.os || ""));
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
    <template v-if="alpine">
      <path fill="#0d597f" d="M12 1 22 6v12l-10 5L2 18V6Z" />
      <path
        fill="white"
        d="m4 17 6-10 4 6 2-3 5 7h-4l-1-2-2 2h-3l2-2-3-5-4 7Z"
      />
    </template>
    <g
      v-else
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
