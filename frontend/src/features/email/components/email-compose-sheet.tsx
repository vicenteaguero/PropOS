import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveSheet, FOCUS_RING } from "@shared/ui";
import { EntityCombobox } from "@features/documents/components/entity-combobox";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import type { Contact } from "@features/contacts/types";
import { toast } from "sonner";
import { useSendEmail } from "../hooks/use-email";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the created thread id so the caller can select it. */
  onSent?: (threadId: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Contacts are shown as "name — email"; free text is accepted as a raw address. */
function contactLabel(contact: Contact): string {
  return contact.email ? `${contact.full_name} — ${contact.email}` : contact.full_name;
}

/**
 * Compose sheet for a first-contact email. The recipient comes either from a
 * contact (which also links the thread to the CRM) or from a typed address.
 */
export function EmailComposeSheet({ open, onOpenChange, onSent }: Props) {
  const [recipientText, setRecipientText] = useState("");
  const [contact, setContact] = useState<Contact | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const send = useSendEmail();
  const { data: contacts, isLoading: contactsLoading } = useContacts({
    q: recipientText,
    limit: 8,
  });

  const options = useMemo(() => (contacts ?? []).filter((c) => !!c.email), [contacts]);
  const to = (contact?.email ?? recipientText).trim();
  const canSend = EMAIL_RE.test(to) && subject.trim().length > 0 && body.trim().length > 0;

  const reset = () => {
    setRecipientText("");
    setContact(null);
    setSubject("");
    setBody("");
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    if (!canSend) return;
    const thread = await send.mutateAsync({
      to,
      subject: subject.trim(),
      body: body.trim(),
      contact_id: contact?.id ?? null,
    });
    toast.success("Correo enviado");
    reset();
    onOpenChange(false);
    onSent?.(thread.id);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={close}
      title="Nuevo correo"
      description="Escribile a un contacto sin esperar a que te escriba primero."
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="compose-to">Para</Label>
          <EntityCombobox<Contact>
            value={recipientText}
            onChange={(text) => {
              setRecipientText(text);
              setContact(null);
            }}
            onSelect={(item) => setContact(item)}
            items={options}
            getLabel={contactLabel}
            getKey={(c) => c.id}
            loading={contactsLoading}
            placeholder="Contacto o correo"
            emptyText="Sin contactos: escribe el correo completo"
            ariaLabel="Destinatario"
          />
          {!!to && !EMAIL_RE.test(to) && (
            <p className="text-[12px] text-muted-foreground">
              Elige un contacto o escribe una dirección válida.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="compose-subject">Asunto</Label>
          <Input
            id="compose-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Asunto del correo"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="compose-body">Mensaje</Label>
          <textarea
            id="compose-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            placeholder="Escribe tu mensaje…"
            className={`w-full resize-none rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-foreground transition placeholder:text-muted-foreground ${FOCUS_RING}`}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(false)} disabled={send.isPending}>
            Cancelar
          </Button>
          <Button className="gap-2" onClick={submit} disabled={!canSend || send.isPending}>
            {send.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" strokeWidth={1.8} />
            )}
            {send.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
