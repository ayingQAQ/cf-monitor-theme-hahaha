<script setup lang="ts">
import Stroke from "./Stroke.vue";
import { icons } from "../domain/icons";
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 24 });
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    class="ink-icon"
    aria-hidden="true"
  >
    <Stroke :d="icons[name] || icons.server" :roughness="0.9" />
  </svg>
</template>
