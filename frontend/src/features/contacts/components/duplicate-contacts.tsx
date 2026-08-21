import { useState } from "react";
import { Merge, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet, Row, SheetActions } from "@shared/ui";
import { useContactDuplicates, useMergeContacts } from "../hooks/use-contacts";
import type { ContactDuplicate } from "../types";

/**
 * People who look like the same person.
 *
 * Detection proposes; a human decides. There is deliberately no unique index
 * on phone or email: a couple sharing a number is real data, and a constraint
 * would reject the row instead of asking about it.
 *
 * Merging is not undoable in one click, so it asks — and it says which way
 * round, because the survivor keeps the id every existing link points at.
 */
export function DuplicateContacts({ onMerged }: { onMerged?: () => void }) {
  const { data = [] } = useContactDuplicates();
  const merge = useMergeContacts();
  const [reviewing, setReviewing] = useState<ContactDuplicate | null>(null);

  if (data.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setReviewing(data[0] ?? null)}
        className="flex w-full items-center gap-3 border-b border-border bg-warning/10 px-[var(--page-x)] py-2.5 text-left transition hover:bg-warning/15"
      >
        <Users className="size-4 shrink-0 text-warning" strokeWidth={1.9} />
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
          {data.length === 1 ? "1 posible duplicado" : `${data.length} posibles duplicados`}
        </span>
        <span className="shrink-0 text-[12px] font-semibold text-warning">Revisar</span>
      </button>

      <ResponsiveSheet
        open={!!reviewing}
        onOpenChange={(open) => !open && setReviewing(null)}
        title="¿Es la misma persona?"
      >
        {reviewing && (
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Coinciden por <span className="font-medium text-foreground">{reviewing.reason}</span>.
            </p>

            <div className="overflow-hidden rounded-xl border border-border">
              <Row title={reviewing.contact_name} sub="Se queda. Conserva el historial de ambas." />
              <Row
                divider={false}
                title={reviewing.duplicate_name}
                sub="Se archiva. Su historial pasa a la de arriba."
              />
            </div>

            <p className="text-[12px] text-faint">
              Se puede revertir desde el administrador de datos, pero no con un clic.
            </p>

            <SheetActions>
              <Button variant="outline" onClick={() => setReviewing(null)}>
                Ahora no
              </Button>
              <Button
                className="gap-2"
                disabled={merge.isPending}
                onClick={() =>
                  merge.mutate(
                    { winnerId: reviewing.contact_id, loserId: reviewing.duplicate_id },
                    {
                      onSuccess: () => {
                        setReviewing(null);
                        onMerged?.();
                      },
                    },
                  )
                }
              >
                <Merge className="size-4" strokeWidth={1.8} />
                Fusionar
              </Button>
            </SheetActions>
          </div>
        )}
      </ResponsiveSheet>
    </>
  );
}
