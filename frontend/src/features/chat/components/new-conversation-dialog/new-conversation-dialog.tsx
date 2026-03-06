import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@shared/hooks/use-auth";
import { createConversation, listTenantUsers } from "@features/chat/services/chat-api";
import { CONVERSATIONS_QUERY_KEY } from "@features/chat/hooks/use-conversations";
import { cn } from "@/lib/utils";

interface NewConversationDialogProps {
  onCreated: (conversationId: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function NewConversationDialog({ onCreated }: NewConversationDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const { data: users } = useQuery({
    queryKey: ["tenant-users"],
    queryFn: listTenantUsers,
    enabled: open,
  });

  const { mutate: create, isPending } = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("No autenticado");
      const participantIds = [user.id, ...selected];
      return createConversation(null, participantIds, user.tenantId);
    },
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      setOpen(false);
      setSelected([]);
      setSearch("");
      onCreated(conv.id);
    },
  });

  const filteredUsers = (users ?? []).filter(
    (u) =>
      u.id !== user?.id &&
      u.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleUser(userId: string) {
    setSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost">
          <Plus className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva conversacion</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Buscar usuarios..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ScrollArea className="max-h-60">
          <div className="flex flex-col gap-1">
            {filteredUsers.map((u) => {
              const isSelected = selected.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUser(u.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/50",
                    isSelected && "bg-accent",
                  )}
                >
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(u.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{u.fullName}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground uppercase">
                      {u.role}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredUsers.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No se encontraron usuarios
              </p>
            )}
          </div>
        </ScrollArea>
        <Button
          onClick={() => create()}
          disabled={selected.length === 0 || isPending}
          className="w-full"
        >
          {isPending ? "Creando..." : "Crear conversacion"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
