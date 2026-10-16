import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./styles/globals.css";
import "./styles/app.css";
import "./styles/cf.css";
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: () => import("./views/Dashboard.vue") },
    { path: "/server/:id", component: () => import("./views/Detail.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
  scrollBehavior(to, from, saved) {
    return saved || { top: 0 };
  },
});
createApp(App).use(router).mount("#app");
