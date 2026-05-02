import { useState } from "react";
import { toast } from "sonner";
import { Building2, User, Folder, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAddAssignment } from "../hooks/use-documents";
import {
  useContacts,
  useCreateDraftContact,
  useCreateDraftProperty,
  useInternalAreas,
  useProperties,
} from "../hooks/use-entities";

interface Props {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "PROPERTY" | "CONTACT" | "INTERNAL_AREA";

export function AssignmentPicker({ documentId, open, onOpenChange }: Props) {
  const [tab, setTab] = useState<Tab>("PROPERTY");
  const [query, setQuery] = useState("");

  const { data: properties = [] } = useProperties(query);
  const { data: contacts = [] } = useContacts(query);
  const { data: areas = [] } = useInternalAreas();
  const addAssignment = useAddAssignment(documentId);
  const createProperty = useCreateDraftProperty();
  const createContact = useCreateDraftContact();

  const reset = () => {
    setQuery("");
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const assign = async (params: {
    target_kind: Tab;
    contact_id?: string;
    property_id?: string;
    internal_area_id?: string;
  }) => {
    try {
      await addAssignment.mutateAsync(params);
      toast.success("Vínculo agregado");
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const createDraftAndAssign = async () => {
    if (!query.trim()) {
      toast.error("Escribe un nombre primero");
      return;
    }
    try {
      if (tab === "PROPERTY") {
        const p = await createProperty.mutateAsync(query);
        await assign({ target_kind: "PROPERTY", property_id: p.id });
      } else if (tab === "CONTACT") {
        const c = await createContact.mutateAsync(query);
        await assign({ target_kind: "CONTACT", contact_id: c.id });
      } else {
        toast.error("Las áreas internas se crean en la sección Admin");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular documento</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-1 rounded-md border border-border p-0.5">
          <Button
            size="sm"
            variant={tab === "PROPERTY" ? "secondary" : "ghost"}
            onClick={() => setTab("PROPERTY")}
          >
            <Building2 className="size-4" /> Propiedad
          </Button>
          <Button
            size="sm"
            variant={tab === "CONTACT" ? "secondary" : "ghost"}
            onClick={() => setTab("CONTACT")}
          >
            <User className="size-4" /> Contacto
          </Button>
          <Button
            size="sm"
            variant={tab === "INTERNAL_AREA" ? "secondary" : "ghost"}
            onClick={() => setTab("INTERNAL_AREA")}
          >
            <Folder className="size-4" /> Área
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Buscar / crear</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "PROPERTY"
                ? "Av. Reñaca 115"
                : tab === "CONTACT"
                  ? "Jaime Pérez"
                  : "Filtrar áreas..."
            }
          />
        </div>

        <ScrollArea className="max-h-64 rounded-md border border-border">
          {tab === "PROPERTY" &&
            properties.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => assign({ target_kind: "PROPERTY", property_id: p.id })}
                className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <Building2 className="size-4 text-primary/70" />
                <span className="flex-1 truncate">{p.title}</span>
                {p.is_draft && (
                  <span className="text-[10px] uppercase text-muted-foreground">borrador</span>
                )}
              </button>
            ))}
          {tab === "CONTACT" &&
            contacts.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => assign({ target_kind: "CONTACT", contact_id: c.id })}
                className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <User className="size-4 text-primary/70" />
                <span className="flex-1 truncate">{c.full_name}</span>
                {c.is_draft && (
                  <span className="text-[10px] uppercase text-muted-foreground">borrador</span>
                )}
              </button>
            ))}
          {tab === "INTERNAL_AREA" &&
            areas
              .filter((a) => !query || a.name.toLowerCase().includes(query.toLowerCase()))
              .map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => assign({ target_kind: "INTERNAL_AREA", internal_area_id: a.id })}
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <Folder className="size-4 text-primary/70" />
                  <span className="flex-1 truncate">{a.name}</span>
                </button>
              ))}
        </ScrollArea>

        {tab !== "INTERNAL_AREA" && query.trim() && (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={createDraftAndAssign}
            disabled={
              createProperty.isPending || createContact.isPending || addAssignment.isPending
            }
          >
            <Plus className="size-4" />
            Crear borrador y vincular: {query}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
