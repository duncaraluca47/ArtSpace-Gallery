import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeDataGenerator } from "../../src/backend/services/fakeDataGenerator";

type FakeWs = {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  on: (event: "close", handler: () => void) => void;
};

describe("FakeDataGenerator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts generation and emits batches to callback and open websocket clients", () => {
    vi.useFakeTimers();

    const generator = new FakeDataGenerator();
    const onBatch = vi.fn();
    const openClientSend = vi.fn();
    const closedClientSend = vi.fn();

    const openClient: FakeWs = {
      readyState: 1,
      send: openClientSend,
      on: () => undefined,
    };

    const closedClient: FakeWs = {
      readyState: 0,
      send: closedClientSend,
      on: () => undefined,
    };

    generator.subscribe(openClient as any);
    generator.subscribe(closedClient as any);

    generator.startGeneration(2, 1000, onBatch);

    expect(generator.isActive()).toBe(true);

    vi.advanceTimersByTime(1000);

    expect(onBatch).toHaveBeenCalledTimes(1);
    const batch = onBatch.mock.calls[0][0] as Array<{
      id: string;
      title: string;
      artist: string;
      imageUrl: string;
    }>;

    expect(batch).toHaveLength(2);
    expect(batch[0].id).toEqual(expect.any(String));
    expect(batch[0].title).toEqual(expect.any(String));
    expect(batch[0].artist).toEqual(expect.any(String));
    expect(batch[0].imageUrl).toEqual(expect.any(String));

    expect(openClientSend).toHaveBeenCalledTimes(1);
    const firstMessage = JSON.parse(openClientSend.mock.calls[0][0]);
    expect(firstMessage.type).toBe("artworks_created");
    expect(Array.isArray(firstMessage.data)).toBe(true);

    expect(closedClientSend).not.toHaveBeenCalled();

    generator.stopGeneration();
    expect(generator.isActive()).toBe(false);
  });

  it("removes subscribed client on websocket close", () => {
    vi.useFakeTimers();

    const generator = new FakeDataGenerator();
    const onBatch = vi.fn();
    const send = vi.fn();
    let closeHandler: (() => void) | undefined;

    const client: FakeWs = {
      readyState: 1,
      send,
      on: (_event, handler) => {
        closeHandler = handler;
      },
    };

    generator.subscribe(client as any);
    closeHandler?.();

    generator.startGeneration(1, 1000, onBatch);
    vi.advanceTimersByTime(1000);

    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();

    generator.stopGeneration();
  });

  it("does not start a second generation loop while already active", () => {
    vi.useFakeTimers();

    const generator = new FakeDataGenerator();
    const firstBatchHandler = vi.fn();
    const secondBatchHandler = vi.fn();

    generator.startGeneration(1, 1000, firstBatchHandler);
    generator.startGeneration(3, 1000, secondBatchHandler);

    vi.advanceTimersByTime(1000);

    expect(firstBatchHandler).toHaveBeenCalledTimes(1);
    const firstBatch = firstBatchHandler.mock.calls[0][0] as unknown[];
    expect(firstBatch).toHaveLength(1);

    expect(secondBatchHandler).not.toHaveBeenCalled();

    generator.stopGeneration();
  });

  it("broadcasts generation_stopped only to open websocket clients", () => {
    const generator = new FakeDataGenerator();
    const openClientSend = vi.fn();
    const closedClientSend = vi.fn();

    generator.subscribe({ readyState: 1, send: openClientSend, on: () => undefined } as any);
    generator.subscribe({ readyState: 0, send: closedClientSend, on: () => undefined } as any);

    generator.stopGeneration();

    expect(openClientSend).toHaveBeenCalledTimes(1);
    const message = JSON.parse(openClientSend.mock.calls[0][0]);
    expect(message.type).toBe("generation_stopped");

    expect(closedClientSend).not.toHaveBeenCalled();
  });
});
