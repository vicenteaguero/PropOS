import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Lock, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { PageLayout } from "@shared/components/page-layout";
import { shareLinksApi } from "../api/share-links-api";
import type { ShareLinkPublicView } from "../types";
import { DocumentPreview } from "../components/document-preview";

export function SharePublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [view, setView] = useState<ShareLinkPublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const v = await shareLinksApi.resolvePublic(slug);
        if (cancelled) return;
        setView(v);
        setNeedsPassword(v.requires_password);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!view || needsPassword) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(view.download_url);
        if (!res.ok) throw new Error("download failed");
        const b = await res.blob();
        if (!cancelled) setBlob(b);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view?.download_url, needsPassword]);

  const submitPassword = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const v = await shareLinksApi.resolvePublicWithPassword(slug, password);
      setView(v);
      setNeedsPassword(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password inválido");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!blob || !view) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = view.download_filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    if (!view) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: view.document_display_name,
          url: window.location.href,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
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

  if (needsPassword) {
    return (
      <PageLayout width="sm" centered>
        <div className="mx-auto w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Lock className="size-5 text-primary" />
            <h2 className="text-base font-semibold">Documento protegido</h2>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPassword()}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button onClick={submitPassword} className="w-full">
            Continuar
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (error || !view) {
    return (
      <PageLayout width="sm" centered>
        <div className="mx-auto max-w-md rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          {error ?? "Documento no disponible"}
        </div>
      </PageLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <PageLayout width="md" noPadding className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">{view.document_display_name}</h1>
            <p className="text-xs text-muted-foreground">
              v{view.version_number} · sha {view.sha256_short} · {view.mime_type}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={download} disabled={!blob}>
            <Download className="size-4" /> Descargar
          </Button>
          <Button size="sm" variant="secondary" onClick={share}>
            <Share2 className="size-4" /> Compartir
          </Button>
        </PageLayout>
      </header>
      <PageLayout width="md">
        <DocumentPreview blob={blob} mimeType={view?.mime_type} loading={!blob} />
      </PageLayout>
      <PageLayout width="md" className="text-center text-xs text-muted-foreground">
        PropOS — Documento compartido
      </PageLayout>
    </div>
  );
}
