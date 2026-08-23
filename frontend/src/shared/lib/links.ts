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
