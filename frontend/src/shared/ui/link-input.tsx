import { useState } from "react";
import { Link2, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { linkLabel, normalizeUrl } from "@shared/lib/links";
import { CONTROL_H } from "./touch-target";
import { FOCUS_RING } from "./focus-ring";

interface LinkInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Links as a field, not as prose to be mined afterwards.
 *
 * Tasks used to find their links by running a regex over the description, which
 * meant a link could not be added without editing the paragraph around it,
 * could not be removed at all, and vanished the moment someone rewrote the
 * sentence it lived in. Notes had the same shape and no way to add one.
 *
 * Shared by both, so a link behaves identically wherever it is pasted: typed or
 * pasted text is normalised (`portal.cl/x` becomes `https://portal.cl/x`), a
 * paste commits immediately, and each link shows the domain rather than 90
 * characters of query string.
 */
export function LinkInput({
  value,
  onChange,
  placeholder = "Pega un link…",
  className,
}: LinkInputProps) {
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  const commit = (raw: string) => {
    const url = normalizeUrl(raw);
    if (!url) {
      setInvalid(raw.trim().length > 0);
      return false;
    }
    setInvalid(false);
    setDraft("");
    if (!value.includes(url)) onChange([...value, url]);
    return true;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.8}
          />
          <Input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Pegar un link"
            aria-invalid={invalid || undefined}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => {
              setDraft(e.target.value);
              setInvalid(false);
            }}
            // A paste is the whole interaction here: the user has the URL on the
            // clipboard and nothing else to add, so asking them to then press
            // Enter is a step that exists only because the field was built as a
            // text box first.
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (normalizeUrl(text)) {
                e.preventDefault();
                commit(text);
              }
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              commit(draft);
            }}
            onBlur={() => draft.trim() && commit(draft)}
            className={cn(CONTROL_H, "pl-9")}
          />
        </div>
        <button
          type="button"
          onClick={() => commit(draft)}
          disabled={!draft.trim()}
          aria-label="Agregar link"
          className={cn(
            CONTROL_H,
            "grid aspect-square shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40",
            FOCUS_RING,
          )}
        >
          <Plus className="size-4" strokeWidth={2} />
        </button>
      </div>

      {invalid && <p className="text-[12px] text-destructive">Eso no parece un link.</p>}

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((url) => (
            <li key={url}>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary py-1 pl-2.5 pr-1 text-[12px]">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {linkLabel(url)}
                </a>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((u) => u !== url))}
                  aria-label={`Quitar ${linkLabel(url)}`}
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground",
                    FOCUS_RING,
                  )}
                >
                  <X className="size-3" strokeWidth={2.2} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
