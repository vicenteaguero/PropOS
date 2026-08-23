import { Fragment } from "react";
import { cn } from "@/lib/utils";

// Plain-text bodies only — there is no rich-text editor and there will not be
// one. Trailing punctuation is excluded so "mira https://x.cl/y." keeps the dot
// out of the href.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
const TRAILING = /[.,;:!?)\]}'"»]+$/;

interface Props {
  body: string;
  className?: string;
}

/** Note text with bare URLs turned into links. Whitespace is preserved. */
export function NoteBody({ body, className }: Props) {
  const parts = body.split(URL_RE);

  return (
    <p className={cn("break-words whitespace-pre-wrap", className)}>
      {parts.map((part, i) => {
        // Odd indices are the captured URLs; even ones are the text between.
        if (i % 2 === 0 || !part) return <Fragment key={i}>{part}</Fragment>;
        const trailing = part.match(TRAILING)?.[0] ?? "";
        const url = trailing ? part.slice(0, -trailing.length) : part;
        return (
          <Fragment key={i}>
            <a
              href={url.startsWith("www.") ? `https://${url}` : url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-primary underline underline-offset-2"
            >
              {url}
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </p>
  );
}
