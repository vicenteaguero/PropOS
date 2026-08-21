import { useState } from "react";
import { Building2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@shared/components/search-input/search-input";
import { HOVER_REVEAL, Row, RoundButton, SectionLabel } from "@shared/ui";
import { useEntitySearch } from "@shared/api/entity-search";
import { useDebounced } from "@shared/hooks/use-debounced";
import {
  useAddConversationTarget,
  useConversationTargets,
  useRemoveConversationTarget,
} from "../hooks/use-client-chat";

/**
 * What this conversation is about.
 *
 * The inbox used to infer it in the browser: join the contact's open
 * opportunities to properties, take the first, and print it as if it were a
 * fact. It is wrong the moment somebody asks about two properties — which is
 * the normal case, not the edge one — and there was nowhere to correct it.
 */
export function ConversationTargets({
  conversationId,
  titleFor,
}: {
  conversationId: string;
  /** Resolves a property id to its title from the list already in cache. */
  titleFor: (id: string) => string | null;
}) {
  const { data = [] } = useConversationTargets(conversationId);
  const add = useAddConversationTarget(conversationId);
  const remove = useRemoveConversationTarget(conversationId);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim(), 200);
  const hits = useEntitySearch("PROPERTY", term, adding && term.length >= 2);

  return (
    <div>
      <SectionLabel>Sobre</SectionLabel>
      <div className="mt-2 overflow-hidden rounded-xl bg-card">
        {data.length === 0 && !adding && (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">
            Sin vincular a una propiedad.
          </p>
        )}

        {data.map((target, i) => (
          <div key={target.id} className="group relative">
            <Row
              divider={i < data.length - 1}
              left={<Building2 className="size-4 text-muted-foreground" strokeWidth={1.8} />}
              title={
                (target.property_id ? titleFor(target.property_id) : null) ?? "Propiedad vinculada"
              }
              className="pr-10"
            />
            <RoundButton
              tone="ghost"
              size={30}
              aria-label="Quitar vínculo"
              className={`absolute top-1/2 right-2 -translate-y-1/2 ${HOVER_REVEAL}`}
              onClick={() => remove.mutate(target.id)}
            >
              <X className="size-4 text-muted-foreground" strokeWidth={1.9} />
            </RoundButton>
          </div>
        ))}

        {adding ? (
          <div className="space-y-2 p-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              variant="inline"
              debounceMs={0}
              ariaLabel="Buscar propiedad"
              placeholder="Buscar propiedad…"
            />
            {(hits.data ?? []).slice(0, 4).map((hit, i, all) => (
              <Row
                key={hit.id}
                divider={i < all.length - 1}
                title={hit.label}
                sub={hit.sub ?? undefined}
                onClick={() => {
                  add.mutate(
                    { target_kind: "PROPERTY", property_id: hit.id },
                    {
                      onSuccess: () => {
                        setQuery("");
                        setAdding(false);
                      },
                    },
                  );
                }}
              />
            ))}
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="p-3">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" strokeWidth={2} />
              Vincular propiedad
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
