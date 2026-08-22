import { Mic, MessageSquare } from "lucide-react";
import { EmailMark, WhatsAppMark } from "@shared/ui";
import { cn } from "@/lib/utils";

/**
 * Where a proposal came from, as the channel's own mark.
 *
 * A broker triages this queue by channel before anything else: a WhatsApp
 * proposal has a window closing on it, a note dictated into the app does not.
 * `evidence.source` has carried the answer since the evidence trail existed and
 * nothing rendered it.
 */
export function SourceMark({ source, className }: { source: string; className?: string }) {
  const s = source.toLowerCase();
  if (s === "whatsapp") return <WhatsAppMark size={16} className={className} />;
  if (s === "email") return <EmailMark size={16} className={className} />;
  const Icon = s === "voice" ? Mic : MessageSquare;
  return (
    <Icon
      aria-hidden
      className={cn("size-4 shrink-0 text-muted-foreground", className)}
      strokeWidth={1.9}
    />
  );
}
