import {
  HistoryCache,
  allowedRange,
  normalizeServer,
  normalizeHistory,
} from "./protocol";
import type { Config, ListResponse, Server, HistoryRow } from "./types";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const memory = new Map<string, string>();
const safeStorage: StorageLike = {
  getItem(k) {
    try {
      return localStorage.getItem(k) || memory.get(k) || null;
    } catch {
      return memory.get(k) || null;
    }
  },
  setItem(k, v) {
    memory.set(k, v);
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  removeItem(k) {
    memory.delete(k);
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const historyCache = new HistoryCache();
export class Client {
  config?: Config;
  verified = "";
  listSnapshot?: ListResponse;
  private listAuth = "";
  private initPromise?: Promise<Config>;
  private pending = new Map<string, Promise<unknown>>();
  private storage: StorageLike;
  private fetcher: typeof fetch;
  private legacyToken: boolean;
  onFailure?: (error: ApiError) => void;
  constructor(
    public base: string,
    options: {
      fetcher?: typeof fetch;
      storage?: StorageLike;
      legacyToken?: boolean;
    } = {},
  ) {
    this.base = base.replace(/\/$/, "");
    this.storage = options.storage || safeStorage;
    this.legacyToken =
      options.legacyToken ??
      (typeof location === "undefined" || this.base === location.origin);
    this.fetcher = options.fetcher || ((...args) => fetch(...args));
    try {
      const saved = JSON.parse(
        this.storage.getItem(this.verificationKey) || "null",
      );
      if (saved?.expires > Date.now()) this.verified = saved.value;
    } catch {}
  }
  get verificationKey() {
    return `cfsm.turnstile:${this.base}`;
  }
  get token() {
    return (
      this.storage.getItem(`jwt_token:${this.base}`) ||
      (this.legacyToken ? this.storage.getItem("jwt_token") : null) ||
      ""
    );
  }
  get authenticated() {
    return this.config?.authorization === true;
  }
  get authKey() {
    return this.authenticated ? this.token || "cookie" : "anon";
  }
  get adminURL() {
    return `${this.base}/admin#/admin`;
  }
  asset(path: string) {
    return `${this.base}/${path.replace(/^\//, "")}`;
  }
  private flight<T>(key: string, work: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) return this.pending.get(key) as Promise<T>;
    const p = work().finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }
  async request<T>(
    path: string,
    extra: Record<string, string> = {},
    includeVerification = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...extra,
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (
      includeVerification &&
      this.config?.turnstile_enabled === true &&
      this.verified
    )
      headers["X-Turnstile-Verified"] = this.verified;
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await this.fetcher(`${this.base}${path}`, {
        headers,
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401) {
          if (this.legacyToken) this.storage.removeItem("jwt_token");
          this.storage.removeItem(`jwt_token:${this.base}`);
          if (this.config) this.config.authorization = false;
          historyCache.clear(this.base);
          this.listSnapshot = undefined;
          this.listAuth = "";
        }
        if (response.status === 403) {
          this.verified = "";
          this.storage.removeItem(this.verificationKey);
        }
        const e = new ApiError(response.status, `HTTP ${response.status}`);
        this.onFailure?.(e);
        throw e;
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
  init(retry = false): Promise<Config> {
    if (this.config && !retry) return Promise.resolve(this.config);
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.request<Config>("/api/config", {}, false)
      .then((c) => {
        this.config = c;
        if (c.turnstile_enabled !== true) this.verified = "";
        return c;
      })
      .finally(() => {
        this.initPromise = undefined;
      });
    return this.initPromise;
  }
  async verify(oneTimeToken: string) {
    const c = await this.request<Config>(
      "/api/config",
      { "X-Turnstile-Token": oneTimeToken },
      false,
    );
    if (c.verified !== true || !c.turnstile_verified)
      throw new ApiError(403, "Verification failed");
    this.config = c;
    this.verified = c.turnstile_verified;
    this.storage.setItem(
      this.verificationKey,
      JSON.stringify({ value: this.verified, expires: Date.now() + 3500000 }),
    );
  }
  private async ready() {
    const c = await this.init();
    if (c.is_public !== true && !this.authenticated) {
      const e = new ApiError(401, "Login required");
      this.onFailure?.(e);
      throw e;
    }
    if (c.turnstile_enabled === true && !this.verified)
      throw new ApiError(403, "Verification required");
  }
  async list(refresh = false) {
    await this.ready();
    if (this.listSnapshot && this.listAuth === this.authKey && !refresh)
      return this.listSnapshot;
    return this.flight(`list:${this.authKey}`, async () => {
      const r = await this.request<ListResponse>("/api/servers");
      if (!Array.isArray(r.servers) || !r.stats)
        throw new ApiError(502, "Invalid server list");
      this.listAuth = this.authKey;
      this.listSnapshot = { ...r, servers: r.servers.map(normalizeServer) };
      return this.listSnapshot;
    });
  }
  async detail(id: string) {
    await this.ready();
    return this.flight(`detail:${id}:${this.authKey}`, async () =>
      normalizeServer(
        await this.request<Server>(`/api/server?id=${encodeURIComponent(id)}`),
      ),
    );
  }
  async history(id: string, hours: number) {
    await this.ready();
    if (!allowedRange(hours, this.authenticated))
      throw new ApiError(
        hours > 24 ? 401 : 400,
        "History range requires login or is invalid",
      );
    const auth = this.authKey,
      cached = historyCache.get(this.base, id, hours, auth);
    if (cached) return cached;
    return this.flight(`history:${id}:${hours}:${auth}`, async () => {
      const rows = await this.request<HistoryRow[]>(
        `/api/history/all?id=${encodeURIComponent(id)}&hours=${hours}`,
      );
      if (!Array.isArray(rows))
        throw new ApiError(502, "Invalid history response");
      const sorted = normalizeHistory(rows);
      historyCache.set(this.base, id, hours, auth, sorted);
      return sorted;
    });
  }
  wsURL(id?: string, origin = globalThis.location?.origin) {
    const u = new URL(`${this.base}/api/ws`);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.searchParams.set("subscribe", id || "all");
    if (origin !== this.base && this.token) {
      if (
        u.protocol !== "wss:" &&
        !["localhost", "127.0.0.1"].includes(u.hostname)
      )
        throw new ApiError(400, "Secure WebSocket required");
      u.searchParams.set("token", this.token);
    }
    return u.href;
  }
}
