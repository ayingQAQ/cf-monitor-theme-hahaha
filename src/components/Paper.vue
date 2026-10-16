<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, useId } from "vue";
import { tornContour } from "../domain/paper";
import grain from "../assets/paper-grain.svg";
const p = withDefaults(
  defineProps<{ color?: string; seed?: number; tape?: boolean }>(),
  { color: "cream", seed: 13 },
);
const root = ref<HTMLElement>(),
  width = ref(0),
  height = ref(0),
  id = useId().replace(/:/g, "");
let observer: ResizeObserver;
onMounted(() => {
  observer = new ResizeObserver(() => {
    if (root.value) {
      width.value = root.value.clientWidth;
      height.value = root.value.clientHeight;
    }
  });
  observer.observe(root.value!);
});
onBeforeUnmount(() => observer?.disconnect());
const d = computed(() => tornContour(width.value, height.value, p.seed));
</script>
<template>
  <div ref="root" class="paper-sheet" :class="`sheet-${color}`">
    <svg
      class="paper-surface"
      width="100%"
      height="100%"
      :viewBox="`0 0 ${width || 1} ${height || 1}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          :id="`grain-${id}`"
          width="128"
          height="128"
          patternUnits="userSpaceOnUse"
        >
          <image :href="grain" width="128" height="128" />
        </pattern>
      </defs>
      <g v-if="width">
        <path :d="d" fill="var(--sheet)" stroke="#9b8e7238" stroke-width=".7" />
        <path
          :d="d"
          :fill="`url(#grain-${id})`"
          style="mix-blend-mode: multiply"
        />
        <path
          :d="`M${width - 24} 5 L${width - 24} 24 L${width - 5} 24 Z`"
          fill="#b9a57e"
          opacity=".32"
        />
        <path
          :d="`M10 ${height * 0.64} Q${width * 0.4} ${height * 0.68} ${width - 9} ${height * 0.59}`"
          fill="none"
          stroke="#baae9238"
          stroke-width="2"
        />
      </g></svg
    ><span v-if="tape" class="paper-tape" aria-hidden="true" />
    <div class="paper-content"><slot /></div>
  </div>
</template>
