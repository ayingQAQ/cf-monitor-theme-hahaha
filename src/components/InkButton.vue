<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";
import "wired-elements/lib/wired-button.js";
const p = defineProps<{
  selected?: boolean;
  label?: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ click: [] }>();
const el = ref<HTMLElement & { updateComplete: Promise<unknown> }>();
async function sync() {
  await nextTick();
  await el.value?.updateComplete;
  const b = el.value?.shadowRoot?.querySelector("button");
  b?.setAttribute("aria-pressed", String(!!p.selected));
  if (p.label) b?.setAttribute("aria-label", p.label);
}
onMounted(sync);
watch(() => [p.selected, p.label], sync);
</script>
<template>
  <wired-button
    ref="el"
    class="ink-button"
    elevation="2"
    :data-selected="selected ? 'true' : 'false'"
    :disabled="disabled || undefined"
    @click="!disabled && emit('click')"
    ><slot
  /></wired-button>
</template>
