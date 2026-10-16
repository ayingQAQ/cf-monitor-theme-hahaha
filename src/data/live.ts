import type { Sample } from "./types";
export type LiveState =
  "connecting" | "live" | "retrying" | "stopped" | "expired" | "paused";
type Options = {
  url: string;
  ids: string[];
  all: boolean;
  timeoutMinutes: number;
  socket?: (url: string) => WebSocket;
  onState: (state: LiveState) => void;
  onSamples: (updates: Array<{ serverId: string; samples: Sample[] }>) => void;
};
export class LiveConnection {
  state: LiveState = "paused";
  private ws?: WebSocket;
  private retry?: ReturnType<typeof setTimeout>;
  private expiry?: ReturnType<typeof setTimeout>;
  private stable?: ReturnType<typeof setTimeout>;
  private attempts = 0;
  private active = false;
  private deadline = 0;
  constructor(private o: Options) {}
  private status(s: LiveState) {
    this.state = s;
    this.o.onState(s);
  }
  start() {
    this.close();
    this.active = true;
    this.attempts = 0;
    this.deadline =
      this.o.timeoutMinutes > 0
        ? Date.now() + this.o.timeoutMinutes * 60000
        : 0;
    if (this.deadline)
      this.expiry = setTimeout(() => {
        this.close();
        this.status("expired");
      }, this.o.timeoutMinutes * 60000);
    this.connect();
  }
  private connect() {
    if (!this.active) return;
    this.status("connecting");
    try {
      const ws = (this.o.socket || ((u: string) => new WebSocket(u)))(
        this.o.url,
      );
      this.ws = ws;
      ws.onopen = () => {
        if (!this.active || this.ws !== ws) return;
        this.status("live");
        if (this.o.all)
          ws.send(
            JSON.stringify({
              type: "subscribe",
              scope: "all",
              ids: this.o.ids,
            }),
          );
        this.stable = setTimeout(() => {
          this.attempts = 0;
        }, 30000);
      };
      ws.onmessage = (e) => {
        if (
          !this.active ||
          this.ws !== ws ||
          typeof e.data !== "string" ||
          e.data.length > 2 * 1024 * 1024
        )
          return;
        try {
          const m = JSON.parse(e.data);
          if (m.type === "batchUpdate" && Array.isArray(m.updates)) {
            const own = new Set(this.o.ids);
            this.o.onSamples(
              m.updates.filter(
                (v: { serverId: string; samples: Sample[] }) =>
                  own.has(String(v.serverId)) && Array.isArray(v.samples),
              ),
            );
          }
        } catch {}
      };
      ws.onerror = () => {
        ws.close();
      };
      ws.onclose = () => {
        if (this.ws === ws) {
          clearTimeout(this.stable);
          this.schedule();
        }
      };
    } catch {
      this.schedule();
    }
  }
  private schedule() {
    if (!this.active) return;
    if (this.deadline && Date.now() >= this.deadline) {
      this.close();
      this.status("expired");
      return;
    }
    if (this.attempts >= 8) {
      this.close();
      this.status("stopped");
      return;
    }
    this.status("retrying");
    this.retry = setTimeout(
      () => this.connect(),
      Math.min(30000, 1000 * 2 ** this.attempts++),
    );
  }
  close() {
    this.active = false;
    clearTimeout(this.retry);
    clearTimeout(this.expiry);
    clearTimeout(this.stable);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = undefined;
    }
    this.status("paused");
  }
}
