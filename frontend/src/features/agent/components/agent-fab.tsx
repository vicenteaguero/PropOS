import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { AgentDrawer } from "./agent-drawer";

export function AgentFAB() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (location.pathname.startsWith("/admin/agent")) return null;

  return (
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg p-0"
        aria-label="Abrir Agente"
      >
        <Sparkles className="size-6" />
      </Button>
      <AgentDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
