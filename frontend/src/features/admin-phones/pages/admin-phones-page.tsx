import { useEffect, useState } from "react";
import { userPhonesApi, type AppUser, type UserPhone } from "../api/user-phones-api";

export function AdminPhonesPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [phones, setPhones] = useState<UserPhone[]>([]);
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const userById = (id: string) =>
    users.find((u) => u.id === id)?.full_name ?? id.slice(0, 8);

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Teléfonos WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Asigna números E.164 a usuarios internos. Mensajes desde estos números
          se rutean a Anita; el resto va al Client Agent (B2C).
        </p>
      </div>

      <form onSubmit={onAssign} className="space-y-3 border rounded-lg p-4">
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
                {u.full_name} ({u.email}) — {u.role}
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
        >
          {loading ? "Asignando..." : "Asignar"}
        </button>
      </form>

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
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
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
                    className="text-red-600 hover:underline"
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
  );
}
