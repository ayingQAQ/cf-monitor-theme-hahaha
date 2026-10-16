<script setup lang="ts">
import { computed, ref } from "vue";
import type { HistoryRow } from "../data/types";
import { metric, gpus } from "../data/protocol";
import { t, lang } from "../data/store";
import Paper from "./Paper.vue";
import Stroke from "./Stroke.vue";
export interface Series {
  key: string;
  name: string;
  color: string;
}
const p = withDefaults(
  defineProps<{
    title: string;
    rows: HistoryRow[];
    series: Series[];
    unit?: string;
    max?: number;
    mini?: boolean;
  }>(),
  { unit: "" },
);
const hover = ref<number>();
function value(row: HistoryRow, key: string) {
  if (key.startsWith("gpu:"))
    return metric(gpus(row.gpu_info).find((v) => v.id === key.slice(4))?.info);
  if (key.startsWith("disk."))
    return metric(
      (row.disk as Record<string, unknown> | undefined)?.[key.slice(5)],
    );
  return metric(row[key]);
}
const lo = computed(() => p.rows[0]?.timestamp || 0),
  hi = computed(() => p.rows.at(-1)?.timestamp || lo.value + 1);
const maxY = computed(
  () =>
    p.max ||
    Math.max(
      1,
      ...p.rows.flatMap((r) =>
        p.series
          .map((s) => value(r, s.key))
          .filter((v): v is number => typeof v === "number"),
      ),
    ) * 1.12,
);
const x = (ts: number) =>
  56 + ((ts - lo.value) / Math.max(1, hi.value - lo.value)) * 466;
const y = (n: number) => 190 - (Math.max(0, n) / maxY.value) * 154;
const paths = computed(() =>
  p.series.map((s) => {
    let d = "",
      pen = false;
    for (const r of p.rows) {
      const n = value(r, s.key);
      if (typeof n !== "number") {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(r.timestamp).toFixed(1)} ${y(n).toFixed(1)} `;
      pen = true;
    }
    return { ...s, d };
  }),
);
function time(ts: number) {
  return new Date(ts).toLocaleString(lang.value === "zh" ? "zh-CN" : "en-GB", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function move(e: PointerEvent) {
  if (p.mini || !p.rows.length) return;
  const box = (e.currentTarget as SVGElement).getBoundingClientRect();
  const ts =
    lo.value +
    Math.max(
      0,
      Math.min(1, (((e.clientX - box.left) / box.width) * 550 - 56) / 466),
    ) *
      (hi.value - lo.value);
  let closest = 0;
  p.rows.forEach((v, i) => {
    if (Math.abs(v.timestamp - ts) < Math.abs(p.rows[closest].timestamp - ts))
      closest = i;
  });
  hover.value = closest;
}
function label(v: unknown) {
  return v === null
    ? t("超时", "Timeout")
    : typeof v === "number"
      ? `${v.toFixed(3).replace(/\.000$/, "")}${p.unit}`
      : "—";
}
</script>
<template>
  <component
    :is="mini ? 'div' : Paper"
    :class="mini ? 'mini-chart' : 'chart-sheet'"
    :tape="!mini"
    ><div v-if="!mini" class="chart-heading">
      <h3>{{ title }}</h3>
      <span>{{ t("手写记录", "HISTORY") }}</span>
    </div>
    <svg
      v-if="rows.length"
      class="hand-chart"
      viewBox="0 0 550 235"
      role="img"
      :aria-label="title"
      @pointermove="move"
      @pointerleave="hover = undefined"
    >
      <template v-if="!mini">
        <g v-for="i in 5" :key="i">
          <Stroke
            :d="`M56 ${36 + (i - 1) * 38.5} L522 ${36 + (i - 1) * 38.5}`"
            color="#a79c7e38"
            :weight="0.65"
            :roughness="0.4"
          />
          <text x="50" :y="40 + (i - 1) * 38.5" text-anchor="end">
            {{ ((maxY * (5 - i)) / 4).toFixed(maxY < 10 ? 1 : 0) }}{{ unit }}
          </text>
        </g>
        <Stroke
          d="M56 32 L56 191 L523 191"
          color="var(--ink)"
          :roughness="0.6"
          :weight="1.2"
        />
        <text x="56" y="222">{{ time(lo) }}</text>
        <text x="522" y="222" text-anchor="end">{{ time(hi) }}</text>
      </template>
      <Stroke
        v-for="s in paths"
        :key="s.key"
        :d="s.d"
        :color="s.color"
        :weight="1.3"
        :roughness="0.4"
      />
      <line
        v-if="hover !== undefined && !mini"
        :x1="x(rows[hover].timestamp)"
        :x2="x(rows[hover].timestamp)"
        y1="30"
        y2="191"
        stroke="var(--muted)"
        stroke-dasharray="3 4"
      />
    </svg>
    <p v-else class="empty-history">
      {{ t("这段时间还没有记录", "No samples in this range") }}
    </p>
    <div v-if="!mini" class="chart-legend">
      <span v-for="s in series" :key="s.key" :style="{ color: s.color }"
        >{{ s.name
        }}<template v-if="hover !== undefined">
          · {{ label(value(rows[hover], s.key)) }}</template
        ></span
      >
    </div>
    <small v-if="hover !== undefined && !mini">{{
      time(rows[hover].timestamp)
    }}</small></component
  >
</template>
