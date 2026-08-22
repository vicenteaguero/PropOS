import { beforeEach, describe, expect, it } from "vitest";
import { getNavApp, navHref, setNavApp } from "./nav-app";

describe("nav-app", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to Maps, which every phone can open", () => {
    // Waze is a deliberate choice; Maps is the one that always resolves.
    expect(getNavApp()).toBe("maps");
  });

  it("remembers the broker's choice", () => {
    setNavApp("waze");
    expect(getNavApp()).toBe("waze");
  });

  it("ignores a stored value that is not an app", () => {
    localStorage.setItem("propos:nav-app", "apple");
    expect(getNavApp()).toBe("maps");
  });

  it("encodes the address rather than pasting it into a URL", () => {
    // Chilean addresses carry commas, accents and #.
    const href = navHref("Gran Avenida 1575, Ñuñoa", "maps");
    expect(href).toContain("Gran%20Avenida%201575");
    expect(href).not.toContain(" ");
  });

  it("has no link when there is no address", () => {
    expect(navHref(null, "maps")).toBeNull();
    expect(navHref("   ", "waze")).toBeNull();
  });
});
