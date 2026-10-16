<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Client } from "../data/client";
import Icon from "./Icon.vue";
import Stroke from "./Stroke.vue";
const p = defineProps<{ code?: string; client: Client }>();
const failed = ref(false);
const code = computed(() => (p.code || "").toLowerCase().replace(/^uk$/, "gb"));
watch(code, () => (failed.value = false));
</script>
<template>
  <span class="country-note cf-flag" :title="code.toUpperCase() || '—'"
    ><template
      v-if="/^[a-z]{2}(?:-(?:eng|sct|wls|nir))?$/.test(code) && !failed"
      ><img
        :src="client.asset(`flags/${code}.svg`)"
        :alt="code.toUpperCase()"
        width="42"
        height="30"
        @error="failed = true" /><svg viewBox="0 0 48 36" aria-hidden="true">
        <Stroke
          d="M3 3 L45 2 L46 33 L2 32 Z"
          :roughness="1.1"
          :weight="1"
        /></svg></template
    ><template v-else
      ><Icon name="globe" /><span>{{
        code.toUpperCase() || "—"
      }}</span></template
    ></span
  >
</template>
