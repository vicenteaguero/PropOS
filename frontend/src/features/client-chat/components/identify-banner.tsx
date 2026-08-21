import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@shared/components/search-input/search-input";
import { Row } from "@shared/ui";
import { useEntitySearch } from "@shared/api/entity-search";
import { useDebounced } from "@shared/hooks/use-debounced";
import { useLinkConversationContact } from "../hooks/use-client-chat";
import type { ClientConversation } from "../types";

/**
 * "We do not know who this is yet."
 *
 * Shown on a thread whose `contact_id` is null. Until now that state could not
 * exist: an unknown number silently minted a contact named after its own phone
 * number, typed BUYER because the column needed something, with no consent
 * evidence. The junk was indistinguishable from a real person in the list.
 *
 * Identifying is now a decision somebody makes, and it is one tap: the number
 * gets filed under the person, so the next message from that same line lands
 * on them instead of coming back here.
 */
export function IdentifyBanner({ conversation }: { conversation: ClientConversation }) {
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim(), 200);
  const searching = term.length >= 2;
  const hits = useEntitySearch("CONTACT", term, searching);
  const link = useLinkConversationContact();

  const whatsappName =
    typeof conversation.metadata?.whatsapp_name === "string"
      ? conversation.metadata.whatsapp_name
      : null;

  return (
    <div className="border-b border-border bg-warning/10 px-[var(--page-x)] py-3">
      <div className="flex flex-wrap items-center gap-2">
        <UserPlus className="size-4 shrink-0 text-warning" strokeWidth={1.9} />
        <span className="text-[13px] font-semibold text-foreground">Sin identificar</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
          {whatsappName ? `WhatsApp dice «${whatsappName}»` : conversation.external_phone_e164}
        </span>
      </div>

      <div className="mt-2.5">
        <SearchInput
          value={query}
          onChange={setQuery}
          variant="inline"
          debounceMs={0}
          ariaLabel="Buscar la persona"
          placeholder="Buscar a quién pertenece este número…"
        />
      </div>

      {searching && (
        <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
          {hits.isPending ? (
            <p className="px-3 py-2 text-[13px] text-muted-foreground">Buscando…</p>
          ) : (hits.data ?? []).length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-muted-foreground">
              Nadie con ese nombre. Créala como persona nueva.
            </p>
          ) : (
            (hits.data ?? [])
              .slice(0, 5)
              .map((hit, i, all) => (
                <Row
                  key={hit.id}
                  divider={i < all.length - 1}
                  title={hit.label}
                  sub={hit.sub ?? undefined}
                  onClick={() => link.mutate({ id: conversation.id, contactId: hit.id })}
                />
              ))
          )}
        </div>
      )}

      {!searching && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 gap-2"
          onClick={() => setQuery(whatsappName ?? "")}
        >
          <UserPlus className="size-4" strokeWidth={1.8} />
          Vincular a una persona
        </Button>
      )}
    </div>
  );
}
