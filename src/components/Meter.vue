<script setup lang="ts">
import { computed } from "vue";
import Stroke from "./Stroke.vue";
const p = withDefaults(
  defineProps<{ value?: number | null; color?: string }>(),
  { color: "var(--blue)" },
);
const amount = computed(() =>
  typeof p.value === "number" && Number.isFinite(p.value)
    ? Math.max(0, Math.min(100, p.value))
    : 0,
);
</script>
<template>
  <svg
    class="pencil-meter"
    viewBox="0 0 280 22"
    preserveAspectRatio="none"
    role="img"
    :aria-label="value == null ? '—' : `${value.toFixed(1)}%`"
  >
    <Stroke
      d="M4 5 Q140 3 275 6 L276 17 Q150 16 4 19 Z"
      color="#948c7666"
      :roughness="1"
    />
    <Stroke
      v-if="amount > 0"
      :d="`M5 6 L${5 + amount * 2.68} 5 L${5 + amount * 2.68} 17 L5 18 Z`"
      :fill="color"
      :color="color"
      :roughness="1.25"
    />
  </svg>
</template>
