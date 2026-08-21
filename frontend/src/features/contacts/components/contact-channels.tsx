import { useEffect, useRef, useState } from "react";
import { Mail, Phone, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HOVER_REVEAL, RoundButton, SwipeAction } from "@shared/ui";
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

  // "Principal" only means something when there is an alternative. On a person
  // with one number it is a badge that distinguishes nothing.
  const showPrimary = { phone: data.phones.length > 1, email: data.emails.length > 1 };

  /** Phones and e-mails as one list, so the row is written once. */
  const channels = [
    ...data.phones.map((p) => ({
      id: `phone-${p.id}`,
      icon: Phone,
      value: p.e164,
      href: `tel:${p.e164}`,
      label: p.label,
      primary: p.is_primary && showPrimary.phone,
      remove: () => removePhone.mutate(p.id),
    })),
    ...data.emails.map((e) => ({
      id: `email-${e.id}`,
      icon: Mail,
      value: e.address,
      href: `mailto:${e.address}`,
      label: null as string | null,
      primary: e.is_primary && showPrimary.email,
      remove: () => removeEmail.mutate(e.id),
    })),
  ];

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
    <div>
      {/* Each way to reach the person is a real row, not a 20px text link with
          a hover-revealed bin beside it. On a touch screen there is no hover,
          so that bin was permanently visible and was the largest target in the
          row — a destructive one, next to a phone number a broker is trying to
          tap to CALL. The row now performs the useful action; removing is a
          deliberate sideways drag. */}
      {channels.map((c) => (
        <SwipeAction
          key={c.id}
          tone="destructive"
          icon={<Trash2 className="size-[18px]" strokeWidth={1.9} />}
          label="Quitar"
          onAction={() => c.remove()}
          className="group"
        >
          <a
            href={c.href}
            className="flex min-h-11 items-center gap-3 border-b border-border py-2 text-sm last:border-b-0"
          >
            <c.icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] text-foreground">{c.value}</span>
              {(c.label || c.primary) && (
                <span className="flex items-center gap-1.5 text-[12px] text-faint">
                  {c.label}
                  {c.primary && (
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="size-3" strokeWidth={2.2} />
                      Principal
                    </span>
                  )}
                </span>
              )}
            </span>
          </a>
          {/* Pointer fallback: a mouse has no swipe. */}
          <RoundButton
            tone="ghost"
            size={30}
            aria-label={`Quitar ${c.value}`}
            className={`absolute right-0 top-1/2 -translate-y-1/2 [@media(pointer:coarse)]:hidden ${HOVER_REVEAL}`}
            onClick={() => c.remove()}
          >
            <Trash2 className="size-4 text-muted-foreground" strokeWidth={1.8} />
          </RoundButton>
        </SwipeAction>
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
