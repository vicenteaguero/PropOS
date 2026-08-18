import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Mail, ShieldAlert, Trash2, UserX } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@shared/components/page-layout";
import { ErrorState, PageSkeleton, Pill, SectionLabel } from "@shared/ui";
import { toast } from "sonner";
import { useAuth } from "@shared/hooks/use-auth";
import {
  useAdminUserDetail,
  useDeleteUser,
  useDisableUser,
  useEnableUser,
  useImpersonate,
  useResendInvite,
  useResetPassword,
  useSetPassword,
  useUpdateMembership,
} from "@features/admin-users/hooks/use-admin-users";

const SELECT_CLASS =
  "h-9 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:border-line-strong focus-visible:outline-none";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const { data, isLoading, error, refetch } = useAdminUserDetail(id);
  const isDev = !!currentUser?.isDevAdmin;

  const resetPwd = useResetPassword();
  const resendInvite = useResendInvite();
  const setPwd = useSetPassword();
  const disableU = useDisableUser();
  const enableU = useEnableUser();
  const deleteU = useDeleteUser();
  const impersonate = useImpersonate();
  const updateMembership = useUpdateMembership();

  const [newPwd, setNewPwd] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");

  // Mobile: capped reading column. Desktop: a wider, comfortable admin canvas
  // (not full-bleed — this is a detail/edit surface, not a list).
  const backLink = (
    <Link
      to="/admin/users"
      className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" strokeWidth={1.8} /> Volver
    </Link>
  );

  if (isLoading) {
    return (
      <PageLayout width="md" className="pb-10 lg:max-w-5xl lg:px-8 lg:py-9">
        {backLink}
        <PageSkeleton variant="detail" />
      </PageLayout>
    );
  }

  // A 403/404/500 (or a user from another tenant) lands here with no data.
  if (!data) {
    return (
      <PageLayout width="md" className="pb-10 lg:max-w-5xl lg:px-8 lg:py-9">
        {backLink}
        <ErrorState
          message="No se pudo cargar el usuario."
          error={error}
          onRetry={() => refetch()}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout width="md" className="pb-10 lg:max-w-5xl lg:px-8 lg:py-9">
      {backLink}

      <header className="mb-6 flex items-center gap-4 lg:mb-8">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-foreground lg:size-16 lg:text-xl">
          {initials(data.full_name || data.email)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              {data.full_name || "(sin nombre)"}
            </h1>
            {data.is_dev_admin && <Pill tone="warning">DEV</Pill>}
            {!data.is_active && <Pill tone="destructive">Deshabilitado</Pill>}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{data.email}</p>
        </div>
      </header>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="memberships">Tenants</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="grants">Grants</TabsTrigger>
          {isDev && <TabsTrigger value="security">Seguridad</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          {/* Mobile: stacked rows. Desktop: 2-up grid of fact cells. */}
          <dl className="rounded-2xl border border-border bg-card p-5 text-sm lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-1 lg:p-6">
            {[
              { label: "RUT", value: data.rut ?? "—" },
              { label: "Rol activo", value: data.role },
              { label: "Vista activa", value: data.view },
              { label: "Creado", value: new Date(data.created_at).toLocaleString("es-CL") },
            ].map((r, i, arr) => (
              <div
                key={r.label}
                className={`flex items-center justify-between gap-3 py-2.5 ${
                  i < arr.length - 1 ? "border-b border-border lg:border-b-0" : ""
                }`}
              >
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="font-medium text-foreground">{r.value}</dd>
              </div>
            ))}
          </dl>
        </TabsContent>

        <TabsContent value="memberships" className="mt-4 space-y-3">
          {data.memberships.length === 0 && (
            <div className="rounded-2xl border border-border bg-card py-6 text-center text-sm text-muted-foreground">
              No tiene memberships.
            </div>
          )}
          {data.memberships.map((m) => {
            const tName = m.tenants?.name ?? m.tenant_name ?? m.tenant_id;
            return (
              <div key={m.tenant_id} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-base font-semibold text-foreground">{tName}</span>
                  {m.is_dev_admin && <Pill tone="warning">DEV</Pill>}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Rol</Label>
                    <select
                      value={m.role}
                      onChange={(e) =>
                        updateMembership.mutate({
                          userId: data.id,
                          tenantId: m.tenant_id,
                          patch: { role: e.target.value },
                        })
                      }
                      className={SELECT_CLASS}
                    >
                      {["ADMIN", "AGENT", "LANDOWNER", "BUYER", "CONTENT"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Vista</Label>
                    <select
                      value={m.view}
                      onChange={(e) =>
                        updateMembership.mutate({
                          userId: data.id,
                          tenantId: m.tenant_id,
                          patch: { view: e.target.value },
                        })
                      }
                      className={SELECT_CLASS}
                    >
                      {["admin", "admin-dev", "agent", "owner", "buyer", "content"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dev admin</Label>
                    <label className="flex h-9 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={m.is_dev_admin}
                        disabled={!isDev}
                        onChange={(e) =>
                          updateMembership.mutate({
                            userId: data.id,
                            tenantId: m.tenant_id,
                            patch: { is_dev_admin: e.target.checked },
                          })
                        }
                      />
                      <span className="text-muted-foreground">Acceso destructivo</span>
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent
          value="emails"
          className="mt-4 space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0"
        >
          {data.user_emails.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                <span className="truncate font-medium text-foreground">{e.email}</span>
                {e.label && <span className="text-xs text-muted-foreground">({e.label})</span>}
                {e.is_primary && <Pill tone="accent">primary</Pill>}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{e.purpose}</span>
            </div>
          ))}
        </TabsContent>

        <TabsContent
          value="grants"
          className="mt-4 space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0"
        >
          {data.grants.length === 0 && (
            <div className="rounded-2xl border border-border bg-card py-6 text-center text-sm text-muted-foreground lg:col-span-2">
              Sin grants.
            </div>
          )}
          {data.grants.map((g) => (
            <div key={g.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
              <div className="font-semibold text-foreground">
                {g.properties?.title ?? g.property_id}
              </div>
              {g.properties?.address && (
                <div className="text-xs text-muted-foreground">{g.properties.address}</div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {g.capabilities.map((c) => (
                  <Pill key={c} tone="neutral">
                    {c}
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {isDev && (
          <TabsContent
            value="security"
            className="mt-4 space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0"
          >
            <section className="space-y-3 lg:col-span-2">
              <SectionLabel className="px-0">Acciones de email</SectionLabel>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() =>
                    resetPwd
                      .mutateAsync(data.id)
                      .then(() => toast.success("Email de recovery enviado."))
                      .catch((e) => toast.error(`Error: ${e}`))
                  }
                >
                  <KeyRound className="mr-1.5 size-3.5" strokeWidth={1.8} /> Reset password
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() =>
                    resendInvite
                      .mutateAsync(data.id)
                      .then(() => toast.success("Invitación reenviada."))
                      .catch((e) => toast.error(`Error: ${e}`))
                  }
                >
                  <Mail className="mr-1.5 size-3.5" strokeWidth={1.8} /> Reenviar invite
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() =>
                    impersonate
                      .mutateAsync(data.id)
                      .then((r) => {
                        if (r.magic_link) {
                          window.open(r.magic_link, "_blank", "noopener");
                        } else {
                          toast.error("No se generó magic link");
                        }
                      })
                      .catch((e) => toast.error(`Error: ${e}`))
                  }
                >
                  Impersonar
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <SectionLabel className="px-0">Setear contraseña directamente</SectionLabel>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="new-pwd" className="text-xs text-muted-foreground">
                    Nueva contraseña (≥8 caracteres)
                  </Label>
                  <Input
                    id="new-pwd"
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                  />
                </div>
                <Button
                  variant="ink"
                  disabled={newPwd.length < 8 || setPwd.isPending}
                  onClick={() =>
                    setPwd
                      .mutateAsync({ userId: data.id, newPassword: newPwd })
                      .then(() => {
                        toast.success("Contraseña actualizada.");
                        setNewPwd("");
                      })
                      .catch((e) => toast.error(`Error: ${e}`))
                  }
                >
                  Setear
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <SectionLabel className="px-0">Estado de la cuenta</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {data.is_active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      disableU
                        .mutateAsync(data.id)
                        .then(() => toast.success("Usuario deshabilitado."))
                        .catch((e) => toast.error(`Error: ${e}`))
                    }
                  >
                    <UserX className="mr-1.5 size-3.5" strokeWidth={1.8} /> Deshabilitar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ink"
                    className="rounded-full"
                    onClick={() =>
                      enableU
                        .mutateAsync(data.id)
                        .then(() => toast.success("Usuario habilitado."))
                        .catch((e) => toast.error(`Error: ${e}`))
                    }
                  >
                    Habilitar
                  </Button>
                )}
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-5 lg:col-span-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                <ShieldAlert className="size-4" strokeWidth={1.8} /> Eliminar usuario
              </h3>
              <p className="text-xs text-muted-foreground">
                Acción irreversible. Borra auth user + perfil + memberships + grants.
              </p>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="confirm-delete" className="text-xs text-muted-foreground">
                    Tipea <code className="rounded bg-muted px-1">eliminar</code> para confirmar
                  </Label>
                  <Input
                    id="confirm-delete"
                    value={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.value)}
                  />
                </div>
                <Button
                  variant="destructive"
                  disabled={confirmDelete !== "eliminar" || deleteU.isPending}
                  onClick={() =>
                    deleteU
                      .mutateAsync(data.id)
                      .then(() => {
                        toast.success("Usuario eliminado.");
                        window.history.back();
                      })
                      .catch((e) => toast.error(`Error: ${e}`))
                  }
                >
                  <Trash2 className="mr-1.5 size-3.5" strokeWidth={1.8} /> Eliminar
                </Button>
              </div>
            </section>
          </TabsContent>
        )}
      </Tabs>
    </PageLayout>
  );
}
