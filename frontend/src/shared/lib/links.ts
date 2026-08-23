const URL_RE = /https?:\/\/[^\s<>"')]+/gi;

/** Every URL in a block of text, de-duplicated, in order of appearance. */
export function extractLinks(text: string | null | undefined): string[] {
  if (!text) return [];
  return Array.from(new Set(text.match(URL_RE) ?? []));
}

/** "propos.cl" from "https://www.propos.cl/x?y=1" — a label a person can read. */
export function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * What a person types into a "pegar link" field, turned into a URL.
 *
 * Nobody pastes `https://`. They paste `portalinmobiliario.cl/MLC-123`, or a
 * whole line copied out of WhatsApp with a space on the end. Returning `null`
 * for anything that is not a link is the point: the caller uses it to decide
 * whether the paste was a link at all.
 */
export function normalizeUrl(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  // Only the two schemes a broker can act on. `javascript:` and `data:` reach
  // here from a paste and would otherwise become an anchor we render.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  // A hostname with no dot is a typo, not a domain — except `localhost`, which
  // is how this gets tested.
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
  return url.toString();
}
