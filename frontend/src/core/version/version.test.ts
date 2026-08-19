import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BUILD_VERSION,
  canAttempt,
  clearAttempts,
  fetchDeployedVersion,
  isStale,
  recordAttempt,
} from "@core/version/version";

describe("isStale", () => {
  it("is false when the probe failed, so a flaky network never forces a reload", () => {
    expect(isStale(null)).toBe(false);
  });

  it("is false when the server serves what this tab is running", () => {
    expect(isStale(BUILD_VERSION)).toBe(false);
  });

  it("is true when the server has moved on", () => {
    expect(isStale(`${BUILD_VERSION}-next`)).toBe(true);
  });
});

describe("attempt guard", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("allows the first attempt at a target", () => {
    expect(canAttempt("abc123")).toBe(true);
  });

  it("stops after the cap so a half-propagated CDN cannot cause a reload loop", () => {
    recordAttempt("abc123");
    expect(canAttempt("abc123")).toBe(true);
    recordAttempt("abc123");
    expect(canAttempt("abc123")).toBe(false);
  });

  it("counts per target, so the next deploy starts with a fresh budget", () => {
    recordAttempt("abc123");
    recordAttempt("abc123");
    expect(canAttempt("abc123")).toBe(false);
    expect(canAttempt("def456")).toBe(true);
  });

  it("clears once the running bundle matches again", () => {
    recordAttempt("abc123");
    recordAttempt("abc123");
    clearAttempts();
    expect(canAttempt("abc123")).toBe(true);
  });

  it("treats a corrupted entry as no history rather than throwing", () => {
    sessionStorage.setItem("propos:update-attempt", "not json");
    expect(canAttempt("abc123")).toBe(true);
  });
});

describe("fetchDeployedVersion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(impl: () => Promise<Response>) {
    vi.stubGlobal("fetch", vi.fn(impl));
  }

  it("returns the advertised version", async () => {
    stubFetch(() => Promise.resolve(new Response(JSON.stringify({ version: "abc123" }))));
    await expect(fetchDeployedVersion()).resolves.toBe("abc123");
  });

  it("asks for a fresh copy every time", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ version: "abc123" }))),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchDeployedVersion();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/version.json");
    expect(init.cache).toBe("no-store");
  });

  it("returns null when offline instead of reporting a bogus mismatch", async () => {
    stubFetch(() => Promise.reject(new Error("offline")));
    await expect(fetchDeployedVersion()).resolves.toBeNull();
  });

  it("returns null on a non-ok response", async () => {
    stubFetch(() => Promise.resolve(new Response("nope", { status: 404 })));
    await expect(fetchDeployedVersion()).resolves.toBeNull();
  });

  it("returns null when the payload has no usable version", async () => {
    stubFetch(() => Promise.resolve(new Response(JSON.stringify({ version: 42 }))));
    await expect(fetchDeployedVersion()).resolves.toBeNull();
  });
});
