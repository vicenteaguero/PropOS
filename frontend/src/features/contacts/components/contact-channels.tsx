import { useEffect, useRef, useState } from "react";
import { Mail, Phone, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HOVER_REVEAL, Pill, RoundButton } from "@shared/ui";
import {
  useAddContactEmail,
  useAddContactPhone,
  useContactChannels,
  useRemoveContactEmail,
  useRemoveContactPhone,
} from "../hooks/use-contacts";

/**
 * Every way to reach a person, instead of one of each.
 *
 * `contacts.phone` and `contacts.email` were single columns, so a person's
 * second line was a different person: the WhatsApp webhook matched the column
 * exactly, missed, and created a whole new contact. The scalar columns survive
 * as a mirror of whichever row is primary here.
 */
export function ContactChannels({ contactId }: { contactId: string }) {
  const { data, isLoading } = useContactChannels(contactId);
  const addPhone = useAddContactPhone(contactId);
  const addEmail = useAddContactEmail(contactId);
  const removePhone = useRemoveContactPhone(contactId);
  const removeEmail = useRemoveContactEmail(contactId);
  const [adding, setAdding] = useState<"phone" | "email" | null>(null);
  const [draft, setDraft] = useState("");
  // Focus on mount rather than `autoFocus`: the prop moves focus on every
  // render a screen reader may not have narrated yet, and the lint rule is
  // right about that. This runs once, when the field appears because the user
  // asked for it.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  if (isLoading || !data) return null;

  const submit = () => {
    const value = draft.trim();
    if (!value) return;
    const mutation = adding === "phone" ? addPhone : addEmail;
    mutation.mutate(
      { value, label: null },
      {
        onSuccess: () => {
          setDraft("");
          setAdding(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo agregar"),
      },
    );
  };

  return (
    <div className="mx-[var(--page-x)] mb-5 space-y-1 rounded-xl bg-card p-4">
      {data.phones.map((phone) => (
        <div key={phone.id} className="group flex items-center gap-3 text-sm">
          <Phone className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
          <a href={`tel:${phone.e164}`} className="text-foreground hover:underline">
            {phone.e164}
          </a>
          {phone.label && <span className="text-[12px] text-faint">{phone.label}</span>}
          {phone.is_primary && (
            <Pill tone="neutral">
              <Star className="size-3" strokeWidth={2.2} />
              Principal
            </Pill>
          )}
          <RoundButton
            tone="ghost"
            size={30}
            aria-label={`Quitar ${phone.e164}`}
            className={`ml-auto ${HOVER_REVEAL}`}
            onClick={() => removePhone.mutate(phone.id)}
          >
            <Trash2 className="size-4 text-muted-foreground" strokeWidth={1.8} />
          </RoundButton>
        </div>
      ))}

      {data.emails.map((email) => (
        <div key={email.id} className="group flex items-center gap-3 text-sm">
          <Mail className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
          <a
            href={`mailto:${email.address}`}
            className="min-w-0 truncate text-foreground hover:underline"
          >
            {email.address}
          </a>
          {email.is_primary && (
            <Pill tone="neutral">
              <Star className="size-3" strokeWidth={2.2} />
              Principal
            </Pill>
          )}
          <RoundButton
            tone="ghost"
            size={30}
            aria-label={`Quitar ${email.address}`}
            className={`ml-auto ${HOVER_REVEAL}`}
            onClick={() => removeEmail.mutate(email.id)}
          >
            <Trash2 className="size-4 text-muted-foreground" strokeWidth={1.8} />
          </RoundButton>
        </div>
      ))}

      {adding ? (
        <div className="flex items-center gap-2 pt-2">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={adding === "phone" ? "+56 9 1234 5678" : "nombre@correo.cl"}
            aria-label={adding === "phone" ? "Nuevo teléfono" : "Nuevo correo"}
            className="h-9"
          />
          <Button size="sm" onClick={submit}>
            Agregar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setAdding("phone")}
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Teléfono
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setAdding("email")}
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Correo
          </Button>
        </div>
      )}
    </div>
  );
}
