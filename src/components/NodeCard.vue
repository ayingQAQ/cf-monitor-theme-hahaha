<script setup lang="ts">
import { clock } from "../data/clock";
import { computed } from "vue";
import { useRouter } from "vue-router";
import type { Server } from "../data/types";
import { t, lang, type Source } from "../data/store";
import {
  bytesMB,
  quantity,
  percentage,
  online,
  gpus,
  diskIO,
} from "../data/protocol";
import {
  traffic,
  trafficLimit,
  price,
  expiry,
  duration,
} from "../domain/format";
import Paper from "./Paper.vue";
import Flag from "./Flag.vue";
import Status from "./Status.vue";
import Icon from "./Icon.vue";
import Meter from "./Meter.vue";
import Scribble from "./Scribble.vue";
import OsIcon from "./OsIcon.vue";
const p = defineProps<{ server: Server; source: Source; index: number }>();
const router = useRouter();
const isOnline = computed(() => online(p.server, clock.value));
const open = () =>
  router.push({
    path: `/server/${encodeURIComponent(p.server.id)}`,
    query: { apiIndex: p.source.index },
  });
const metrics = computed(() => [
  {
    label: "CPU",
    value: p.server.cpu,
    text:
      typeof p.server.cpu === "number" ? `${p.server.cpu.toFixed(1)} %` : "—",
    color: "var(--blue)",
  },
  {
    label: t("内存", "Memory"),
    value: percentage(p.server.ram_used, p.server.ram_total),
    text: `${quantity(bytesMB(p.server.ram_used))} / ${quantity(bytesMB(p.server.ram_total))}`,
    color: "var(--green)",
  },
  {
    label: t("磁盘", "Disk"),
    value: percentage(p.server.disk_used, p.server.disk_total),
    text: `${quantity(bytesMB(p.server.disk_used))} / ${quantity(bytesMB(p.server.disk_total))}`,
    color: "var(--ochre)",
  },
]);
const gpu = computed(() => gpus(p.server.gpu_info)),
  io = computed(() => diskIO(p.server.disk));
</script>
<template>
  <Paper
    class="node-card"
    :class="`card-${index % 4} ${isOnline ? 'online' : 'offline'}`"
    :color="isOnline ? ['cream', 'pink', 'cream', 'mint'][index % 4] : 'grey'"
    :seed="index * 11 + 3"
    :tape="index % 3 !== 1"
    ><div class="card-top">
      <span class="folio">NO. {{ String(index + 1).padStart(2, "0") }}</span
      ><Flag :code="server.region" :client="source.client" /><Status
        :server="server"
      />
    </div>
    <button class="node-title" @click="open">
      {{ server.name || server.id }}<Icon name="arrow" :size="23" /></button
    ><Scribble
      :color="
        ['var(--blue)', 'var(--red)', 'var(--ochre)', 'var(--green)'][index % 4]
      "
    />
    <div class="node-subtitle">
      <OsIcon :os="server.os" :client="source.client" />{{
        server.server_group || t("未分组", "Ungrouped")
      }}
      /
      {{ server.os || t("系统未知", "Unknown OS") }}
    </div>
    <div class="card-metrics">
      <div v-for="m in metrics" :key="m.label" class="metric">
        <div>
          <span>{{ m.label }}</span
          ><strong :style="{ color: m.color }">{{ m.text }}</strong>
        </div>
        <Meter :value="m.value" :color="m.color" />
      </div>
      <div v-for="g in gpu" :key="g.id" class="metric">
        <div>
          <span>{{ g.name }}</span
          ><strong>{{ g.info }} %</strong>
        </div>
        <Meter :value="g.info" />
      </div>
    </div>
    <div class="speed-note">
      <span
        ><Icon name="down" :size="19" />{{
          quantity(server.net_in_speed, "B/s")
        }}</span
      ><span
        ><Icon name="up" :size="19" />{{
          quantity(server.net_out_speed, "B/s")
        }}</span
      >
    </div>
    <div v-if="io" class="io-note">
      IO ↓ {{ quantity(io.read_bps, "B/s") }} · ↑
      {{ quantity(io.write_bps, "B/s") }}
    </div>
    <template v-if="source.sys.show_tf !== false"
      ><div class="traffic-note">
        <span>{{ t("本月已用", "Monthly traffic") }}</span
        ><strong
          >{{ quantity(traffic(server)) }} /
          {{
            trafficLimit(server)
              ? quantity(trafficLimit(server))
              : t("不限量", "Unlimited")
          }}</strong
        >
      </div>
      <Meter
        :value="
          trafficLimit(server)
            ? (traffic(server) / trafficLimit(server)) * 100
            : null
        "
        color="var(--red)"
    /></template>
    <div class="billing-note">
      <span v-if="source.sys.show_price !== false">{{
        price(server, lang === "zh")
      }}</span
      ><span v-if="source.sys.show_expire !== false">{{
        expiry(server, lang === "zh")
      }}</span>
    </div>
    <div class="card-tail">
      <span
        >{{ t("连续运行", "Uptime") }}
        {{
          duration(Date.now() - Number(server.boot_time), lang === "zh")
        }}</span
      ><button class="turn-page" @click="open">
        {{ t("翻页", "Open") }} ↗
      </button>
    </div></Paper
  >
</template>
