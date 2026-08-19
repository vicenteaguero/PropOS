import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders the small, fixed subset of Markdown our static legal documents use:
 * `#`/`##` headings, paragraphs, `-` lists, `>` blockquotes, GFM pipe tables,
 * and `**bold**`.
 *
 * It exists to keep `react-markdown` + `remark-gfm` — 159 kB for a single
 * consumer — out of the bundle. That chunk matched the service worker's
 * precache glob, so every user downloaded it on first load for a page almost
 * none of them open.
 *
 * Deliberately NOT a general Markdown renderer: the input is authored in this
 * repo and snapshot-tested, not user content. There is no HTML passthrough and
 * no `dangerouslySetInnerHTML` anywhere below, so untrusted text renders as
 * text. If a document needs a construct this doesn't cover, add it here with a
 * test rather than reaching back for a parser.
 */

/** Splits on `**bold**`, leaving everything else as literal text. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });
}

function tableCells(row: string): string[] {
  return row
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

const isDivider = (row: string) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(row) && row.includes("-");

export function StaticMarkdown({ source, className }: { source: string; className?: string }) {
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const t = line.trim();

    if (!t) {
      i += 1;
      continue;
    }

    // Headings
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) {
      const level = h[1]!.length;
      const text = h[2]!;
      const key = `h-${i}`;
      if (level === 1) {
        blocks.push(
          <h1 key={key} className="mt-0 mb-4 text-3xl font-bold tracking-tight text-foreground">
            {inline(text, key)}
          </h1>,
        );
      } else if (level === 2) {
        blocks.push(
          <h2 key={key} className="mt-8 mb-2 text-xl font-semibold tracking-tight text-foreground">
            {inline(text, key)}
          </h2>,
        );
      } else {
        blocks.push(
          <h3 key={key} className="mt-6 mb-2 text-base font-semibold text-foreground">
            {inline(text, key)}
          </h3>,
        );
      }
      i += 1;
      continue;
    }

    // Pipe table — header row, divider, then body rows.
    if (t.startsWith("|") && isDivider(lines[i + 1]?.trim() ?? "")) {
      const header = tableCells(t);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && (lines[j] ?? "").trim().startsWith("|")) {
        rows.push(tableCells((lines[j] ?? "").trim()));
        j += 1;
      }
      blocks.push(
        <div key={`t-${i}`} className="my-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-secondary/50">
                {header.map((c, ci) => (
                  <th
                    key={ci}
                    scope="col"
                    className="border-b border-border px-3 py-2 text-left font-semibold text-foreground"
                  >
                    {inline(c, `th-${i}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 align-top text-muted-foreground">
                      {inline(c, `td-${i}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      i = j;
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
          {items.map((item, ii) => (
            <li key={ii}>{inline(item, `li-${i}-${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
          {items.map((item, ii) => (
            <li key={ii}>{inline(item, `oli-${i}-${ii}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Blockquote
    if (t.startsWith(">")) {
      const parts: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
        parts.push((lines[i] ?? "").trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className="my-4 border-l-2 border-primary/60 pl-4 text-muted-foreground italic"
        >
          {inline(parts.join(" "), `bq-${i}`)}
        </blockquote>,
      );
      continue;
    }

    // Paragraph — consume until a blank line or the start of another block.
    const parts: string[] = [];
    while (i < lines.length) {
      const cur = (lines[i] ?? "").trim();
      if (!cur || /^(#{1,4}\s|[-*]\s|\d+\.\s|>|\|)/.test(cur)) break;
      parts.push(cur);
      i += 1;
    }
    blocks.push(
      <p key={`p-${i}`} className="my-3 leading-relaxed text-muted-foreground">
        {inline(parts.join(" "), `p-${i}`)}
      </p>,
    );
  }

  return <div className={cn("text-[15px]", className)}>{blocks}</div>;
}
