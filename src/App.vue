<script setup lang="ts">
import { computed, watchEffect, onMounted, onBeforeUnmount, ref } from "vue";
import { useRoute } from "vue-router";
import { sources, config, lang, t, requestRetry } from "./data/store";
import { startClock } from "./data/clock";
import Paper from "./components/Paper.vue";
import InkButton from "./components/InkButton.vue";
import Turnstile from "./components/Turnstile.vue";
import logo from "./assets/favicon.svg";
const route = useRoute(),
  systemDark = ref(matchMedia("(prefers-color-scheme: dark)").matches);
const media = matchMedia("(prefers-color-scheme: dark)");
const sync = () => (systemDark.value = media.matches);
let stopClock = () => {};
onMounted(() => {
  media.addEventListener("change", sync);
  stopClock = startClock();
});
onBeforeUnmount(() => {
  media.removeEventListener("change", sync);
  stopClock();
});
const dark = computed(
  () =>
    config.value?.preferred_theme === "dark" ||
    (config.value?.preferred_theme !== "light" && systemDark.value),
);
const title = computed(
  () => config.value?.site_title || document.title || "hahaha",
);
const notice = computed(() =>
  typeof config.value?.theme_options?.notice === "string"
    ? config.value.theme_options.notice
    : "",
);
const ink = computed(() =>
  ["blue", "green", "orange"].includes(String(config.value?.theme_options?.ink))
    ? String(config.value?.theme_options?.ink)
    : "blue",
);
const icon =
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href || logo;
watchEffect(() => {
  document.documentElement.dataset.theme = dark.value ? "dark" : "light";
  document.documentElement.lang = lang.value === "zh" ? "zh-CN" : "en";
  if (config.value?.site_title) document.title = config.value.site_title;
});
const activeSources = computed(() =>
  route.path.startsWith("/server/")
    ? sources.filter((s) => s.index === Number(route.query.apiIndex || 0))
    : sources,
);
function retry(index: number, continued = false) {
  requestRetry(index, continued);
}
</script>
<template>
  <div class="desk" :data-ink="ink">
    <svg class="effect-defs" aria-hidden="true">
      <defs>
        <filter id="flag-warp">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".035"
            numOctaves="1"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
    <main class="workbook">
      <header class="masthead">
        <RouterLink to="/" class="site-brand"
          ><img class="brand-doodle" :src="icon" alt="" /><span
            >{{ title }}<small>a little server scrapbook</small></span
          ></RouterLink
        >
        <nav>
          <template v-for="s in sources" :key="s.index"
            ><a :href="s.client.adminURL"
              ><InkButton
                >{{ t("管理入口", "Admin")
                }}{{ sources.length > 1 ? ` ${s.index + 1}` : "" }} →</InkButton
              ></a
            ></template
          >
        </nav>
      </header>
      <Paper v-if="notice" class="announcement" color="yellow"
        ><p>{{ notice }}</p></Paper
      >
      <section v-for="s in activeSources" :key="s.index" class="source-status">
        <Turnstile
          v-if="s.needsVerification && s.config?.turnstile_enabled === true"
          :key="s.client.verificationKey"
          :source="s"
        /><Paper v-if="s.error && !s.needsVerification" class="message"
          ><p role="alert">
            {{ t("数据源", "Source") }} {{ s.index + 1 }}: {{ s.error }}
          </p>
          <InkButton @click="retry(s.index)">{{
            t("手动重试", "Retry")
          }}</InkButton
          ><a :href="s.client.adminURL"
            >{{ t("内置后台", "Built-in admin") }} →</a
          ></Paper
        >
        <div
          v-if="
            s.status === 'expired' ||
            s.status === 'stopped' ||
            s.status === 'retrying'
          "
          class="connection-note"
          role="status"
        >
          <span>{{
            s.status === "expired"
              ? t(
                  "实时连接已到时，保留最后记录。",
                  "Live session expired. Showing the last snapshot.",
                )
              : s.status === "stopped"
                ? t(
                    "实时连接已停止，保留最后记录。",
                    "Live connection stopped. Showing the last snapshot.",
                  )
                : t(
                    "实时连接断开，正在退避重连…",
                    "Connection lost, retrying with backoff…",
                  )
          }}</span
          ><InkButton
            v-if="s.status !== 'retrying'"
            @click="retry(s.index, true)"
            >{{ t("继续连接", "Continue live") }}</InkButton
          >
        </div>
      </section>
      <RouterView />
      <footer class="cf-footer">
        <span>hahaha · 0.1.0</span
        ><a
          href="https://github.com/huilang-me/CF-Server-Monitor/"
          target="_blank"
          rel="noopener"
          >Powered by CF-Server-Monitor
          <template v-for="s in sources" :key="s.index">{{
            s.config?.version ? ` · v${s.config.version}` : ""
          }}</template></a
        >
      </footer>
    </main>
  </div>
</template>
