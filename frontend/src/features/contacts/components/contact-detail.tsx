import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarPlus,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@shared/hooks/use-auth";
import { ErrorState, PageSkeleton, Pill, RoundButton, Segmented } from "@shared/ui";
import { toast } from "sonner";
import { InteractionsList } from "@features/interactions/components/interactions-list";
import { NotesList } from "@features/notes/components/notes-list";
import { ContactEmails } from "@features/email/components/contact-emails";
import { useContact, useDeleteContact, useUpdateContact } from "../hooks/use-contacts";
import { ContactFormDialog } from "./contact-form-dialog";
import { ContactOpportunities } from "./contact-opportunities";
import { CONTACT_TYPE_LABELS } from "../types";
import { CONTACT_TYPE_TONES } from "@shared/lib/tones";
import { initials } from "@shared/utils/format";

const TABS = [
  { id: "interacciones", label: "Interacciones" },
  { id: "oportunidades", label: "Oportunidades" },
  { id: "notas", label: "Notas" },
  { id: "correos", label: "Correos" },
];

/** Round quick-action button with a label underneath. Disabled when no target. */
function QuickAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <RoundButton tone="muted" size={48} onClick={onClick} disabled={disabled} aria-label={label}>
        {icon}
      </RoundButton>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

interface ContactDetailProps {
  contactId: string;
  /** Back affordance. Mobile route shows a top-left arrow; desktop master-detail hides it. */
  onBack?: () => void;
  /** Called after a successful delete (route page navigates; master-detail clears selection). */
  onDeleted?: () => void;
}

/**
 * Self-contained contact detail body. Used by both the standalone `/personas/:id`
 * route (deep-links) and the desktop master-detail center pane. Owns its own
 * loading / error-retry states so it can drop into any container.
 */
export function ContactDetail({ contactId, onBack, onDeleted }: ContactDetailProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const { data: contact, isLoading, error, refetch } = useContact(contactId);
  const update = useUpdateContact(contactId);
  const del = useDeleteContact();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState("interacciones");

  if (isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  if (error || !contact) {
    return <ErrorState message="No se pudo cargar el contacto." onRetry={() => refetch()} />;
  }

  const phoneDigits = contact.phone?.replace(/[^\d]/g, "") ?? "";
  const openWhatsApp = () => window.open(`https://wa.me/${phoneDigits}`, "_blank");
  const openEmail = () => {
    window.location.href = `mailto:${contact.email}`;
  };
  const openCall = () => {
    window.location.href = `tel:${contact.phone}`;
  };

  return (
    <div className="pb-6">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        {onBack ? (
          <RoundButton tone="ghost" onClick={onBack} aria-label="Volver">
            <ArrowLeft className="size-5" strokeWidth={1.8} />
          </RoundButton>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" strokeWidth={1.8} />
            Editar
          </Button>
          <RoundButton
            tone="ghost"
            onClick={() => setConfirmDelete(true)}
            aria-label="Eliminar contacto"
          >
            <Trash2 className="size-[18px] text-muted-foreground" strokeWidth={1.8} />
          </RoundButton>
        </div>
      </div>

      {/* Identity */}
      <div className="flex flex-col items-center px-5 pt-2 pb-5 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-foreground">
          {initials(contact.full_name)}
        </span>
        <h1 className="mt-3 text-[24px] font-bold leading-tight tracking-tight text-foreground">
          {contact.full_name}
        </h1>
        <div className="mt-2">
          <Pill tone={CONTACT_TYPE_TONES[contact.type]}>{CONTACT_TYPE_LABELS[contact.type]}</Pill>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-start justify-center gap-7 px-5 pb-6">
        <QuickAction
          icon={<MessageCircle className="size-5" strokeWidth={1.8} />}
          label="WhatsApp"
          onClick={openWhatsApp}
          disabled={!phoneDigits}
        />
        <QuickAction
          icon={<Phone className="size-5" strokeWidth={1.8} />}
          label="Llamar"
          onClick={openCall}
          disabled={!contact.phone}
        />
        <QuickAction
          icon={<Mail className="size-5" strokeWidth={1.8} />}
          label="Email"
          onClick={openEmail}
          disabled={!contact.email}
        />
        <QuickAction
          icon={<CalendarPlus className="size-5" strokeWidth={1.8} />}
          label="Agendar"
          onClick={() => navigate(`/${role}/calendario`)}
        />
      </div>

      {/* Detail fields */}
      <div className="mx-5 mb-5 space-y-2.5 rounded-2xl bg-card p-4">
        {contact.phone && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <span className="text-foreground">{contact.phone}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-3 text-sm">
            <Mail className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <span className="truncate text-foreground">{contact.email}</span>
          </div>
        )}
        {contact.address && (
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <span className="text-foreground">{contact.address}</span>
          </div>
        )}
        {contact.rut && (
          <div className="flex items-center gap-3 text-sm">
            <span className="w-4 shrink-0 text-center text-[11px] font-semibold text-muted-foreground">
              ID
            </span>
            <span className="text-foreground">RUT {contact.rut}</span>
          </div>
        )}
        {!contact.phone && !contact.email && !contact.address && !contact.rut && (
          <p className="text-sm text-muted-foreground">Sin datos de contacto.</p>
        )}
        <Link
          to={`/${role}/timeline/contacts/${contact.id}`}
          className="inline-block pt-1 text-sm font-semibold text-primary hover:underline"
        >
          Ver línea de tiempo
        </Link>
      </div>

      {/* Tabs */}
      <Segmented items={TABS} value={tab} onChange={setTab} />
      <div className="px-5 pt-4">
        {tab === "interacciones" && <InteractionsList personId={contact.id} />}
        {tab === "oportunidades" && <ContactOpportunities personId={contact.id} />}
        {tab === "notas" && <NotesList targetTable="contacts" targetRowId={contact.id} />}
        {tab === "correos" && <ContactEmails contactId={contact.id} />}
      </div>

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
                onDeleted?.();
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
