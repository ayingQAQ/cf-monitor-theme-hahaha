import { shallowReactive, markRaw, ref, computed, watch } from "vue";
import { clock } from "./clock";
import { Client, ApiError, historyCache } from "./client";
import { LiveConnection, type LiveState } from "./live";
import { mergeSamples, online, dashboardStats } from "./protocol";
import type { Server, Config, Stats, SysConfig, Sample } from "./types";
export interface Source {
  index: number;
  client: Client;
  config?: Config;
  servers: Server[];
  details: Map<string, Server>;
  stats?: Stats;
  sys: SysConfig;
  error: string;
  status: LiveState;
  needsVerification: boolean;
  loading: boolean;
  deadline: number;
  expired: boolean;
}
function apiBases() {
  const raw =
    document.querySelector<HTMLMetaElement>('meta[name="apiBase"]')?.content ||
    location.origin;
  return [
    ...new Set(
      raw.split(",").map((s) => new URL(s.trim(), location.origin).origin),
    ),
  ];
}
const bases = apiBases();
const legacyBase = bases.includes(location.origin) ? location.origin : bases[0];
export const sources = bases.map((base, index) => {
  const client = markRaw(
    new Client(base, { legacyToken: base === legacyBase }),
  );
  const s = shallowReactive<Source>({
    index,
    client,
    servers: [],
    details: new Map(),
    sys: {},
    error: "",
    status: "paused",
    needsVerification: false,
    loading: false,
    deadline: 0,
    expired: false,
  });
  client.onFailure = (e) => {
    s.error = `${e.message}`;
    if (e.status === 403) s.needsVerification = true;
    if (e.status === 401) {
      s.servers = [];
      s.details = new Map();
      s.stats = undefined;
      const key = `cfsm.login-redirect:${base}`;
      try {
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          location.assign(client.adminURL);
        }
      } catch {
        s.error = "401 — Login required";
      }
    }
  };
  return s;
});
watch(clock, () => {
  for (const s of sources) {
    if (!s.stats) continue;
    const n = s.servers.filter((v) => online(v, clock.value)).length;
    if (n !== s.stats.online)
      s.stats = { ...s.stats, online: n, offline: s.stats.total - n };
    if (s.client.listSnapshot) s.client.listSnapshot.stats = s.stats;
  }
});
export const retryRequest = ref<{ index: number; sequence: number } | null>(
  null,
);
export function requestRetry(index: number, continued = false) {
  const s = sources[index];
  if (continued) {
    s.deadline = 0;
    s.expired = false;
  }
  retryRequest.value = {
    index,
    sequence: (retryRequest.value?.sequence || 0) + 1,
  };
}
export const allServers = computed(() =>
  sources.flatMap((s) => s.servers.map((server) => ({ server, source: s }))),
);
export const config = computed(() => sources.find((s) => s.config)?.config);
export const lang = computed(() => {
  const v = config.value?.default_language;
  return v === "zh" || (v !== "en" && navigator.language.startsWith("zh"))
    ? "zh"
    : "en";
});
export const t = (zh: string, en: string) => (lang.value === "zh" ? zh : en);
export function failure(s: Source, e: unknown) {
  s.error =
    e instanceof ApiError && e.status === 409
      ? t(
          "数据库需要升级，请在内置后台处理。",
          "Database upgrade required. Open the built-in admin.",
        )
      : e instanceof Error
        ? e.message
        : String(e);
  if (e instanceof ApiError && e.status === 403) s.needsVerification = true;
}
export async function initialize(s: Source, retry = false) {
  s.loading = true;
  try {
    s.config = await s.client.init(retry);
    if (s.config.is_public !== true && !s.client.authenticated) {
      const e = new ApiError(401, "Login required");
      s.client.onFailure?.(e);
      throw e;
    }
    if (s.config.turnstile_enabled === true && !s.client.verified) {
      s.needsVerification = true;
      return false;
    }
    s.error = "";
    return true;
  } catch (e) {
    failure(s, e);
    return false;
  } finally {
    s.loading = false;
  }
}
let active: () => void = () => {};
export function stopLive() {
  active();
  active = () => {};
}
export function subscribe(
  s: Source,
  id?: string,
  onLive?: (server: Server, samples: Sample[]) => void,
) {
  if (s.expired || (s.deadline > 0 && Date.now() >= s.deadline)) {
    s.expired = true;
    s.status = "expired";
    return () => {};
  }
  const minutes = Number(s.config?.frontend_ws_timeout_minutes) || 0;
  if (minutes > 0 && !s.deadline) s.deadline = Date.now() + minutes * 60000;
  const current = new Map(
    (id
      ? [s.details.get(id)].filter((v): v is Server => Boolean(v))
      : s.servers
    ).map((v) => [v.id, v]),
  );
  let pending = new Map<string, Server>(),
    timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    if (!pending.size) return;
    const patches = pending;
    pending = new Map();
    if (id) {
      const v = patches.get(id);
      if (v) {
        s.details.set(id, v);
        s.details = new Map(s.details);
      }
    } else {
      s.servers = s.servers.map((v) => patches.get(v.id) || v);
      if (s.client.listSnapshot) s.client.listSnapshot.servers = s.servers;
      if (s.stats) {
        s.stats = {
          ...s.stats,
          ...dashboardStats(s.servers, Date.now(), s.stats.total),
        };
        if (s.client.listSnapshot) s.client.listSnapshot.stats = s.stats;
      }
    }
  };
  const live = new LiveConnection({
    url: s.client.wsURL(id),
    ids: id ? [id] : s.servers.map((v) => v.id),
    all: !id,
    timeoutMinutes:
      s.deadline > 0
        ? Math.max(0.000001, (s.deadline - Date.now()) / 60000)
        : 0,
    onState: (state) => {
      if (state === "expired") s.expired = true;
      s.status = s.expired ? "expired" : state;
    },
    onSamples: (updates) => {
      for (const u of updates) {
        const key = String(u.serverId),
          old = current.get(key);
        if (old) {
          const next = mergeSamples(old, u.samples);
          current.set(key, next);
          pending.set(key, next);
          onLive?.(next, u.samples);
        }
      }
      if (!timer) timer = setTimeout(flush, id ? 250 : 1000);
    },
  });
  live.start();
  return () => {
    live.close();
    clearTimeout(timer);
    flush();
  };
}
let generation = 0;
export async function dashboard(refresh = false, onlyIndex?: number) {
  const gen = ++generation;
  stopLive();
  const stops: Array<() => void> = [];
  active = () => stops.forEach((stop) => stop());
  await Promise.all(
    sources.map(async (s) => {
      if (!(await initialize(s)) || gen !== generation) return;
      try {
        const r = await s.client.list(
          refresh && (onlyIndex === undefined || onlyIndex === s.index),
        );
        if (gen !== generation) return;
        s.servers = r.servers;
        s.stats = r.stats;
        s.sys = r.sysConfig || {};
        if (!document.hidden) stops.push(subscribe(s));
      } catch (e) {
        failure(s, e);
      }
    }),
  );
}
export async function detail(
  s: Source,
  id: string,
  refresh = false,
  onLive?: (server: Server, samples: Sample[]) => void,
) {
  const gen = ++generation;
  stopLive();
  if (!(await initialize(s)) || gen !== generation) return;
  try {
    if (refresh || !s.details.has(id)) {
      const v = await s.client.detail(id);
      s.details.set(id, v);
      while (s.details.size > 20)
        s.details.delete(s.details.keys().next().value!);
      s.details = new Map(s.details);
    }
    if (gen !== generation) return;
    if (!document.hidden) active = subscribe(s, id, onLive);
    s.error = "";
  } catch (e) {
    failure(s, e);
  }
}
export function leave() {
  historyCache.prune();
  ++generation;
  stopLive();
}
export const verificationRevision = ref(0);
export async function verified(s: Source, token: string) {
  try {
    await s.client.verify(token);
    s.config = s.client.config;
    s.needsVerification = false;
    s.error = "";
    verificationRevision.value++;
    return true;
  } catch (e) {
    failure(s, e);
    return false;
  }
}
