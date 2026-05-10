import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Mail, ShieldAlert, Trash2, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { Badge } from "@/components/ui/badge";
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

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const { data, isLoading } = useAdminUserDetail(id);
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

  if (isLoading || !data) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <Link
        to="/admin/users"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Volver
      </Link>

      <header className="mb-6 flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.full_name || "(sin nombre)"}</h1>
          <p className="text-sm text-muted-foreground">{data.email}</p>
        </div>
        {data.is_dev_admin && (
          <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/20">DEV</Badge>
        )}
        {!data.is_active && <Badge variant="destructive">Deshabilitado</Badge>}
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
          <Card>
            <CardContent className="space-y-2 py-4 text-sm">
              <div>
                <span className="text-muted-foreground">RUT: </span>
                {data.rut ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Rol activo: </span>
                {data.role}
              </div>
              <div>
                <span className="text-muted-foreground">Vista activa: </span>
                {data.view}
              </div>
              <div>
                <span className="text-muted-foreground">Creado: </span>
                {new Date(data.created_at).toLocaleString("es-CL")}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memberships" className="mt-4 space-y-3">
          {data.memberships.length === 0 && (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No tiene memberships.
              </CardContent>
            </Card>
          )}
          {data.memberships.map((m) => {
            const tName = m.tenants?.name ?? m.tenant_name ?? m.tenant_id;
            return (
              <Card key={m.tenant_id}>
                <CardContent className="grid grid-cols-2 gap-3 py-4 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Tenant</div>
                    <div className="font-medium">{tName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Rol</div>
                    <select
                      value={m.role}
                      onChange={(e) =>
                        updateMembership.mutate({
                          userId: data.id,
                          tenantId: m.tenant_id,
                          patch: { role: e.target.value },
                        })
                      }
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {["ADMIN", "AGENT", "LANDOWNER", "BUYER", "CONTENT"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Vista</div>
                    <select
                      value={m.view}
                      onChange={(e) =>
                        updateMembership.mutate({
                          userId: data.id,
                          tenantId: m.tenant_id,
                          patch: { view: e.target.value },
                        })
                      }
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {["admin", "admin-dev", "agent", "owner", "buyer", "content"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Dev</div>
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="emails" className="mt-4 space-y-2">
          {data.user_emails.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                <span className="truncate">{e.email}</span>
                {e.label && <span className="text-xs text-muted-foreground">({e.label})</span>}
                {e.is_primary && (
                  <Badge variant="outline" className="text-[10px]">
                    primary
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{e.purpose}</span>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="grants" className="mt-4 space-y-2">
          {data.grants.length === 0 && (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Sin grants.
              </CardContent>
            </Card>
          )}
          {data.grants.map((g) => (
            <div key={g.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="font-medium">{g.properties?.title ?? g.property_id}</div>
              {g.properties?.address && (
                <div className="text-xs text-muted-foreground">{g.properties.address}</div>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                {g.capabilities.map((c) => (
                  <Badge key={c} variant="outline" className="text-[10px]">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {isDev && (
          <TabsContent value="security" className="mt-4 space-y-4">
            <Card>
              <CardContent className="space-y-2 py-4">
                <h3 className="text-sm font-semibold">Acciones de email (Supabase Auth)</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resetPwd
                        .mutateAsync(data.id)
                        .then(() => toast.success("Email de recovery enviado."))
                        .catch((e) => toast.error(`Error: ${e}`))
                    }
                  >
                    <KeyRound className="mr-1.5 size-3.5" /> Reset password
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resendInvite
                        .mutateAsync(data.id)
                        .then(() => toast.success("Invitación reenviada."))
                        .catch((e) => toast.error(`Error: ${e}`))
                    }
                  >
                    <Mail className="mr-1.5 size-3.5" /> Reenviar invite
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
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
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 py-4">
                <h3 className="text-sm font-semibold">Setear contraseña directamente</h3>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="new-pwd" className="text-xs">
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
                    size="sm"
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
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 py-4">
                <h3 className="text-sm font-semibold">Estado de la cuenta</h3>
                <div className="flex flex-wrap gap-2">
                  {data.is_active ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        disableU
                          .mutateAsync(data.id)
                          .then(() => toast.success("Usuario deshabilitado."))
                          .catch((e) => toast.error(`Error: ${e}`))
                      }
                    >
                      <UserX className="mr-1.5 size-3.5" /> Deshabilitar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
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
              </CardContent>
            </Card>

            <Card className="border-destructive/40">
              <CardContent className="space-y-2 py-4">
                <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <ShieldAlert className="size-4" /> Eliminar usuario
                </h3>
                <p className="text-xs text-muted-foreground">
                  Acción irreversible. Borra auth user + perfil + memberships + grants.
                </p>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="confirm-delete" className="text-xs">
                      Tipea <code className="rounded bg-muted px-1">eliminar</code> para confirmar
                    </Label>
                    <Input
                      id="confirm-delete"
                      value={confirmDelete}
                      onChange={(e) => setConfirmDelete(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
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
                    <Trash2 className="mr-1.5 size-3.5" /> Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
