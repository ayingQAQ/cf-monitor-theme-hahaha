import { ref } from "vue";
/** UI-only aging; this clock never issues network requests. */
export const clock = ref(Date.now());
export function startClock() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const tick = () => {
    clock.value = Date.now();
    if (!stopped && !document.hidden) timer = setTimeout(tick, 1000);
  };
  const sync = () => {
    clearTimeout(timer);
    if (!document.hidden) tick();
  };
  document.addEventListener("visibilitychange", sync);
  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", sync);
  };
}
