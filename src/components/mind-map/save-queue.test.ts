import { describe, expect, it } from "vitest";
import { createSaveQueue } from "./save-queue";

/** A send whose calls resolve only when the test says so. */
function controlledSend() {
  const sent: number[] = [];
  const resolvers: ((ok: boolean) => void)[] = [];
  const send = (value: number) => {
    sent.push(value);
    return new Promise<boolean>((resolve) => resolvers.push(resolve));
  };
  const finish = async (ok: boolean) => {
    resolvers.shift()?.(ok);
    await new Promise((r) => setTimeout(r, 0));
  };
  return { sent, send, finish };
}

describe("createSaveQueue", () => {
  it("sends one value at a time and then only the latest waiting one", async () => {
    const { sent, send, finish } = controlledSend();
    const queue = createSaveQueue(send);
    const done = queue.save(1);
    void queue.save(2);
    void queue.save(3);
    expect(sent).toEqual([1]);
    expect(queue.running).toBe(true);
    await finish(true);
    expect(sent).toEqual([1, 3]);
    await finish(true);
    await done;
    expect(queue.running).toBe(false);
  });

  it("drops waiting values after a failed send", async () => {
    const { sent, send, finish } = controlledSend();
    const queue = createSaveQueue(send);
    const done = queue.save(1);
    void queue.save(2);
    await finish(false);
    await done;
    expect(sent).toEqual([1]);
    expect(queue.running).toBe(false);
    // The queue works again afterwards.
    void queue.save(4);
    expect(sent).toEqual([1, 4]);
  });
});
