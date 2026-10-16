<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import {
  coastlines,
  coordinates,
  countryCode,
  gridlines,
  project,
} from "../domain/globe";
import type { Server } from "../data/types";
import { online } from "../data/protocol";
import { t, type Source } from "../data/store";
import Stroke from "./Stroke.vue";
const p = defineProps<{ nodes: Array<{ server: Server; source: Source }> }>();
const emit = defineEmits<{ locate: [source: Source, id: string] }>();
const surface = ref<HTMLElement>();
const view = ref({ lon: 100, lat: 25 });
let pauseUntil = 0;
let drag: { x: number; y: number; lon: number; lat: number } | null = null;
let cleanup = () => {};
onMounted(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0,
    previous = 0,
    inView = true;
  const tick = (now: number) => {
    if (document.hidden || reduced.matches || !inView) {
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(tick);
    if (!previous) {
      previous = now;
      return;
    }
    if (now - previous < 50) return;
    const elapsed = Math.min(now - previous, 100);
    previous = now;
    if (drag || now < pauseUntil) return;
    view.value = {
      ...view.value,
      lon: ((view.value.lon + elapsed * 0.006 + 180) % 360) - 180,
    };
  };
  const sync = () => {
    cancelAnimationFrame(frame);
    previous = 0;
    if (!document.hidden && !reduced.matches && inView)
      frame = requestAnimationFrame(tick);
  };
  const observer = new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    sync();
  });
  observer.observe(surface.value!);
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  sync();
  cleanup = () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener("visibilitychange", sync);
    reduced.removeEventListener("change", sync);
  };
});
onBeforeUnmount(() => cleanup());
const land = computed(() => coastlines(view.value)),
  grid = computed(() => gridlines(view.value));
const grouped = computed(() => {
  const groups = new Map<string, typeof p.nodes>();
  for (const n of p.nodes) {
    const c = countryCode(n.server.region || "");
    groups.set(c, [...(groups.get(c) || []), n]);
  }
  return [...groups].flatMap(([c, siblings]) =>
    siblings.map((n, i) => ({
      ...n,
      ll: coordinates(c),
      angle: i * 2.399,
      r: siblings.length > 1 ? Math.min(16, 5 * Math.sqrt(i + 1)) : 0,
    })),
  );
});
const points = computed(() =>
  grouped.value.flatMap((n) => {
    if (!n.ll) return [];
    const q = project(n.ll[0], n.ll[1], view.value);
    return q.visible
      ? [
          {
            ...n,
            x: q.x + Math.cos(n.angle) * n.r,
            y: q.y + Math.sin(n.angle) * n.r,
          },
        ]
      : [];
  }),
);
function down(e: PointerEvent) {
  if ((e.target as Element).closest(".globe-pin")) return;
  pauseUntil = performance.now() + 2000;
  drag = { x: e.clientX, y: e.clientY, ...view.value };
  (e.currentTarget as Element).setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (!drag) return;
  const scale =
    280 / (e.currentTarget as Element).getBoundingClientRect().width;
  view.value = {
    lon:
      ((((drag.lon - (e.clientX - drag.x) * scale * 0.48 + 180) % 360) + 360) %
        360) -
      180,
    lat: Math.max(
      -65,
      Math.min(65, drag.lat + (e.clientY - drag.y) * scale * 0.36),
    ),
  };
}
function focus() {
  pauseUntil = performance.now() + 2000;
}
function up() {
  drag = null;
  pauseUntil = performance.now() + 2000;
}
</script>
<template>
  <div ref="surface" class="node-globe" @focusin="focus">
    <svg
      class="globe-map"
      viewBox="80 10 280 250"
      role="group"
      :aria-label="t('节点地球，可拖动', 'Node globe, drag to rotate')"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
    >
      <Stroke
        d="M220 26 A104 104 0 1 1 220 234 A104 104 0 1 1 220 26"
        fill="#bed5d222"
        color="var(--blue)"
        :roughness="0.9"
        :weight="1.2"
      />
      <Stroke
        v-for="(d, i) in grid"
        :key="`g${i}`"
        :d="d"
        color="#7b9fa155"
        :roughness="0.25"
        :weight="0.55"
      />
      <Stroke
        v-for="(d, i) in land"
        :key="`l${i}`"
        :d="d"
        color="var(--green)"
        :roughness="0.55"
        :weight="0.85"
      />
      <Stroke
        d="M112 239 Q216 257 329 237 M135 247 Q223 253 301 243"
        color="#97896c50"
        :roughness="1.4"
        :weight="1"
      />
      <g
        v-for="n in points"
        :key="`${n.source.index}:${n.server.id}`"
        class="globe-pin"
        role="button"
        tabindex="0"
        :aria-label="`${t('定位卡片', 'Locate card')} ${n.server.name || n.server.id}`"
        @click="emit('locate', n.source, n.server.id)"
        @keydown.enter.prevent="emit('locate', n.source, n.server.id)"
        @keydown.space.prevent="emit('locate', n.source, n.server.id)"
      >
        <title>{{ n.server.name }}</title>
        <circle :cx="n.x" :cy="n.y" r="10" fill="transparent" />
        <Stroke
          :d="`M${n.x} ${n.y - 4} A4 4 0 1 1 ${n.x} ${n.y + 4} A4 4 0 1 1 ${n.x} ${n.y - 4}`"
          :color="online(n.server) ? 'var(--blue)' : 'var(--red)'"
          :fill="online(n.server) ? 'var(--blue)' : 'var(--red)'"
          :roughness="0.7"
          :weight="1"
        />
      </g>
    </svg>
  </div>
</template>
