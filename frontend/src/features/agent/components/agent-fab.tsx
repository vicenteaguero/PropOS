import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { AgentOverlay } from "./agent-overlay";

export function AgentFAB() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // The full agent page already is the assistant — no FAB there.
  if (location.pathname.endsWith("/agent")) return null;

  return (
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 size-14 rounded-full p-0 shadow-lg"
        aria-label="Abrir Propo"
      >
        <Sparkles className="size-6" />
      </Button>
      {open && <AgentOverlay onClose={() => setOpen(false)} />}
    </>
  );
}
