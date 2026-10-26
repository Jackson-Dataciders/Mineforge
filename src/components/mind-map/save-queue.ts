/**
 * Sends values one at a time. A value saved while a send is running waits;
 * only the latest waiting value is sent next. A failed send drops what is
 * waiting (the caller reloads on errors).
 */
export function createSaveQueue<T>(send: (value: T) => Promise<boolean>) {
  let running = false;
  let waiting: { value: T } | null = null;

  async function save(value: T): Promise<void> {
    waiting = { value };
    if (running) return;
    running = true;
    try {
      while (waiting) {
        const next: { value: T } = waiting;
        waiting = null;
        if (!(await send(next.value))) {
          waiting = null;
          return;
        }
      }
    } finally {
      running = false;
    }
  }

  return {
    save,
    get running() {
      return running;
    },
  };
}
