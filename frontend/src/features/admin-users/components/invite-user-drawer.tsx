import { useState, type FormEvent } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { toast } from "sonner";
import { useInviteUser } from "@features/admin-users/hooks/use-admin-users";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTenantId: string | undefined;
}

export function InviteUserDrawer({ open, onOpenChange, currentTenantId }: Props) {
  const invite = useInviteUser();
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [paternalSurname, setPaternalSurname] = useState("");
  const [maternalSurname, setMaternalSurname] = useState("");
  const [rut, setRut] = useState("");
  const [role, setRole] = useState("ADMIN");
  const [view, setView] = useState("admin");
  const [isDevAdmin, setIsDevAdmin] = useState(false);

  function reset() {
    setPrimaryEmail("");
    setFirstName("");
    setMiddleName("");
    setPaternalSurname("");
    setMaternalSurname("");
    setRut("");
    setRole("ADMIN");
    setView("admin");
    setIsDevAdmin(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentTenantId) {
      toast.error("Sin tenant activo");
      return;
    }
    try {
      await invite.mutateAsync({
        primary_email: primaryEmail.trim().toLowerCase(),
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        paternal_surname: paternalSurname.trim(),
        maternal_surname: maternalSurname.trim() || null,
        rut: rut.trim() || null,
        memberships: [
          {
            tenant_id: currentTenantId,
            role,
            admin_scope: [],
            is_dev_admin: isDevAdmin,
            view,
          },
        ],
        additional_emails: [],
      });
      toast.success("Invitación enviada.");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Invitar usuario</SheetTitle>
          <SheetDescription>
            Le mandamos magic-link al email para que setee su contraseña.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email primario</Label>
            <Input
              id="email"
              type="email"
              required
              value={primaryEmail}
              onChange={(e) => setPrimaryEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="first">Primer nombre</Label>
              <Input
                id="first"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="middle">Segundo (opc.)</Label>
              <Input
                id="middle"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pat">Apellido paterno</Label>
              <Input
                id="pat"
                required
                value={paternalSurname}
                onChange={(e) => setPaternalSurname(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mat">Materno (opc.)</Label>
              <Input
                id="mat"
                value={maternalSurname}
                onChange={(e) => setMaternalSurname(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rut">RUT (opc.)</Label>
            <Input
              id="rut"
              placeholder="12345678-9"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="role">Rol</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="AGENT">AGENT</option>
                <option value="LANDOWNER">LANDOWNER</option>
                <option value="BUYER">BUYER</option>
                <option value="CONTENT">CONTENT</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="view">Vista UI</Label>
              <select
                id="view"
                value={view}
                onChange={(e) => setView(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="admin">admin</option>
                <option value="admin-dev">admin-dev</option>
                <option value="agent">agent</option>
                <option value="owner">owner</option>
                <option value="buyer">buyer</option>
                <option value="content">content</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDevAdmin}
              onChange={(e) => setIsDevAdmin(e.target.checked)}
            />
            Es admin-dev (acceso a operaciones destructivas)
          </label>

          <Button type="submit" disabled={invite.isPending} className="mt-2">
            {invite.isPending ? <LoadingSpinner size="sm" /> : "Enviar invitación"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
