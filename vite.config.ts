import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    base: "./",
    publicDir: false,
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag.startsWith("wired-"),
          },
        },
      }),
      {
        name: "cf-runtime-config",
        transformIndexHtml(html) {
          if (mode !== "static") return html;
          if (!env.API_BASE)
            throw new Error("API_BASE is required for static deployment");
          const bases = env.API_BASE.split(",").map(
            (s) => new URL(s.trim()).origin,
          );
          const api = [...bases, ...(env.CSP_API || "").split(",")].filter(
            Boolean,
          );
          const stat = (env.CSP_STATIC || "").split(",").filter(Boolean);
          const csp = `default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com ${stat.join(" ")}; style-src 'self' 'unsafe-inline' ${stat.join(" ")}; img-src 'self' data: https: ${[...bases, ...stat].join(" ")}; font-src 'self' ${stat.join(" ")}; connect-src 'self' ${api.flatMap((s) => [s, s.replace(/^http/, "ws")]).join(" ")} https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com;`;
          return html
            .replace(
              "<!--runtime-->",
              `<meta name="apiBase" content="${escape(bases.join(","))}"><meta http-equiv="Content-Security-Policy" content="${escape(csp)}">${env.BACKGROUND_IMAGE ? `<style>body{background-image:url(${JSON.stringify(env.BACKGROUND_IMAGE).replace(/</g, "\\3c ")})!important;background-size:cover;background-attachment:fixed}</style>` : ""}`,
            )
            .replace(
              "<title>hahaha</title>",
              `<title>${escape(env.TITLE || "hahaha")}</title>`,
            );
        },
      },
    ],
    build: {
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 350,
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ["vue", "vue-router"],
            rough: ["roughjs"],
            wired: ["wired-elements/lib/wired-button.js"],
          },
        },
      },
    },
    server: {
      proxy: env.CF_BACKEND
        ? {
            "/api": { target: env.CF_BACKEND, changeOrigin: true, ws: true },
            "/flags": env.CF_BACKEND,
            "/os-icons": env.CF_BACKEND,
            "/admin": env.CF_BACKEND,
          }
        : undefined,
    },
  };
});
