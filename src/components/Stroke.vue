<script setup lang="ts">
import { computed } from "vue";
import rough from "roughjs";
const p = withDefaults(
  defineProps<{
    d: string;
    color?: string;
    fill?: string;
    seed?: number;
    weight?: number;
    roughness?: number;
  }>(),
  { color: "currentColor", seed: 29, weight: 1.5, roughness: 1.4 },
);
const gen = rough.generator();
const paths = computed(() => {
  const shape = gen.path(p.d, {
    seed: p.seed,
    roughness: p.roughness,
    bowing: 1,
    stroke: p.color,
    strokeWidth: p.weight,
    fill: p.fill,
    fillStyle: "hachure",
    hachureGap: 3.8,
    fillWeight: 1.3,
  });
  for (const set of shape.sets)
    for (const op of set.ops)
      for (let i = 0; i < op.data.length; i++)
        op.data[i] = Math.round(op.data[i] * 100) / 100;
  return gen.toPaths(shape);
});
</script>
<template>
  <path
    v-for="(s, i) in paths"
    :key="i"
    :d="s.d"
    :fill="s.fill"
    :stroke="s.stroke"
    :stroke-width="s.strokeWidth"
  />
</template>
