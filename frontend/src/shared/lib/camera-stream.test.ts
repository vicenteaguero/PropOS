import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  acquireCameraStream,
  hasLiveCameraStream,
  releaseCameraStream,
  resetCameraStream,
} from "@shared/lib/camera-stream";

function fakeStream(state: "live" | "ended" = "live") {
  const track = {
    readyState: state,
    stop: vi.fn(function (this: { readyState: string }) {
      this.readyState = "ended";
    }),
  };
  return {
    getVideoTracks: () => [track],
    getTracks: () => [track],
    __track: track,
  } as unknown as MediaStream & { __track: typeof track };
}

function stubGetUserMedia(streams: MediaStream[]) {
  const calls = { count: 0 };
  vi.stubGlobal("navigator", {
    ...navigator,
    mediaDevices: {
      getUserMedia: vi.fn(() => {
        const s = streams[Math.min(calls.count, streams.length - 1)];
        calls.count += 1;
        return Promise.resolve(s);
      }),
    },
  });
  return calls;
}

describe("acquireCameraStream", () => {
  beforeEach(() => {
    resetCameraStream();
  });
  afterEach(() => {
    resetCameraStream();
    vi.unstubAllGlobals();
  });

  it("reuses the capture across reopens, which is what stops the re-prompt", async () => {
    const calls = stubGetUserMedia([fakeStream()]);
    const first = await acquireCameraStream({ facingMode: "environment" });
    releaseCameraStream();
    const second = await acquireCameraStream({ facingMode: "environment" });
    expect(second).toBe(first);
    expect(calls.count).toBe(1);
  });

  it("re-acquires when the lens changes, since one capture cannot serve both", async () => {
    const back = fakeStream();
    const front = fakeStream();
    const calls = stubGetUserMedia([back, front]);
    await acquireCameraStream({ facingMode: "environment" });
    const second = await acquireCameraStream({ facingMode: "user" });
    expect(second).toBe(front);
    expect(calls.count).toBe(2);
  });

  it("re-acquires when the requested resolution changes", async () => {
    const sd = fakeStream();
    const hd = fakeStream();
    const calls = stubGetUserMedia([sd, hd]);
    await acquireCameraStream({ facingMode: "environment", width: 1920, height: 1080 });
    await acquireCameraStream({ facingMode: "environment", width: 4032, height: 3024 });
    expect(calls.count).toBe(2);
  });

  it("reports whether a reopen would be silent", async () => {
    stubGetUserMedia([fakeStream()]);
    expect(hasLiveCameraStream()).toBe(false);
    await acquireCameraStream({ facingMode: "environment" });
    expect(hasLiveCameraStream()).toBe(true);
    releaseCameraStream({ immediate: true });
    expect(hasLiveCameraStream()).toBe(false);
  });

  it("holds the capture through the idle window, then drops it", async () => {
    vi.useFakeTimers();
    const a = fakeStream();
    stubGetUserMedia([a, fakeStream()]);
    await acquireCameraStream({ facingMode: "environment" });
    releaseCameraStream();
    expect(a.__track.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(a.__track.stop).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
