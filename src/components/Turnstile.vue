<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { verified, t, type Source } from "../data/store";
import InkButton from "./InkButton.vue";
const p = defineProps<{ source: Source }>();
const root = ref<HTMLElement>(),
  error = ref("");
let widget: string | undefined,
  disposed = false;
interface TurnstileAPI {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
const api = () => (window as unknown as { turnstile?: TurnstileAPI }).turnstile;
async function load() {
  error.value = "";
  try {
    if (!api())
      await new Promise<void>((resolve, reject) => {
        let script = document.querySelector<HTMLScriptElement>(
          "script[data-cf-turnstile]",
        );
        if (!script) {
          script = document.createElement("script");
          script.dataset.cfTurnstile = "true";
          script.src =
            "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          document.head.append(script);
        }
        const timeout = setTimeout(
          () => reject(new Error("Turnstile load timeout")),
          20000,
        );
        script.addEventListener(
          "load",
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
        script.addEventListener(
          "error",
          () => {
            clearTimeout(timeout);
            script?.remove();
            reject(new Error("Turnstile load failed"));
          },
          { once: true },
        );
      });
    if (disposed || !root.value) return;
    if (widget) api()?.remove(widget);
    widget = api()?.render(root.value, {
      sitekey: p.source.config?.turnstile_site_key,
      theme: "auto",
      callback: async (token: string) => {
        if (!(await verified(p.source, token)))
          error.value = t(
            "验证未通过，请重试",
            "Verification failed. Please retry.",
          );
      },
      "error-callback": () => {
        error.value = t("验证失败，请重试", "Verification failed. Retry.");
      },
      "expired-callback": () => {
        error.value = t("验证已过期，请重试", "Verification expired. Retry.");
      },
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}
onMounted(load);
onBeforeUnmount(() => {
  disposed = true;
  if (widget) api()?.remove(widget);
});
</script>
<template>
  <div class="verification">
    <p>
      {{ t("请完成人机验证", "Please complete verification") }} ·
      {{ source.index + 1 }}
    </p>
    <div ref="root" />
    <p v-if="error" role="alert">{{ error }}</p>
    <InkButton v-if="error" @click="load">{{
      t("重试验证", "Retry verification")
    }}</InkButton>
  </div>
</template>
