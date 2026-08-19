import { useState } from "react";
import { Bell, Loader2, Send } from "lucide-react";
import { Row, TOUCH_TARGET_HIT_AREA } from "@shared/ui";
import { toast } from "sonner";
import { usePushSubscription } from "@shared/hooks/use-push-subscription";

/** Push-notification controls, rendered as settings rows (no Card wrapper). */
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

  if (!push.supported) {
    return (
      <Row
        left={
          <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
            <Bell className="size-[18px]" strokeWidth={1.8} />
          </span>
        }
        title="Notificaciones push"
        sub="No disponibles aquí. Instalá PropOS como app para habilitarlas."
        divider={false}
      />
    );
  }

  return (
    <>
      <Row
        left={
          <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Bell className="size-[18px]" strokeWidth={1.8} />
          </span>
        }
        title="Notificaciones push"
        sub={
          push.permission === "denied"
            ? "Permiso bloqueado en el navegador. Habilitalo en los ajustes del sitio."
            : "Recordatorios de tareas, visitas y vencimientos en este dispositivo."
        }
        right={
          <PushToggle
            on={push.subscribed}
            busy={push.busy}
            disabled={push.permission === "denied"}
            onToggle={toggle}
          />
        }
        divider={push.subscribed}
      />
      {push.subscribed && (
        <Row
          left={
            <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-foreground">
              <Send className="size-[18px]" strokeWidth={1.8} />
            </span>
          }
          title="Enviar prueba"
          sub="Comprobá que las notificaciones llegan a este dispositivo."
          onClick={() => void test()}
          right={
            testing ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={1.8} />
            ) : (
              <span className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground">
                Probar
              </span>
            )
          }
          divider={false}
        />
      )}
    </>
  );
}

/** Pill toggle switch matching the design kit (ink when on). */
function PushToggle({
  on,
  busy,
  disabled,
  onToggle,
}: {
  on: boolean;
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  if (busy) {
    return <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.8} />;
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={
        `relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${TOUCH_TARGET_HIT_AREA} ` +
        (on ? "bg-foreground" : "bg-line-strong")
      }
    >
      <span
        className={
          "absolute top-0.5 size-6 rounded-full bg-background shadow-sm transition-all " +
          (on ? "left-[22px]" : "left-0.5")
        }
      />
    </button>
  );
}
