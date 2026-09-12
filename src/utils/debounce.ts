export function debounce<Args extends unknown[]>(callback: (...args: Args) => void, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Args | undefined;

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  }

  function flush() {
    const args = pending;
    cancel();
    if (args) callback(...args);
  }

  function schedule(...args: Args) {
    clearTimeout(timer);
    pending = args;
    timer = setTimeout(flush, delay);
  }

  return Object.assign(schedule, { cancel, flush });
}
