// Lazy-load vendored opencv.js from /opencv/opencv.js (offline-capable, cached by SW).
// `Module.onRuntimeInitialized` resolves once WASM is ready.

declare global {
  interface Window {
    cv?: unknown;
    Module?: { onRuntimeInitialized?: () => void };
  }
}

const VENDORED_URL = "/opencv/opencv.js";

let cached: Promise<typeof window.cv> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-opencv]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`opencv load failed: ${src}`)));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.opencv = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`opencv load failed: ${src}`));
    document.head.appendChild(script);
  });
}

function waitForRuntime(): Promise<typeof window.cv> {
  return new Promise((resolve, reject) => {
    const cv = window.cv as { onRuntimeInitialized?: () => void } | undefined;
    if (cv && typeof (cv as { Mat?: unknown }).Mat === "function") {
      resolve(cv as unknown as typeof window.cv);
      return;
    }
    const timeout = window.setTimeout(() => {
      reject(new Error("opencv runtime init timeout"));
    }, 30_000);
    const check = () => {
      const c = window.cv as { Mat?: unknown } | undefined;
      if (c && typeof c.Mat === "function") {
        window.clearTimeout(timeout);
        resolve(c as unknown as typeof window.cv);
        return true;
      }
      return false;
    };
    if (cv) {
      cv.onRuntimeInitialized = () => {
        check();
      };
    }
    const poll = window.setInterval(() => {
      if (check()) window.clearInterval(poll);
    }, 100);
  });
}

export function loadOpenCV(): Promise<typeof window.cv> {
  if (cached) return cached;
  cached = (async () => {
    await injectScript(VENDORED_URL);
    return waitForRuntime();
  })();
  return cached;
}

export function getCV(): typeof window.cv {
  if (!window.cv) throw new Error("opencv not loaded — call loadOpenCV() first");
  return window.cv;
}
