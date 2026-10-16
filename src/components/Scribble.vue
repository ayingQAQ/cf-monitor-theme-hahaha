<script setup lang="ts">
import Stroke from "./Stroke.vue";
withDefaults(defineProps<{ color?: string }>(), { color: "var(--blue)" });
</script>
<template>
  <svg
    class="scribble"
    viewBox="0 0 260 18"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <Stroke
      d="M3 8 Q82 15 251 6 M14 13 Q149 6 255 12"
      :color="color"
      :roughness="1.9"
      :weight="1.4"
    />
  </svg>
</template>
