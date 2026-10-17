<script setup lang="ts">
import { computed, ref, shallowRef, watch, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  sources,
  detail,
  leave,
  verificationRevision,
  retryRequest,
  t,
  lang,
  failure,
} from "../data/store";
import {
  HOURS,
  allowedRange,
  bytesMB,
  quantity,
  metric,
  formatLoss,
  gpus,
  diskIO,
  appendLiveHistory,
} from "../data/protocol";
import type { HistoryRow, Server, Sample } from "../data/types";
import InkButton from "../components/InkButton.vue";
import Paper from "../components/Paper.vue";
import Chart, { type Series } from "../components/Chart.vue";
import Flag from "../components/Flag.vue";
import Status from "../components/Status.vue";
import Scribble from "../components/Scribble.vue";
const route = useRoute(),
  router = useRouter();
const source = computed(() => {
  const n = Number(route.query.apiIndex || 0);
  return Number.isInteger(n) && n >= 0 ? sources[n] : undefined;
});
const id = computed(() => String(route.params.id || ""));
const server = computed(
  () =>
    source.value?.details.get(id.value) ||
    source.value?.servers.find((v) => v.id === id.value),
);
const rows = shallowRef<HistoryRow[]>([]),
  hours = ref(0.167),
  shownHours = ref(0.167),
  tab = ref("resource"),
  loading = ref(false),
  error = ref(""),
  loginNeeded = ref(false);
let sequence = 0,
  timer: ReturnType<typeof setTimeout> | undefined,
  pending: Sample[] = [];
function live(v: Server, samples: Sample[]) {
  const cutoff = Date.now() - hours.value * 3600000;
  pending.push(...samples.filter((s) => s.ts >= cutoff));
  if (timer || !pending.length) return;
  timer = setTimeout(() => {
    timer = undefined;
    if (loading.value) {
      pending = [];
      return;
    }
    const max = Math.max(
      60,
      Math.min(240, Number(source.value?.config?.long_history_points) || 120),
    );
    rows.value = appendLiveHistory(rows.value, pending, cutoff, max);
    pending = [];
  }, 1000);
}
async function history() {
  const s = source.value;
  if (!s) return;
  const seq = ++sequence;
  loading.value = true;
  error.value = "";
  try {
    const result = await s.client.history(id.value, hours.value);
    if (seq !== sequence) return;
    rows.value = result;
    shownHours.value = hours.value;
  } catch (e) {
    if (seq === sequence) {
      error.value = e instanceof Error ? e.message : String(e);
      failure(s, e);
    }
  } finally {
    if (seq === sequence) loading.value = false;
  }
}
async function load(refresh = false) {
  const s = source.value;
  if (!s) return;
  const requestedId = id.value;
  await detail(s, requestedId, refresh, live);
  if (source.value !== s || id.value !== requestedId) return;
  if (
    s.config &&
    !s.needsVerification &&
    !s.error &&
    (!refresh || !rows.value.length)
  )
    await history();
}

function choose(h: number) {
  if (!source.value) return;
  if (!allowedRange(h, source.value.client.authenticated)) {
    loginNeeded.value = true;
    return;
  }
  loginNeeded.value = false;
  hours.value = h;
  void history();
}
function range(h: number) {
  if (h === 0.167) return t("10 分钟", "10 min");
  if (h === 0.5) return t("30 分钟", "30 min");
  return h < 24 ? `${h} ${t("小时", "hours")}` : `${h / 24} ${t("天", "days")}`;
}
const palette = [
  "var(--blue)",
  "var(--green)",
  "var(--ochre)",
  "var(--red)",
  "#937b9a",
  "#538b87",
  "#a49159",
  "#8e95a7",
];
const probes = computed(() =>
  ["ct", "cu", "cm", "bd", "node_1", "node_2", "node_3", "node_4"]
    .filter(
      (k) =>
        metric(server.value?.[`ping_${k}`]) !== undefined ||
        metric(server.value?.[`loss_${k}`]) !== undefined ||
        rows.value.some(
          (r) =>
            metric(r[`ping_${k}`]) !== undefined ||
            metric(r[`loss_${k}`]) !== undefined,
        ),
    )
    .map((key, i) => ({
      key,
      name: String(
        source.value?.config?.[
          key.startsWith("node_") ? `${key}_name` : `custom_${key}_name`
        ] || key.toUpperCase(),
      ),
      color: palette[i],
    })),
);
const probeSeries = (prefix: string): Series[] =>
  probes.value
    .filter((p) =>
      rows.value.some((r) => metric(r[`${prefix}_${p.key}`]) !== undefined),
    )
    .map((p) => ({ ...p, key: `${prefix}_${p.key}` }));
