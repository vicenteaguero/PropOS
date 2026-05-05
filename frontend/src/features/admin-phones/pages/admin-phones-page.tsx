import { useEffect, useState } from "react";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import {
  userPhonesApi,
  type AppUser,
  type UserPhone,
} from "../api/user-phones-api";

const ROLES = ["ADMIN", "AGENT", "LANDOWNER", "BUYER", "CONTENT"];

export function AdminPhonesPage() {
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

  async function refresh() {
    try {
      const [u, p] = await Promise.all([
        userPhonesApi.listUsers(),
        userPhonesApi.list(),
      ]);
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
    if (!confirm("¿Quitar este teléfono?")) return;
    try {
      await userPhonesApi.unassign(id);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando");
    }
  }

  const userById = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u?.full_name ?? u?.email ?? id.slice(0, 8);
  };

  return (
    <PageLayout width="md">
      <PageHeader
        title="Usuarios y teléfonos"
        description="Crea usuarios internos y asigna sus números E.164. Mensajes desde números asignados se rutean a Anita; el resto va al Client Agent."
      />
      <div className="space-y-8">

      <section className="space-y-3 border rounded-lg p-4">
        <h2 className="font-medium">Crear usuario</h2>
        <form onSubmit={onCreateUser} className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm">Nombre completo *</label>
            <input
              className="w-full border rounded px-3 py-2 bg-background"
              value={cuName}
              onChange={(e) => setCuName(e.target.value)}
              placeholder="Ana Carreño"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Email *</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2 bg-background"
              value={cuEmail}
              onChange={(e) => setCuEmail(e.target.value)}
              placeholder="ana@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">RUT</label>
            <input
              className="w-full border rounded px-3 py-2 bg-background"
              value={cuRut}
              onChange={(e) => setCuRut(e.target.value)}
              placeholder="12.345.678-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Rol</label>
            <select
              className="w-full border rounded px-3 py-2 bg-background"
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
          <div className="space-y-1 col-span-2">
            <label className="text-sm">Contraseña (opcional, se autogenera)</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 bg-background"
              value={cuPassword}
              onChange={(e) => setCuPassword(e.target.value)}
              placeholder="Si se deja vacío, se crea aleatoria"
            />
          </div>
          {cuError && (
            <p className="text-sm text-destructive col-span-2">{cuError}</p>
          )}
          {cuOk && <p className="text-sm text-success col-span-2">{cuOk}</p>}
          <div className="col-span-2">
            <button
              type="submit"
              disabled={cuLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
            >
              {cuLoading ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3 border rounded-lg p-4">
        <h2 className="font-medium">Asignar teléfono</h2>
        <form onSubmit={onAssign} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Usuario</label>
            <select
              className="w-full border rounded px-3 py-2 bg-background"
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
          <div className="space-y-1">
            <label className="text-sm font-medium">Teléfono (E.164)</label>
            <input
              className="w-full border rounded px-3 py-2 bg-background"
              placeholder="+56912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
          >
            {loading ? "Asignando..." : "Asignar"}
          </button>
        </form>
      </section>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2">Usuario</th>
              <th className="text-left px-3 py-2">Teléfono</th>
              <th className="text-left px-3 py-2">Verificado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {phones.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Sin teléfonos asignados
                </td>
              </tr>
            )}
            {phones.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{userById(p.user_id)}</td>
                <td className="px-3 py-2 font-mono">{p.phone_e164}</td>
                <td className="px-3 py-2">{p.verified_at ? "Sí" : "No"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onUnassign(p.id)}
                    className="text-destructive hover:underline"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </PageLayout>
  );
}
