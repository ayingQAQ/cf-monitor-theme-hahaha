import type { Server } from "../data/types";
export function traffic(s: Server) {
  const rx = s.net_rx_monthly || 0,
    tx = s.net_tx_monthly || 0;
  return s.traffic_calc_type === "dl"
    ? rx
    : s.traffic_calc_type === "ul"
      ? tx
      : s.traffic_calc_type === "max"
        ? Math.max(rx, tx)
        : rx + tx;
}
export function trafficLimit(s: Server) {
  const n = Number(s.traffic_limit);
  return Number.isFinite(n) && n > 0 ? n * 1024 ** 3 : 0;
}
export function cycle(raw: string | undefined, zh: boolean) {
  const map: Record<string, [string, string]> = {
    day: ["日", "day"],
    week: ["周", "week"],
    month: ["月", "month"],
    quarter: ["季", "quarter"],
    half_year: ["半年", "half year"],
    year: ["年", "year"],
    two_years: ["两年", "2 years"],
    three_years: ["三年", "3 years"],
    four_years: ["四年", "4 years"],
    five_years: ["五年", "5 years"],
  };
  return map[raw || "month"]?.[zh ? 0 : 1] || raw || "";
}
export function price(s: Server, zh: boolean) {
  if (s.price == null || s.price.trim() === "") return "";
  if (s.price === "0" || s.price === "-1") return zh ? "免费" : "Free";
  return `${s.currency || ""}${s.price} / ${cycle(s.billing_cycle, zh)}`;
}
export function expiry(s: Server, zh: boolean) {
  if (!s.expire_date) return "";
  const ms = Date.parse(s.expire_date);
  if (!Number.isFinite(ms)) return s.expire_date;
  const days = Math.ceil((ms - Date.now()) / 86400000);
  return zh
    ? days < 0
      ? `已过期 ${-days} 天`
      : `还有 ${days} 天`
    : days < 0
      ? `Expired ${-days} days`
      : `${days} days left`;
}
export function duration(ms: number, zh: boolean) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const hours = Math.floor(ms / 3600000),
    days = Math.floor(hours / 24);
  return zh ? `${days} 天 ${hours % 24} 小时` : `${days}d ${hours % 24}h`;
}
export function osIcon(os: string | undefined) {
  const v = (os || "").toLowerCase();
  const aliases: Array<[RegExp, string]> = [
    [/opensuse|suse/, "openSUSE"],
    [/manjaro/, "manjaro-"],
    [/kali/, "kail"],
    [/red[ -]?hat|rhel/, "redhat"],
    [/alma/, "alma"],
    [/macos|mac os|darwin|os x/, "macos"],
    [/nixos|nix os/, "nix"],
    [/alibaba|alinux|aliyun/, "alibaba"],
    [/openwrt|immortalwrt/, "openwrt"],
    [/opencloud|open cloud/, "opencloud"],
  ];
  const alias = aliases.find(([pattern]) => pattern.test(v))?.[1];
  const known = [
    "alpine",
    "debian",
    "ubuntu",
    "windows",
    "centos",
    "fedora",
    "rocky",
    "arch",
    "gentoo",
    "oracle",
    "mint",
  ];
  const name = alias || known.find((s) => v.includes(s));
  return name ? `os-icons/os-${name}.svg` : "";
}
