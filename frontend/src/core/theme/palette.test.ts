import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTO_PALETTE,
  PALETTE_DEFS,
  applyPalette,
  bootstrapPalette,
  getPalette,
  paletteOwnsAccent,
  setPalette,
  toneFor,
} from "./palette";
import { applyTenantAccent } from "./tenant-accent";
import { setTheme } from "./theme";

const html = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  html().removeAttribute("style");
  delete html().dataset.palette;
  // The app's default theme is dark, so a test that means "light" has to say so.
  setTheme("light");
  html().removeAttribute("style");
});

describe("palette", () => {
  it("ships at least eight palettes, each with both themes", () => {
    expect(PALETTE_DEFS.length).toBeGreaterThanOrEqual(8);
    for (const def of PALETTE_DEFS) {
      for (const tone of [def.light, def.dark]) {
        expect(tone.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(tone.fg).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(tone.support).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(tone.tint).toBeGreaterThanOrEqual(0);
        expect(tone.tint).toBeLessThanOrEqual(12);
      }
      // A palette that resolved to the same accent in both themes would be
      // unreadable in one of them — that is the whole reason for two tones.
      expect(def.light.accent).not.toBe(def.dark.accent);
    }
  });

  it("writes the accent tokens the whole app derives from", () => {
    setPalette("menta");
    const tone = toneFor(getPalette("menta")!, "light");
    expect(html().style.getPropertyValue("--accent-brand")).toBe(tone.accent);
    expect(html().style.getPropertyValue("--accent-2")).toBe(tone.support);
    expect(html().style.getPropertyValue("--tint")).toBe(`${tone.tint}%`);
    expect(html().dataset.palette).toBe("menta");
  });

  it("resolves the dark tone when the theme is dark", () => {
    setTheme("dark");
    applyPalette("menta");
    expect(html().style.getPropertyValue("--accent-brand")).toBe(getPalette("menta")!.dark.accent);
  });

  it("re-resolves the tone when the theme flips", () => {
    bootstrapPalette();
    setPalette("indigo");
    expect(html().style.getPropertyValue("--accent-brand")).toBe(
      getPalette("indigo")!.light.accent,
    );
    setTheme("dark");
    expect(html().style.getPropertyValue("--accent-brand")).toBe(getPalette("indigo")!.dark.accent);
  });

  it("auto hands the accent back to the workspace", () => {
    setPalette("vice");
    setPalette(AUTO_PALETTE);
    expect(html().style.getPropertyValue("--accent-brand")).toBe("");
    expect(html().style.getPropertyValue("--tint")).toBe("");
    expect(paletteOwnsAccent()).toBe(false);
  });

  it("outranks the tenant accent while a palette is chosen", () => {
    setPalette("bosque");
    applyTenantAccent({ seed: "some-tenant", color: "#123456", tint: 9 });
    expect(html().style.getPropertyValue("--accent-brand")).toBe(
      getPalette("bosque")!.light.accent,
    );
    expect(html().style.getPropertyValue("--tint")).toBe(`${getPalette("bosque")!.light.tint}%`);
  });

  it("lets the tenant accent through on auto", () => {
    applyTenantAccent({ seed: "some-tenant", color: "#123456", tint: 9 });
    expect(html().style.getPropertyValue("--accent-brand")).toBe("#123456");
  });
});
