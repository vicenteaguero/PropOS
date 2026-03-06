import { User, Shield, Palette } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@shared/hooks/use-auth";
import type { UserRole } from "@shared/types/auth";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  AGENT: "Agente",
  LANDOWNER: "Propietario",
  BUYER: "Comprador",
  CONTENT: "Contenido",
};

export function SettingsPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
        <p className="text-muted-foreground">
          Administra tu perfil y preferencias de la aplicacion.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-5 text-muted-foreground" />
              <CardTitle>Perfil</CardTitle>
            </div>
            <CardDescription>Tu informacion de usuario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Nombre
              </p>
              <p className="text-sm">{user.fullName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">ID</p>
              <p className="font-mono text-xs text-muted-foreground">
                {user.id}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Estado
              </p>
              <Badge variant={user.isActive ? "default" : "destructive"}>
                {user.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="size-5 text-muted-foreground" />
              <CardTitle>Rol y Permisos</CardTitle>
            </div>
            <CardDescription>
              Tu rol dentro de la organizacion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Rol</p>
              <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Organizacion
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {user.tenantId}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="size-5 text-muted-foreground" />
              <CardTitle>Preferencias</CardTitle>
            </div>
            <CardDescription>
              Personaliza tu experiencia en la aplicacion.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Proximamente podras configurar tus preferencias aqui.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
