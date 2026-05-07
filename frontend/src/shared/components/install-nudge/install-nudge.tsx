import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const STORAGE_KEY = "propos:install-nudge-dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  type IosNav = Navigator & { standalone?: boolean };
  const nav = window.navigator as IosNav;
  return (
    nav.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches === true
  );
}

export function InstallNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    if (!isIos()) return;
    if (isStandalone()) return;
    const t = window.setTimeout(() => setShow(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, "1");
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <img
            src="/icon.svg"
            alt="PropOS"
            className="size-10 shrink-0 rounded-lg ring-2 ring-primary/20"
          />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-foreground">Instalá PropOS en tu iPhone</p>
            <p className="mt-1 text-muted-foreground">
              Tocá <Share className="-mt-0.5 inline size-3.5" /> en Safari y elegí{" "}
              <strong>Añadir a inicio</strong>. Vas a tener PropOS como cualquier app.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
