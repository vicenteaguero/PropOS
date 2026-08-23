import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@shared/ui";
import { DealSummary } from "./deal-summary";

interface DealSheetProps {
  dealId: string | null;
  role: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The deal, opened in place.
 *
 * Reaching a deal used to mean navigating to `/negocios/:id`, which is fine
 * when the deal is what you came for and wrong when it is context for
 * something else — you lose the event, the document or the note you were
 * looking at, and Back is the only way home. This answers the question and
 * leaves the user where they were, with a link out for when they do want the
 * full file.
 */
export function DealSheet({ dealId, role, open, onOpenChange }: DealSheetProps) {
  const navigate = useNavigate();
  if (!dealId) return null;
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Negocio"
      desktopClassName="max-w-lg"
    >
      <div className="mt-1">
        <DealSummary
          dealId={dealId}
          role={role}
          onNavigate={() => onOpenChange(false)}
          footer={
            <Button
              variant="secondary"
              size="block"
              className="rounded-full"
              onClick={() => {
                onOpenChange(false);
                navigate(`/${role}/negocios/${dealId}`);
              }}
            >
              Ver ficha completa
            </Button>
          }
        />
      </div>
    </ResponsiveSheet>
  );
}
