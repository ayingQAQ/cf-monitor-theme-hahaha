<script setup lang="ts">
import { clock } from "../data/clock";
import type { Server } from "../data/types";
import { online } from "../data/protocol";
import { t } from "../data/store";
import Stroke from "./Stroke.vue";
defineProps<{ server: Server }>();
</script>
<template>
  <span
    class="status-stamp"
    :class="online(server, clock) ? 'online' : 'offline'"
    ><svg viewBox="0 0 130 32" aria-hidden="true">
      <Stroke
        d="M7 6 Q60 2 124 5 L122 26 Q69 29 7 26 Z"
        color="currentColor"
        :roughness="1.7"
        :weight="1.1"
      /></svg
    >{{
      online(server, clock) ? t("在线", "Online") : t("离线", "Offline")
    }}</span
  >
</template>
