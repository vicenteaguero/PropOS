import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { PageLayout } from "@shared/components/page-layout";
import { portalsApi, type PublicPortalView } from "../api/portals-api";
import { validateFile } from "../services/file-validation";

export function PortalPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [view, setView] = useState<PublicPortalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [uploaderLabel, setUploaderLabel] = useState("");
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const v = await portalsApi.publicView(slug);
        if (!cancelled) {
          setView(v);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const upload = async () => {
    if (!slug || !file || !view) return;
    if (!consent) {
      toast.error("Debes aceptar el consentimiento");
      return;
    }
    const validation = await validateFile(file, view.max_file_size_mb * 1024 * 1024);
    if (!validation.ok) {
      toast.error(validation.reason ?? "Archivo inválido");
      return;
    }
    setBusy(true);
    try {
      await portalsApi.publicUpload(
        slug,
        file,
        uploaderLabel || undefined,
        consent,
        password || undefined,
      );
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PageLayout width="sm" centered>
        <div className="flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </PageLayout>
    );
  }

  if (error || !view) {
    return (
      <PageLayout width="sm" centered>
        <div className="mx-auto max-w-md rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          {error ?? "Enlace no disponible"}
        </div>
      </PageLayout>
    );
  }

  if (done) {
    return (
      <PageLayout width="sm" centered>
        <div className="mx-auto w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center">
          <Check className="mx-auto size-12 text-success" />
          <h2 className="text-lg font-semibold">Documento recibido</h2>
          <p className="text-sm text-muted-foreground">
            El equipo lo revisará y procesará. Gracias.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setFile(null);
              setUploaderLabel("");
              setPassword("");
              setConsent(false);
              setDone(false);
            }}
          >
            Subir otro
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="sm" centered>
      <div className="mx-auto w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6">
        <div>
          <h1 className="text-lg font-semibold">{view.title}</h1>
          {view.description && <p className="text-sm text-muted-foreground">{view.description}</p>}
        </div>

        {view.requires_password && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs">
              <Lock className="size-3" /> Password
            </Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">Tu nombre (opcional)</Label>
          <Input
            value={uploaderLabel}
            onChange={(e) => setUploaderLabel(e.target.value)}
            placeholder="Ej: Notaría XYZ"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Archivo (máx {view.max_file_size_mb} MB)</Label>
          <Input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Acepto que el archivo subido sea procesado por PropOS conforme a su política de
            privacidad y la Ley 21.719 de Chile.
          </span>
        </label>

        <Button onClick={upload} disabled={!file || busy} className="w-full">
          <Upload className="size-4" /> {busy ? "Subiendo..." : "Subir documento"}
        </Button>
      </div>
    </PageLayout>
  );
}
