import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@features/documents/api/http";
import { useViewAs } from "@core/view-as/view-as";
import type { UserRole } from "@shared/types/auth";

interface AdminUserRow {
  id: string;
  full_name: string;
  role: UserRole;
  email: string | null;
  is_active: boolean;
  admin_scope?: string[] | null;
}

export function ViewAsPicker() {
  const { start } = useViewAs();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const usersQuery = useQuery({
    queryKey: ["users", "all"],
    queryFn: () => apiRequest<AdminUserRow[]>("/v1/users"),
    enabled: open,
  });

  const filtered = (usersQuery.data ?? [])
    .filter((u) => u.is_active)
    .filter((u) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return (
        u.full_name?.toLowerCase().includes(needle) ||
        u.email?.toLowerCase().includes(needle) ||
        u.role.toLowerCase().includes(needle)
      );
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <UserCog className="size-4" />
          Ver como…
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ver como otro usuario</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, email o rol…"
            autoFocus
          />
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {usersQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  start({
                    id: u.id,
                    fullName: u.full_name || u.email || "(sin nombre)",
                    role: u.role,
                    adminScope: u.admin_scope ?? [],
                  });
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span>
                  <span className="block font-medium">{u.full_name || "(sin nombre)"}</span>
                  <span className="block text-xs text-muted-foreground">{u.email}</span>
                </span>
                <span className="text-xs uppercase text-muted-foreground">{u.role}</span>
              </button>
            ))}
            {!usersQuery.isLoading && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin resultados.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
