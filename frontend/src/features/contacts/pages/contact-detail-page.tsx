import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { useAuth } from "@shared/hooks/use-auth";
import { toast } from "sonner";
import { InteractionsList } from "@features/interactions/components/interactions-list";
import { NotesList } from "@features/notes/components/notes-list";
import { useContact, useDeleteContact, useUpdateContact } from "../hooks/use-contacts";
import { ContactFormDialog } from "../components/contact-form-dialog";
import { ContactOpportunities } from "../components/contact-opportunities";
import { CONTACT_TYPE_LABELS } from "../types";

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const { data: contact, isLoading, error, refetch } = useContact(id);
  const update = useUpdateContact(id ?? "");
  const del = useDeleteContact();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return (
      <PageLayout width="lg">
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (error || !contact) {
    return (
      <PageLayout width="lg">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudo cargar el contacto.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="lg">
      <PageHeader
        title={contact.full_name}
        backTo={`/${role}/personas`}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-x-8 gap-y-2 pt-6 text-sm">
          <Badge variant="outline">{CONTACT_TYPE_LABELS[contact.type]}</Badge>
          {contact.phone && <span>📞 {contact.phone}</span>}
          {contact.email && <span>✉️ {contact.email}</span>}
          {contact.rut && <span>RUT {contact.rut}</span>}
          {contact.address && <span>📍 {contact.address}</span>}
          <Link
            to={`/${role}/timeline/contacts/${contact.id}`}
            className="text-primary hover:underline"
          >
            Ver línea de tiempo
          </Link>
        </CardContent>
      </Card>

      <Tabs defaultValue="interacciones">
        <TabsList>
          <TabsTrigger value="interacciones">Interacciones</TabsTrigger>
          <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="correos">Correos</TabsTrigger>
        </TabsList>
        <TabsContent value="interacciones" className="mt-4">
          <InteractionsList personId={contact.id} />
        </TabsContent>
        <TabsContent value="oportunidades" className="mt-4">
          <ContactOpportunities personId={contact.id} />
        </TabsContent>
        <TabsContent value="notas" className="mt-4">
          <NotesList targetTable="contacts" targetRowId={contact.id} />
        </TabsContent>
        <TabsContent value="correos" className="mt-4">
          <p className="py-6 text-center text-sm text-muted-foreground">Disponible próximamente.</p>
        </TabsContent>
      </Tabs>

      <ContactFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contact={contact}
        pending={update.isPending}
        onSubmit={async (input) => {
          await update.mutateAsync(input);
          toast.success("Contacto actualizado");
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              {contact.full_name} se archivará. Esta acción se puede revertir desde el administrador
              de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await del.mutateAsync(contact.id);
                toast.success("Contacto eliminado");
                navigate(`/${role}/personas`);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
