import { Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  title: string;
}

export function ShareViaDialog({ open, onOpenChange, url, title }: Props) {
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const native = async () => {
    if (!url) return;
    try {
      await navigator.share({ title, text: title, url });
    } catch {
      /* user cancelled */
    }
  };

  const wa = () => {
    if (!url) return;
    const text = encodeURIComponent(`${title}\n${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const email = () => {
    if (!url) return;
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${title}\n\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Compartir documento</DialogTitle>
        </DialogHeader>
        {!url ? (
          <p className="text-sm text-muted-foreground">
            Crea un shortlink primero (botón Shortlink).
          </p>
        ) : (
          <div className="space-y-2">
            {canNativeShare && (
              <Button onClick={native} className="w-full justify-start" variant="secondary">
                <Share2 className="size-4" /> Compartir con apps del sistema
              </Button>
            )}
            <Button onClick={wa} className="w-full justify-start" variant="secondary">
              <MessageCircle className="size-4" /> WhatsApp
            </Button>
            <Button onClick={email} className="w-full justify-start" variant="secondary">
              <Mail className="size-4" /> Email
            </Button>
            <Button onClick={copy} className="w-full justify-start" variant="outline">
              <Copy className="size-4" /> Copiar link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
