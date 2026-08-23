import { describe, expect, it } from "vitest";
import { extractLinks, linkLabel } from "./links";

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
