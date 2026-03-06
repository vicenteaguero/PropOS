import { Mail, Phone, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@shared/components/page-header/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import type { ContactType } from "@features/contacts/types";

const TYPE_LABELS: Record<ContactType, string> = {
  LANDOWNER: "Propietario",
  BUYER: "Comprador",
  SELLER: "Vendedor",
  TENANT: "Arrendatario",
  AGENT: "Agente",
  INVESTOR: "Inversionista",
  OTHER: "Otro",
};

const TYPE_VARIANTS: Record<ContactType, "default" | "secondary" | "outline"> = {
  LANDOWNER: "default",
  BUYER: "default",
  SELLER: "secondary",
  TENANT: "outline",
  AGENT: "default",
  INVESTOR: "secondary",
  OTHER: "outline",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function ContactsListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ContactsPage() {
  const { data: contacts, isLoading, isError, refetch } = useContacts();

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader title="Contactos" description="Gestiona tus contactos y clientes" />

      {isLoading && <ContactsListSkeleton />}

      {isError && (
        <EmptyState
          title="Error al cargar"
          description="No se pudieron cargar los contactos. Intentalo de nuevo."
          actionLabel="Reintentar"
          onAction={() => { refetch(); }}
        />
      )}

      {!isLoading && !isError && (!contacts || contacts.length === 0) && (
        <EmptyState
          title="Sin contactos"
          description="Aun no hay contactos registrados en el sistema."
        />
      )}

      {contacts && contacts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => (
            <Card key={contact.id} className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-start gap-3 p-4">
                <Avatar size="lg">
                  <AvatarFallback>{getInitials(contact.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{contact.full_name}</p>
                    <Badge variant={TYPE_VARIANTS[contact.type]}>
                      {TYPE_LABELS[contact.type]}
                    </Badge>
                  </div>
                  {contact.email && (
                    <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Mail className="size-3 shrink-0" />
                      {contact.email}
                    </p>
                  )}
                  {contact.phone && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="size-3 shrink-0" />
                      {contact.phone}
                    </p>
                  )}
                  {!contact.email && !contact.phone && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="size-3 shrink-0" />
                      Sin datos de contacto
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
