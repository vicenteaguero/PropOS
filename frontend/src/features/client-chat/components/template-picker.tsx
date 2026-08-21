import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Row } from "@shared/ui";
import { useMessageTemplates, useSendTemplate } from "../hooks/use-client-chat";

/**
 * What you can still send once the 24 h window has closed.
 *
 * WhatsApp only allows free text within 24 h of the client's last message;
 * after that, an approved template is the only thing Meta will deliver. The
 * inbox used to disable the composer and stop there, which turned a closed
 * window into a lost customer — the broker could see the thread and had no way
 * to answer it.
 */
export function TemplatePicker({ conversationId }: { conversationId: string }) {
  const { data = [], isPending } = useMessageTemplates(true);
  const send = useSendTemplate(conversationId);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setOpen(true)}>
        <Send className="size-4" strokeWidth={1.8} />
        Enviar una plantilla aprobada
      </Button>
    );
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="py-2 text-[13px] text-muted-foreground">
        No hay plantillas aprobadas. Se crean en Configuración y las aprueba Meta.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {data.map((template, i) => (
        <Row
          key={template.name}
          divider={i < data.length - 1}
          title={template.name}
          // The body, not the name: a broker is choosing what the client will
          // read, and template names are internal identifiers.
          sub={<span className="block truncate">{template.body}</span>}
          onClick={() =>
            send.mutate({ name: template.name, variables: {} }, { onSuccess: () => setOpen(false) })
          }
        />
      ))}
      <div className="p-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
