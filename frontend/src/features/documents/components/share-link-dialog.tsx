import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateShareLink, useShareLinks, useUpdateShareLink } from "../hooks/use-share-links";
import { shareLinksApi } from "../api/share-links-api";
import type { DocumentVersion } from "../types";
import { Field, ResponsiveSheet } from "@shared/ui";

interface Props {
  documentId: string;
  currentVersionId: string | null;
  versions: DocumentVersion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinkReady?: (url: string) => void;
}

export function ShareLinkDialog({
  documentId,
  currentVersionId,
  versions,
  open,
  onOpenChange,
  onLinkReady,
}: Props) {
  const { data: links } = useShareLinks();
  const createLink = useCreateShareLink(documentId);
  const updateLink = useUpdateShareLink();

  const existing = links?.find((l) => l.document_id === documentId && l.is_active) ?? null;

  const [pinned, setPinned] = useState<string>("CURRENT");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (existing) {
      setPinned(existing.pinned_version_id ?? "CURRENT");
    }
    // Deliberate narrow deps: Keyed to the link identity — refetches produce a new object with the same id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const url = existing ? shareLinksApi.publicShortLinkUrl(existing.slug) : null;

  const upsert = async () => {
    try {
      const pinnedId = pinned === "CURRENT" ? null : pinned;
      if (existing) {
        await updateLink.mutateAsync({
          linkId: existing.id,
          body: {
            pinned_version_id: pinnedId,
            ...(password ? { password } : {}),
          },
        });
        toast.success("Shortlink actualizado");
      } else {
        const created = await createLink.mutateAsync({
          document_id: documentId,
          pinned_version_id: pinnedId,
          password: password || null,
        });
        toast.success("Shortlink creado");
        const newUrl = shareLinksApi.publicShortLinkUrl(created.slug);
        onLinkReady?.(newUrl);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const downloadQr = () => {
    if (!url) return;
    const svg = document.querySelector(`#qr-${existing?.id}`);
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${existing?.slug}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        <>
          <LinkIcon className="size-4" /> Shortlink del documento
        </>
      }
      desktopClassName="max-w-md"
    >
      {url && (
        <Field label="URL pública" labelClassName="text-xs">
          <div className="flex gap-2">
            <Input value={url} readOnly className="font-mono text-xs" />
            <Button variant="secondary" size="icon" onClick={copy} aria-label="Copiar">
              <Copy className="size-4" />
            </Button>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <QRCodeSVG id={`qr-${existing?.id}`} value={url} size={180} />
          </div>
          <Button variant="outline" size="sm" onClick={downloadQr} className="w-full">
            <Download className="size-4" /> Descargar QR
          </Button>
        </Field>
      )}
      <Field label="Versión a servir" labelClassName="text-xs">
        <select
          value={pinned}
          onChange={(e) => setPinned(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="CURRENT">
            Siempre la versión actual (
            {currentVersionId
              ? versions.find((v) => v.id === currentVersionId)?.version_number
              : "?"}
            )
          </option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              Fijar v{v.version_number} ({v.sha256.slice(0, 8)})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Password opcional" labelClassName="text-xs">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={existing?.has_password ? "Cambiar password..." : "Sin password"}
        />
      </Field>
      <Button onClick={upsert} disabled={createLink.isPending || updateLink.isPending}>
        {existing ? "Actualizar" : "Crear shortlink"}
      </Button>
    </ResponsiveSheet>
  );
}
