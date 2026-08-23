import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetViewportStore, getViewportSnapshot, subscribeViewport } from "./viewport-store";

/** jsdom has no visualViewport; install a controllable fake. */
function installViewport(height = 844, offsetTop = 0) {
  const target = new EventTarget();
  const vv = Object.assign(target, {
    height,
    offsetTop,
    width: 390,
    scale: 1,
  }) as unknown as VisualViewport;
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true, writable: true });
  return vv as unknown as EventTarget & { height: number; offsetTop: number };
}

const varOf = (name: string) => document.documentElement.style.getPropertyValue(name);

let vv: ReturnType<typeof installViewport>;

beforeEach(() => {
  __resetViewportStore();
  vv = installViewport();
});

afterEach(() => {
  __resetViewportStore();
});

describe("subscribeViewport — refcounting", () => {
  it("attaches its listeners once for many subscribers", () => {
    const add = vi.spyOn(vv, "addEventListener");
    const un1 = subscribeViewport(() => {});
    const un2 = subscribeViewport(() => {});
    const resizes = add.mock.calls.filter(([type]) => type === "resize");
    expect(resizes).toHaveLength(1);
    un1();
    un2();
  });

  it("KEEPS the css variables when one of two consumers unmounts", () => {
    // This is the actual production bug: closing Propo over an open WhatsApp
    // thread wiped the vars and dropped the thread's composer behind the keys.
    const un1 = subscribeViewport(() => {});
    const un2 = subscribeViewport(() => {});
    expect(varOf("--vv-h")).not.toBe("");

    un1();
    expect(varOf("--vv-h")).not.toBe("");
    expect(varOf("--kb-open")).not.toBe("");

    un2();
    expect(varOf("--vv-h")).toBe("");
  });

  it("removes every variable only when the last consumer leaves", () => {
    const un = subscribeViewport(() => {});
    un();
    expect(varOf("--kb-inset")).toBe("");
    expect(varOf("--kb-open")).toBe("");
    expect(varOf("--vv-h")).toBe("");
    expect(varOf("--vv-top")).toBe("");
  });

  it("republishes after a resubscribe", () => {
    subscribeViewport(() => {})();
    expect(varOf("--vv-h")).toBe("");
    subscribeViewport(() => {});
    expect(varOf("--vv-h")).toBe("844px");
  });

  it("detaches its listeners when the last consumer leaves", () => {
    const remove = vi.spyOn(vv, "removeEventListener");
    const un = subscribeViewport(() => {});
    un();
    expect(remove.mock.calls.filter(([t]) => t === "resize")).toHaveLength(1);
  });
});

describe("subscribeViewport — updates", () => {
  it("writes the new geometry on a viewport resize", () => {
    subscribeViewport(() => {});
    vv.height = 508;
    vv.dispatchEvent(new Event("resize"));
    expect(varOf("--vv-h")).toBe("508px");
    expect(getViewportSnapshot().kbInset).toBe(336);
  });

  it("notifies subscribers only when the open flag flips", () => {
    const seen = vi.fn();
    subscribeViewport(seen);
    seen.mockClear();

    // Geometry moves but no editable is focused: no keyboard, no notification.
    vv.height = 508;
    vv.dispatchEvent(new Event("resize"));
    expect(getViewportSnapshot().kbOpen).toBe(false);
    expect(seen).not.toHaveBeenCalled();

    // Focus an input and the same geometry now means a keyboard.
    const el = document.createElement("input");
    document.body.appendChild(el);
    el.focus();
    vv.height = 507;
    vv.dispatchEvent(new Event("resize"));
    expect(getViewportSnapshot().kbOpen).toBe(true);
    expect(seen).toHaveBeenCalledTimes(1);
    el.remove();
  });

  it("forgets restHeight on rotation so it cannot fake a keyboard", () => {
    subscribeViewport(() => {});
    // Rotate: the layout viewport is now much shorter than the tallest seen.
    Object.defineProperty(window, "innerHeight", { value: 390, configurable: true });
    vv.height = 390;
    window.dispatchEvent(new Event("orientationchange"));
    expect(getViewportSnapshot().kbOpen).toBe(false);
    expect(varOf("--kb-open")).toBe("0");
  });
});
