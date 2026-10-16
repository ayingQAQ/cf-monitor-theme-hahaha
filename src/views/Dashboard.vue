<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
} from "vue";
import {
  dashboard,
  leave,
  sources,
  allServers,
  verificationRevision,
  retryRequest,
  t,
  type Source,
} from "../data/store";
import { quantity } from "../data/protocol";
import Globe from "../components/Globe.vue";
import Paper from "../components/Paper.vue";
import NodeCard from "../components/NodeCard.vue";
import InkButton from "../components/InkButton.vue";
import Scribble from "../components/Scribble.vue";
import Icon from "../components/Icon.vue";
const search = ref(""),
  country = ref(""),
  group = ref("");
const countries = computed(() => [
  ...new Set(
    allServers.value.map((v) => v.server.region?.toUpperCase()).filter(Boolean),
  ),
]);
const groups = computed(() => [
  ...new Set(
    allServers.value.map((v) => v.server.server_group || "").filter(Boolean),
  ),
]);
const visible = computed(() =>
  allServers.value.filter(
    (v) =>
      (!country.value || v.server.region?.toUpperCase() === country.value) &&
      (!group.value || v.server.server_group === group.value) &&
      `${v.server.name} ${v.server.os} ${v.server.tags} ${v.server.server_group}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  ),
);
const stats = computed(() =>
  sources.reduce(
    (a, s) => ({
      total: a.total + (s.stats?.total || 0),
      online: a.online + (s.stats?.online || 0),
      traffic:
        a.traffic + (s.stats?.globalNetTx || 0) + (s.stats?.globalNetRx || 0),
      speedIn: a.speedIn + (s.stats?.globalSpeedIn || 0),
      speedOut: a.speedOut + (s.stats?.globalSpeedOut || 0),
    }),
    { total: 0, online: 0, traffic: 0, speedIn: 0, speedOut: 0 },
  ),
);
const cardId = (s: Source, id: string) =>
  `card-${s.index}-${encodeURIComponent(id)}`;
async function locate(s: Source, id: string) {
  country.value = "";
  group.value = "";
  search.value = "";
  await nextTick();
  const card = document.getElementById(cardId(s, id));
  card?.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "center",
  });
  card?.focus({ preventScroll: true });
}
const resume = () => {
  if (document.hidden) leave();
  else void dashboard(true);
};
onMounted(() => {
  void dashboard();
  document.addEventListener("visibilitychange", resume);
});
onBeforeUnmount(() => {
  leave();
  document.removeEventListener("visibilitychange", resume);
});
watch(verificationRevision, () => dashboard());
watch(retryRequest, (r) => {
  if (r) void dashboard(true, r.index);
});
</script>
<template>
  <section class="opening">
    <Globe :nodes="allServers" @locate="locate" />
    <div class="summary-stack">
      <Paper class="online-note" color="yellow" tape
        ><h2>{{ t("此刻，在线的朋友", "Friends online, right now") }}</h2>
        <div class="online-count">
          <strong>{{ stats.online }}</strong
          ><span>/ {{ stats.total }} {{ t("台", "nodes") }}</span
          ><Icon name="sun" :size="40" />
        </div>
        <Scribble color="var(--green)" />
        <p>
          {{ stats.total - stats.online }}
          {{ t("台离线，正在等它们回来", "offline, waiting for their return") }}
        </p></Paper
      ><Paper class="traffic-summary" color="blue"
        ><h2>{{ t("这个月，走过的流量", "Traffic, this month") }}</h2>
        <strong>{{ quantity(stats.traffic) }}</strong>
        <p>
          ↓ {{ quantity(stats.speedIn, "B/s") }} · ↑
          {{ quantity(stats.speedOut, "B/s") }}
        </p>
        <small>{{
          t("数字来自 CF-Server-Monitor", "From CF-Server-Monitor")
        }}</small></Paper
      >
    </div>
  </section>
  <section class="node-section">
    <div class="filters-row">
      <div class="globe-regions">
        <InkButton :selected="!country" @click="country = ''">{{
          t("全部地区", "All regions")
        }}</InkButton
        ><InkButton
          v-for="c in countries"
          :key="c"
          :selected="country === c"
          @click="country = country === c ? '' : c!"
          >{{ c }} ·
          {{
            allServers.filter((v) => v.server.region?.toUpperCase() === c)
              .length
          }}</InkButton
        >
      </div>
      <label class="search-note"
        ><Icon name="search" /><input
          v-model="search"
          class="cf-search"
          :aria-label="t('搜索节点', 'Search nodes')"
          :placeholder="t('找找哪一台…', 'Find a node…')"
      /></label>
    </div>
    <div v-if="groups.length > 1" class="group-filters">
      <InkButton :selected="!group" @click="group = ''">{{
        t("全部记录", "All groups")
      }}</InkButton
      ><InkButton
        v-for="g in groups"
        :key="g"
        :selected="group === g"
        @click="group = group === g ? '' : g"
        >{{ g }}</InkButton
      >
    </div>
    <div class="node-grid">
      <div
        v-for="(item, i) in visible"
        :id="cardId(item.source, item.server.id)"
        :key="`${item.source.index}:${item.server.id}`"
        tabindex="-1"
      >
        <NodeCard :server="item.server" :source="item.source" :index="i" />
      </div>
    </div>
    <Paper v-if="!visible.length" class="message"
      ><p>
        {{
          sources.some((s) => s.loading)
            ? t("正在翻开记录簿…", "Opening the scrapbook…")
            : t("这里还没有节点", "No matching nodes")
        }}
      </p></Paper
    >
  </section>
</template>