const resource = computed(() =>
  rows.value.map((r) => ({
    ...r,
    ram_used: typeof r.ram_used === "number" ? r.ram_used / 1024 : undefined,
    disk_used: typeof r.disk_used === "number" ? r.disk_used / 1024 : undefined,
    net_in_speed:
      typeof r.net_in_speed === "number" ? r.net_in_speed / 1024 : undefined,
    net_out_speed:
      typeof r.net_out_speed === "number" ? r.net_out_speed / 1024 : undefined,
  })),
);
const gpu = computed(() => {
  const all = new Map<string, string>();
  for (const r of [...rows.value, ...(server.value ? [server.value] : [])])
    for (const g of gpus(r.gpu_info)) all.set(g.id, g.name);
  return [...all].map(([id, name], i) => ({
    key: `gpu:${id}`,
    name,
    color: palette[i % palette.length],
  }));
});
const hasIO = computed(
  () =>
    Boolean(diskIO(server.value?.disk)) ||
    rows.value.some((r) => diskIO(r.disk)),
);
const basic = (key: string, name: string, color = palette[0]): Series => ({
  key,
  name,
  color,
});
function latest(key: string) {
  const v = server.value?.[key];
  if (metric(v) !== undefined) return v;
  for (let i = rows.value.length - 1; i >= 0; i--) {
    if (metric(rows.value[i][key]) !== undefined) return rows.value[i][key];
  }
}
const resume = () => {
  if (document.hidden) leave();
  else void load(true);
};
document.addEventListener("visibilitychange", resume);
watch(
  () => [route.params.id, route.query.apiIndex],
  () => {
    ++sequence;
    clearTimeout(timer);
    timer = undefined;
    loading.value = false;
    error.value = "";
    pending = [];
    rows.value = [];
    hours.value = 0.167;
    shownHours.value = 0.167;
    tab.value = "resource";
    void load();
  },
  { immediate: true },
);
watch(verificationRevision, () => load());
watch(retryRequest, (r) => {
  if (r?.index === source.value?.index) void load(true);
});
onBeforeUnmount(() => {
  ++sequence;
  leave();
  clearTimeout(timer);
  pending = [];
  document.removeEventListener("visibilitychange", resume);
});
</script>
<template>
  <div class="detail-navigation">
    <InkButton @click="router.push('/')"
      >← {{ t("返回记录簿", "Back to nodes") }}</InkButton
    >
    <div class="detail-tabs">
      <InkButton :selected="tab === 'resource'" @click="tab = 'resource'">{{
        t("资源手记", "Resources")
      }}</InkButton
      ><InkButton :selected="tab === 'latency'" @click="tab = 'latency'">{{
        t("延迟探测", "Latency")
      }}</InkButton>
    </div>
  </div>
  <p v-if="!source" role="alert">
    {{ t("后端来源无效", "Invalid backend source") }}
  </p>
  <template v-else
    ><Paper v-if="server" class="detail-intro" color="yellow" tape
      ><div>
        <Flag :code="server.region" :client="source.client" />
        <h2>{{ server.name || server.id }}</h2>
        <Status :server="server" />
      </div>
      <Scribble color="var(--ochre)" />
      <p>
        {{ t("这一页，记下它的运行故事。", "A page for its running story.") }}
      </p>
      <div class="detail-facts">
        <span>{{ server.os || "—" }}</span
        ><span
          >{{ server.cpu_cores || "—" }} {{ t("核", "cores") }} /
          {{ server.cpu_info || "—" }}</span
        ><span
          >{{ t("内存", "Memory") }} {{ quantity(bytesMB(server.ram_total)) }} ·
          {{ t("磁盘", "Disk") }}
          {{ quantity(bytesMB(server.disk_total)) }}</span
        >
      </div></Paper
    >
    <div class="detail-controls">
      <div class="ranges">
        <InkButton
          v-for="h in HOURS"
          :key="h"
          :selected="hours === h"
          @click="choose(h)"
          >{{ range(h) }}</InkButton
        >
      </div>
    </div>
    <Paper v-if="loginNeeded" class="message"
      ><p>
        {{
          t(
            "超过 24 小时的记录需要登录内置后台。",
            "Log into the built-in admin for history beyond 24 hours.",
          )
        }}
      </p>
      <a :href="source.client.adminURL"
        >{{ t("前往登录", "Open login") }} →</a
      ></Paper
    >
    <p
      class="range-loading"
      :class="{ 'is-loading': loading }"
      role="status"
      :aria-hidden="!loading"
    >
      {{ t("正在翻阅", "Loading") }} {{ range(hours) }}…
      <span v-if="rows.length"
        >{{ t("当前仍显示", "Still showing") }} {{ range(shownHours) }}</span
      >
    </p>
    <Paper v-if="error" class="message"
      ><p role="alert">{{ error }}</p>
      <InkButton @click="history">{{
        t("重试历史查询", "Retry history")
      }}</InkButton></Paper
    >
    <div v-if="tab === 'resource'" class="chart-grid">
      <Chart
        :title="t('CPU 的忙碌程度', 'CPU activity')"
        :rows="rows"
        :series="[basic('cpu', 'CPU')]"
        :max="100"
        unit="%"
      /><Chart
        :title="t('内存与磁盘', 'Memory & disk')"
        :rows="resource"
        :series="[
          basic('ram_used', t('内存', 'Memory'), palette[1]),
          basic('disk_used', t('磁盘', 'Disk'), palette[2]),
        ]"
        unit=" GB"
      /><Chart
        :title="t('网速的来来往往', 'Network traffic')"
        :rows="resource"
        :series="[
          basic('net_in_speed', t('下载', 'Download')),
          basic('net_out_speed', t('上传', 'Upload'), palette[1]),
        ]"
        unit=" KB/s"
      /><Chart
        v-if="gpu.length"
        title="GPU"
        :rows="rows"
        :series="gpu"
        :max="100"
        unit="%"
      /><template v-if="hasIO"
        ><Chart
          :title="t('磁盘读写', 'Disk throughput')"
          :rows="rows"
          :series="[
            basic('disk.read_bps', t('读取', 'Read')),
            basic('disk.write_bps', t('写入', 'Write'), palette[1]),
          ]"
          unit=" B/s" /><Chart
          title="IOPS"
          :rows="rows"
          :series="[
            basic('disk.read_iops', t('读取', 'Read')),
            basic('disk.write_iops', t('写入', 'Write'), palette[1]),
          ]" /><Chart
          :title="t('磁盘等待', 'Disk await')"
          :rows="rows"
          :series="[basic('disk.await_ms', t('等待', 'Await'))]"
          unit=" ms" /><Chart
          :title="t('磁盘繁忙度', 'Disk utilization')"
          :rows="rows"
          :series="[basic('disk.util', t('繁忙度', 'Utilization'))]"
          :max="100"
          unit="%"
      /></template>
    </div>
    <template v-else
      ><div class="chart-grid">
        <Chart
          :title="t('延迟，远方的回音', 'Latency, echoes from afar')"
          :rows="rows"
          :series="probeSeries('ping')"
          unit=" ms"
        /><Chart
          :title="t('这段时间的丢包率', 'Packet loss')"
          :rows="rows"
          :series="probeSeries('loss')"
          unit="%"
          :max="100"
        />
      </div>
      <Paper class="loss-note" color="blue"
        ><h3>{{ t("当前探测", "Latest probes") }}</h3>
        <div class="probe-values">
          <span v-for="p in probes" :key="p.key" :style="{ color: p.color }"
            >{{ p.name }} ·
            {{
              latest(`ping_${p.key}`) === null
                ? t("超时", "Timeout")
                : metric(latest(`ping_${p.key}`)) === undefined
                  ? "—"
                  : `${latest(`ping_${p.key}`)} ms`
            }}
            ·
            {{
              formatLoss(latest(`loss_${p.key}`), t("超时", "Timeout"))
            }}</span
          ><span v-if="!probes.length">{{
            t("没有配置探测目标", "No probes configured")
          }}</span>
        </div></Paper
      ></template
    ></template
  >
</template>
