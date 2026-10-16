export type Probe = number | null | false;
export interface DiskIO {
  read_bps?: number;
  write_bps?: number;
  read_iops?: number;
  write_iops?: number;
  await_ms?: number;
  util?: number;
}
export interface GPU {
  id: string;
  name: string;
  info: number | null;
}
export interface Sample {
  ts: number;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
}
export interface HistoryRow {
  timestamp: number;
  [key: string]: unknown;
}
export interface Server extends HistoryRow {
  id: string;
  name?: string;
  region?: string;
  server_group?: string;
  tags?: string;
  cpu?: number;
  ram_total?: number;
  ram_used?: number;
  swap_total?: number;
  swap_used?: number;
  disk_total?: number;
  disk_used?: number;
  disk?: DiskIO;
  gpu_info?: GPU[] | string;
  last_updated?: number;
  net_in_speed?: number;
  net_out_speed?: number;
  net_rx_monthly?: number;
  net_tx_monthly?: number;
  net_rx?: number;
  net_tx?: number;
  price?: string;
  billing_cycle?: string;
  currency?: string;
  expire_date?: string;
  traffic_limit?: string;
  traffic_calc_type?: string;
  os?: string;
  cpu_info?: string;
  cpu_cores?: number;
  boot_time?: string;
  ping?: WindowPoint[];
  loss?: WindowPoint[];
  latestReportUpdates?: Array<{ serverId: string; samples: Sample[] }>;
}
export interface WindowPoint {
  ts: number;
  ct?: Probe;
  cu?: Probe;
  cm?: Probe;
  bd?: Probe;
}
export interface SysConfig {
  show_price?: boolean;
  show_expire?: boolean;
  show_tf?: boolean;
  show_three_net_details?: boolean;
}
export interface Stats {
  total: number;
  online: number;
  offline: number;
  globalSpeedIn: number;
  globalSpeedOut: number;
  globalNetTx: number;
  globalNetRx: number;
}
export interface ListResponse {
  servers: Server[];
  stats: Stats;
  regionStats?: Record<string, number>;
  sysConfig: SysConfig;
}
export interface Config {
  version?: string;
  is_public?: boolean;
  authorization?: boolean;
  turnstile_enabled?: boolean;
  turnstile_site_key?: string;
  verified?: boolean;
  turnstile_verified?: string | null;
  site_title?: string;
  preferred_theme?: string;
  default_language?: string;
  theme_options?: Record<string, unknown>;
  frontend_ws_timeout_minutes?: number;
  long_history_points?: number;
  [key: string]: unknown;
}
