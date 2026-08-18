import { useEffect, useState } from "react";
import { Loader2, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@shared/components/page-layout";
import { ConfirmDialog } from "@shared/components/confirm-dialog/confirm-dialog";
import { Pill, Row, SectionLabel, FOCUS_RING } from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import { userPhonesApi, type AppUser, type UserPhone } from "../api/user-phones-api";
import { useAgentName } from "@core/branding/agent-branding";

const ROLES = ["ADMIN", "AGENT", "LANDOWNER", "BUYER", "CONTENT"];

const SELECT_CLASS = `h-10 w-full rounded-xl border border-border bg-background px-3 text-sm ${FOCUS_RING}`;

export function AdminPhonesPage() {
  const agentName = useAgentName();
  const isDesktop = useIsDesktop();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [phones, setPhones] = useState<UserPhone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // create user form
  const [cuEmail, setCuEmail] = useState("");
  const [cuName, setCuName] = useState("");
  const [cuRut, setCuRut] = useState("");
  const [cuRole, setCuRole] = useState("AGENT");
  const [cuPassword, setCuPassword] = useState("");
  const [cuLoading, setCuLoading] = useState(false);
  const [cuError, setCuError] = useState<string | null>(null);
  const [cuOk, setCuOk] = useState<string | null>(null);

  // assign phone form
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState("");
  const [toUnassign, setToUnassign] = useState<UserPhone | null>(null);

  async function refresh() {
    try {
      const [u, p] = await Promise.all([userPhonesApi.listUsers(), userPhonesApi.list()]);
      setUsers(u);
      setPhones(p);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando datos");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCuError(null);
    setCuOk(null);
    if (!cuEmail || !cuName) {
      setCuError("Email y nombre requeridos");
      return;
    }
    setCuLoading(true);
    try {
      const created = await userPhonesApi.createUser({
        email: cuEmail.trim().toLowerCase(),
        full_name: cuName.trim(),
        rut: cuRut.trim() || undefined,
        role: cuRole,
        password: cuPassword.trim() || undefined,
      });
      setCuOk(`Creado: ${created.full_name ?? created.email}`);
      setCuEmail("");
      setCuName("");
      setCuRut("");
      setCuPassword("");
      setCuRole("AGENT");
      await refresh();
    } catch (e: any) {
      setCuError(e?.message ?? "Error creando usuario");
    } finally {
      setCuLoading(false);
    }
  }

  async function onAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!userId || !phone) {
      setError("Selecciona usuario e ingresa teléfono");
      return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setError("Formato E.164 inválido (ej. +56912345678)");
      return;
    }
    setLoading(true);
    try {
      await userPhonesApi.assign(userId, phone);
      setPhone("");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Error asignando");
    } finally {
      setLoading(false);
    }
  }

  async function onUnassign(id: string) {
    try {
      await userPhonesApi.unassign(id);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando");
    } finally {
      setToUnassign(null);
    }
  }

  const userById = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u?.full_name ?? u?.email ?? id.slice(0, 8);
  };

  const header = (
    <div>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
        Usuarios y teléfonos
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Crea usuarios internos y asigna sus números E.164. Mensajes desde números asignados se
        rutean a {agentName}; el resto va al Client Agent.
      </p>
    </div>
  );

  const createUserSection = (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <SectionLabel className="px-0">Crear usuario</SectionLabel>
      <form onSubmit={onCreateUser} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cu-name">Nombre completo *</Label>
          <Input
            id="cu-name"
            value={cuName}
            onChange={(e) => setCuName(e.target.value)}
            placeholder="Ana Carreño"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cu-email">Email *</Label>
          <Input
            id="cu-email"
            type="email"
            value={cuEmail}
            onChange={(e) => setCuEmail(e.target.value)}
            placeholder="ana@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cu-rut">RUT</Label>
          <Input
            id="cu-rut"
            value={cuRut}
            onChange={(e) => setCuRut(e.target.value)}
            placeholder="12.345.678-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cu-role">Rol</Label>
          <select
            id="cu-role"
            className={SELECT_CLASS}
            value={cuRole}
            onChange={(e) => setCuRole(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cu-password">Contraseña (opcional, se autogenera)</Label>
          <Input
            id="cu-password"
            type="text"
            value={cuPassword}
            onChange={(e) => setCuPassword(e.target.value)}
            placeholder="Si se deja vacío, se crea aleatoria"
          />
        </div>
        {cuError && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
            {cuError}
          </p>
        )}
        {cuOk && (
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success sm:col-span-2">
            {cuOk}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" variant="ink" size="block" disabled={cuLoading}>
            {cuLoading ? <Loader2 className="size-4 animate-spin" /> : "Crear usuario"}
          </Button>
        </div>
      </form>
    </section>
  );

  const assignPhoneSection = (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <SectionLabel className="px-0">Asignar teléfono</SectionLabel>
      <form onSubmit={onAssign} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="assign-user">Usuario</Label>
          <select
            id="assign-user"
            className={SELECT_CLASS}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Selecciona usuario...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? "(sin nombre)"} — {u.email ?? "—"} ({u.role})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assign-phone">Teléfono (E.164)</Label>
          <Input
            id="assign-phone"
            placeholder="+56912345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        <Button type="submit" variant="ink" size="block" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Asignar"}
        </Button>
      </form>
    </section>
  );

  const assignedPhonesSection = (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel className="px-0">Teléfonos asignados</SectionLabel>
        {phones.length > 0 && (
          <span className="text-[13px] tabular-nums text-muted-foreground">{phones.length}</span>
        )}
      </div>
      {phones.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card py-8 text-center text-sm text-muted-foreground">
          Sin teléfonos asignados
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {phones.map((p, i) => (
            <Row
              key={p.id}
              divider={i < phones.length - 1}
              left={
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                  <Phone className="size-[18px]" strokeWidth={1.8} />
                </span>
              }
              title={userById(p.user_id)}
              sub={
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">{p.phone_e164}</span>
                  <Pill tone={p.verified_at ? "success" : "neutral"}>
                    {p.verified_at ? "Verificado" : "Sin verificar"}
                  </Pill>
                </span>
              }
              right={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-destructive hover:bg-destructive/10"
                  aria-label="Quitar teléfono"
                  onClick={() => setToUnassign(p)}
                >
                  <Trash2 className="size-4" strokeWidth={1.8} />
                </Button>
              }
            />
          ))}
        </div>
      )}
    </section>
  );

  const unassignDialog = (
    <ConfirmDialog
      open={!!toUnassign}
      onOpenChange={(o) => !o && setToUnassign(null)}
      title="Quitar teléfono"
      description={`Se quitará ${toUnassign?.phone_e164 ?? ""}. Los mensajes desde ese número dejarán de rutearse a ${agentName}.`}
      confirmLabel="Quitar"
      variant="destructive"
      onConfirm={() => {
        if (toUnassign) void onUnassign(toUnassign.id);
      }}
    />
  );

  // ---- Desktop (lg+): full-width two-column — forms rail · assigned phones. ----
  // The two creation forms are narrow by nature, so they sit in a fixed left
  // rail while the assigned-phones table takes the remaining width. No centered
  // narrow column; padding follows the desktop app surface (lg:px-8 lg:py-7).
  if (isDesktop) {
    return (
      <PageLayout width="app">
        <div className="mb-7">{header}</div>
        <div className="grid grid-cols-[24rem_minmax(0,1fr)] items-start gap-8">
          <div className="space-y-6">
            {createUserSection}
            {assignPhoneSection}
          </div>
          {assignedPhonesSection}
        </div>
        {unassignDialog}
      </PageLayout>
    );
  }

  // ---- Mobile (<lg): original single-column stack — unchanged. ----
  return (
    <PageLayout width="md" className="pb-10">
      <div className="mb-6">{header}</div>
      <div className="space-y-6">
        {createUserSection}
        {assignPhoneSection}
        {assignedPhonesSection}
      </div>
      {unassignDialog}
    </PageLayout>
  );
}
