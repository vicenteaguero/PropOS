import { describe, expect, it } from "vitest";
import { extractLinks, linkLabel, normalizeUrl } from "./links";

describe("extractLinks", () => {
  it("finds urls in free text", () => {
    expect(extractLinks("mira https://propos.cl/x y esto")).toEqual(["https://propos.cl/x"]);
  });

  it("de-duplicates repeats", () => {
    expect(extractLinks("a https://x.cl b https://x.cl")).toEqual(["https://x.cl"]);
  });

  it("does not swallow a trailing paren or quote", () => {
    // Chilean brokers paste links inside parentheses constantly.
    expect(extractLinks("(https://portalinmobiliario.cl/abc)")).toEqual([
      "https://portalinmobiliario.cl/abc",
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(extractLinks(null)).toEqual([]);
    expect(extractLinks("")).toEqual([]);
    expect(extractLinks("sin links")).toEqual([]);
  });
});

describe("linkLabel", () => {
  it("strips scheme and www", () => {
    expect(linkLabel("https://www.propos.cl/a/b?c=1")).toBe("propos.cl");
  });

  it("falls back to the raw string when unparseable", () => {
    expect(linkLabel("http://")).toBe("http://");
  });
});

describe("normalizeUrl", () => {
  it("adds the scheme nobody types", () => {
    expect(normalizeUrl("portalinmobiliario.cl/MLC-123")).toBe(
      "https://portalinmobiliario.cl/MLC-123",
    );
  });

  it("keeps a scheme that is already there", () => {
    expect(normalizeUrl("http://propos.cl/x?y=1")).toBe("http://propos.cl/x?y=1");
  });

  it("trims the whitespace a WhatsApp copy leaves behind", () => {
    expect(normalizeUrl("  https://propos.cl  ")).toBe("https://propos.cl/");
  });

  it("rejects anything that is not a link, so the caller can tell", () => {
    for (const bad of [null, undefined, "", "   ", "llamar al cliente", "hola mundo"]) {
      expect(normalizeUrl(bad)).toBeNull();
    }
  });

  it("rejects a hostname with no dot", () => {
    expect(normalizeUrl("recordatorio")).toBeNull();
  });

  it("refuses a scheme we would render as an anchor", () => {
    // Pasted from anywhere, this becomes an <a href> we ship to the user.
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });
});
