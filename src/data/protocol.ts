import type { Server, Sample, HistoryRow, GPU, DiskIO } from "./types";
export const HOURS = [0.167, 0.5, 1, 6, 12, 24, 48, 96, 168] as const;
export const sourceKey = (base: string, id: string) =>
  JSON.stringify([base, id]);
export const metric = (v: unknown): number | null | undefined =>
  v === null
    ? null
    : typeof v === "number" && Number.isFinite(v)
      ? v
      : undefined;
export function formatLoss(v: unknown, timeout = "Timeout") {
  const n = metric(v);
  return n === undefined
    ? "—"
    : n === null
      ? timeout
      : n === 0
        ? "0%"
        : `${n.toFixed(3)}%`;
}
export function bytesMB(v: unknown) {
  const n = metric(v);
  return typeof n === "number" ? n * 1024 * 1024 : undefined;
}
export function allowedRange(h: number, authenticated: boolean) {
  return (HOURS as readonly number[]).includes(h) && (h <= 24 || authenticated);
}
const known = new Set(
  `cpu load_avg ram_total ram_used swap_total swap_used disk_total disk_used disk gpu_info net_in_speed net_out_speed net_rx net_tx net_rx_monthly net_tx_monthly processes tcp_conn udp_conn cpu_cores cpu_info arch os kernel_version region boot_time last_updated agent_version timestamp ip_v4 ip_v6`.split(
    " ",
  ),
);
for (const p of [
  "ct",
  "cu",
  "cm",
  "bd",
  "node_1",
  "node_2",
  "node_3",
  "node_4",
]) {
  known.add("ping_" + p);
  known.add("loss_" + p);
}
const clocks = new WeakMap<object, Record<string, number>>();
export function mergeSamples<
  T extends { timestamp: number; [key: string]: unknown },
>(server: T, samples: Sample[]): T {
  const next = { ...server };
  const times = {
    ...(clocks.get(server) || { __baseline: Number(server.timestamp) || 0 }),
  };
  const baseline = times.__baseline;
  for (const s of [...samples].sort((a, b) => a.ts - b.ts)) {
    if (!Number.isFinite(s.ts)) continue;
    for (const [k, v] of Object.entries(
      s.data || s.payload || s.metrics || {},
    )) {
      if (known.has(k) && v !== undefined && s.ts >= (times[k] ?? baseline)) {
        (next as Record<string, unknown>)[k] = v;
        times[k] = s.ts;
      }
    }
    next.timestamp = Math.max(next.timestamp || 0, s.ts);
    if (s.ts > baseline)
      (next as Record<string, unknown>).last_updated = Math.max(
        Number(next.last_updated) || 0,
        s.ts,
      );
  }
  clocks.set(next, times);
  return next;
}
export function normalizeServer(v: Server): Server {
  return {
    ...v,
    id: String(v.id),
    timestamp: Number(v.timestamp || v.last_updated) || 0,
  };
}
export function normalizeHistory(rows: HistoryRow[]) {
  const m = new Map<number, HistoryRow>();
  for (const r of rows)
    if (Number.isFinite(r.timestamp))
      m.set(r.timestamp, { ...m.get(r.timestamp), ...r });
  return [...m.values()].sort((a, b) => a.timestamp - b.timestamp);
}
export class HistoryCache {
  private entries = new Map<
    string,
    { rows: HistoryRow[]; bytes: number; at: number }
  >();
  constructor(
    private capacity = 4,
    private maxBytes = 1024 * 1024,
    private ttl = 60000,
  ) {}
  private key(b: string, id: string, h: number, auth: string) {
    return JSON.stringify([b, id, h, auth]);
  }
  get size() {
    return this.entries.size;
  }
  get bytes() {
    return [...this.entries.values()].reduce((s, v) => s + v.bytes, 0);
  }
  get(b: string, id: string, h: number, auth: string) {
    const k = this.key(b, id, h, auth),
      e = this.entries.get(k);
    if (!e) return;
    if (Date.now() - e.at > this.ttl) {
      this.entries.delete(k);
      return;
    }
    this.entries.delete(k);
    this.entries.set(k, e);
    return e.rows;
  }
  set(b: string, id: string, h: number, auth: string, rows: HistoryRow[]) {
    const key = this.key(b, id, h, auth),
      bytes = new TextEncoder().encode(JSON.stringify(rows)).length;
    this.entries.delete(key);
    if (bytes > this.maxBytes) return;
    this.entries.set(key, { rows, bytes, at: Date.now() });
    while (this.size > this.capacity || this.bytes > this.maxBytes)
      this.entries.delete(this.entries.keys().next().value!);
  }
  clear(base?: string) {
    if (!base) this.entries.clear();
    else
      for (const key of this.entries.keys())
        if (JSON.parse(key)[0] === base) this.entries.delete(key);
  }
}
export const online = (s: Server, now = Date.now()) =>
  !!s.last_updated && now - s.last_updated < 300000;
export function gpus(value: unknown): GPU[] {
  try {
    const rows = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(rows)
      ? rows.filter(
          (v) =>
            v &&
            typeof v.id === "string" &&
            typeof v.name === "string" &&
            typeof metric(v.info) === "number",
        )
      : [];
  } catch {
    return [];
  }
}
export function diskIO(value: unknown): DiskIO | undefined {
  if (!value || typeof value !== "object") return;
  const keys = [
    "read_bps",
    "write_bps",
    "read_iops",
    "write_iops",
    "await_ms",
    "util",
  ];
  const result = Object.fromEntries(
    keys
      .filter(
        (k) =>
          typeof metric((value as Record<string, unknown>)[k]) === "number",
      )
      .map((k) => [k, (value as Record<string, unknown>)[k]]),
  );
  return Object.values(result).some((v) => typeof v === "number" && v > 0)
    ? result
    : undefined;
}
export function quantity(v: unknown, suffix = "B") {
  const n = metric(v);
  if (typeof n !== "number") return "—";
  const units = ["", "K", "M", "G", "T", "P"];
  const p = n > 0 ? Math.min(5, Math.floor(Math.log(n) / Math.log(1024))) : 0;
  return `${(n / 1024 ** p).toFixed(p ? 2 : 0).replace(/\.00$/, "")} ${units[p]}${suffix}`;
}
export function percentage(v: unknown, total: unknown) {
  return typeof v === "number" && typeof total === "number" && total > 0
    ? (v / total) * 100
    : null;
}

/** Carry only state known at each sample time, never a future full report. */
export function appendLiveHistory(
  rows: HistoryRow[],
  samples: Sample[],
  cutoff: number,
  max: number,
) {
  const merged = normalizeHistory(rows).filter((r) => r.timestamp >= cutoff);
  for (const sample of [...samples].sort((a, b) => a.ts - b.ts)) {
    if (!Number.isFinite(sample.ts) || sample.ts < cutoff) continue;
    let at = merged.findIndex((r) => r.timestamp >= sample.ts);
    if (at < 0) at = merged.length;
    const same = merged[at]?.timestamp === sample.ts;
    const base = same ? merged[at] : merged[at - 1] || { timestamp: sample.ts };
    const row = mergeSamples(base, [sample]);
    row.timestamp = sample.ts;
    if (same) merged[at] = row;
    else merged.splice(at, 0, row);
  }
  return merged.length > max
    ? Array.from(
        { length: max },
        (_, i) => merged[Math.round((i * (merged.length - 1)) / (max - 1))],
      )
    : merged;
}
