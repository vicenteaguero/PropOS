import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { BrandMark, Pill, Row } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";
import { useEmailThreads } from "../hooks/use-email";

export function ContactEmails({ contactId }: { contactId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";
  const { data, isLoading } = useEmailThreads({ contact_id: contactId });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Sin correos.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {data.map((t, i) => (
        <Row
          key={t.id}
          divider={i < data.length - 1}
          onClick={() => navigate(`/${role}/crm?tab=bandeja`)}
          left={
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary">
              <BrandMark brand="titan" size={22} />
            </span>
          }
          title={t.subject || "(sin asunto)"}
          right={t.portal ? <Pill tone="accent">{t.portal}</Pill> : undefined}
        />
      ))}
    </div>
  );
}
