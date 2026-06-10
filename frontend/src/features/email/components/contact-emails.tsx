import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <ul className="space-y-2">
      {data.map((t) => (
        <li key={t.id}>
          <button
            onClick={() => navigate(`/${role}/correos`)}
            className="flex w-full items-center justify-between gap-2 rounded-md border p-3 text-left text-sm hover:bg-muted/50"
          >
            <span className="truncate">{t.subject || "(sin asunto)"}</span>
            {t.portal && (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {t.portal}
              </Badge>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
