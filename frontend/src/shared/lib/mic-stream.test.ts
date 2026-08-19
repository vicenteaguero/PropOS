import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  acquireMicStream,
  micPermissionState,
  permissionHint,
  releaseMicStream,
  resetMicStream,
} from "@shared/lib/mic-stream";

/** Minimal MediaStream stand-in: jsdom ships no media capture. */
function fakeStream(state: "live" | "ended" = "live") {
  const track = {
    readyState: state,
    stop: vi.fn(function (this: { readyState: string }) {
      this.readyState = "ended";
    }),
  };
  return {
    getAudioTracks: () => [track],
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

describe("acquireMicStream", () => {
  beforeEach(() => {
    resetMicStream();
  });
  afterEach(() => {
    resetMicStream();
    vi.unstubAllGlobals();
  });

  it("prompts once and reuses the capture, which is the whole point", async () => {
    const calls = stubGetUserMedia([fakeStream()]);
    const first = await acquireMicStream();
    releaseMicStream();
    const second = await acquireMicStream();
    expect(second).toBe(first);
    expect(calls.count).toBe(1);
  });

  it("re-acquires when the previous capture died", async () => {
    const dead = fakeStream("ended");
    const fresh = fakeStream();
    const calls = stubGetUserMedia([dead, fresh]);
    await acquireMicStream();
    const second = await acquireMicStream();
    expect(second).toBe(fresh);
    expect(calls.count).toBe(2);
  });

  it("releases immediately when asked, so the next call prompts again", async () => {
    const a = fakeStream();
    const b = fakeStream();
    const calls = stubGetUserMedia([a, b]);
    await acquireMicStream();
    releaseMicStream({ immediate: true });
    expect(a.__track.stop).toHaveBeenCalled();
    await acquireMicStream();
    expect(calls.count).toBe(2);
  });

  it("holds the capture through the idle window, then drops it", async () => {
    vi.useFakeTimers();
    const a = fakeStream();
    stubGetUserMedia([a, fakeStream()]);
    await acquireMicStream();
    releaseMicStream();
    expect(a.__track.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(a.__track.stop).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("micPermissionState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports what the browser says", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      permissions: { query: () => Promise.resolve({ state: "granted" }) },
    });
    await expect(micPermissionState()).resolves.toBe("granted");
  });

  it("answers 'unknown' on Safari, which does not implement the query", async () => {
    vi.stubGlobal("navigator", { ...navigator, permissions: undefined });
    await expect(micPermissionState()).resolves.toBe("unknown");
  });
});

describe("permissionHint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tells an uninstalled iPhone to install, because settings would not persist", () => {
    vi.stubGlobal("navigator", { userAgent: "iPhone", standalone: false });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    expect(permissionHint()).toContain("Agregar a inicio");
  });

  it("points an installed iPhone at the app's own settings entry", () => {
    vi.stubGlobal("navigator", { userAgent: "iPhone", standalone: true });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    expect(permissionHint()).toContain("Ajustes → PropOS");
  });

  it("keeps the browser wording elsewhere", () => {
    vi.stubGlobal("navigator", { userAgent: "Chrome" });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    expect(permissionHint()).toContain("configuración del navegador");
  });
});
