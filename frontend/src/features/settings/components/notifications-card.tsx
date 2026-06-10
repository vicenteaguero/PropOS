import { useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { usePushSubscription } from "@shared/hooks/use-push-subscription";

export function NotificationsCard() {
  const push = usePushSubscription();
  const [testing, setTesting] = useState(false);

  const toggle = async () => {
    try {
      if (push.subscribed) {
        await push.disable();
        toast.success("Notificaciones desactivadas");
      } else {
        await push.enable();
        toast.success("Notificaciones activadas");
      }
    } catch {
      toast.error(push.error ?? "No se pudo cambiar la configuración");
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      await push.sendTest();
      toast.success("Notificación de prueba enviada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notificaciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!push.supported ? (
          <p className="text-sm text-muted-foreground">
            Las notificaciones push no están disponibles en este dispositivo. Instalá PropOS como
            app para habilitarlas.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Recibí recordatorios de tareas, visitas y vencimientos en este dispositivo.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={toggle}
                disabled={push.busy}
                variant={push.subscribed ? "outline" : "default"}
                className="gap-2"
              >
                {push.busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : push.subscribed ? (
                  <BellOff className="size-4" />
                ) : (
                  <Bell className="size-4" />
                )}
                {push.subscribed ? "Desactivar" : "Activar"}
              </Button>
              {push.subscribed && (
                <Button onClick={test} disabled={testing} variant="ghost" className="gap-2">
                  {testing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Probar
                </Button>
              )}
            </div>
            {push.permission === "denied" && (
              <p className="text-xs text-destructive">
                Permiso bloqueado en el navegador. Habilitalo en los ajustes del sitio.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
