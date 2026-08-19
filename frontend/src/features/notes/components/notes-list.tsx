import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCreateNote, useDeleteNote, useNotes } from "../hooks/use-notes";
import { ErrorState } from "@shared/ui";
import { formatDateTime } from "@shared/utils/format";

interface Props {
  targetTable: string;
  targetRowId: string;
}

export function NotesList({ targetTable, targetRowId }: Props) {
  const { data, isLoading, error, refetch } = useNotes({
    target_table: targetTable,
    target_row_id: targetRowId,
  });
  const create = useCreateNote();
  const del = useDeleteNote();
  const [body, setBody] = useState("");

  const add = async () => {
    if (!body.trim()) return;
    await create.mutateAsync({
      body: body.trim(),
      target_table: targetTable,
      target_row_id: targetRowId,
    });
    setBody("");
    toast.success("Nota agregada");
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Textarea
          aria-label="Nueva nota"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Escribí una nota…"
        />
        <Button onClick={add} disabled={create.isPending} className="gap-2 self-end">
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && <ErrorState message="Error al cargar." onRetry={() => refetch()} compact />}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">Sin notas.</p>
      )}
      {!isLoading && !error && data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-2 rounded-md border p-3">
              <div className="min-w-0">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(n.created_at)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground"
                onClick={() => del.mutate(n.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
