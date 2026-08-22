import { Inbox } from "lucide-react";
import { CONTROL_H, EmailMark, WhatsAppMark } from "@shared/ui";
import { cn } from "@/lib/utils";

export type ChannelFilter = "todos" | "whatsapp" | "email";

/**
 * Which mailbox you are looking at.
 *
 * Deliberately not the generic `ViewToggle`: that control is for "the same data
 * shown another way" and paints every option in the same muted grey, which is
 * exactly wrong here — the three options are three different *places*, and the
 * fastest way to know which one you are in is that each carries the colour of
 * the thing it holds. "Todo" takes the workspace accent because it is the only
 * one that is not a brand; WhatsApp and Correo take a light wash of their own,
 * light enough to sit under a 20px mark without competing with it.
 */
export function ChannelSwitch({
  value,
  onChange,
}: {
  value: ChannelFilter;
  onChange: (value: ChannelFilter) => void;
}) {
  const item = (id: ChannelFilter, label: string, icon: React.ReactNode, activeClass: string) => {
    const active = value === id;
    return (
      <button
        key={id}
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={() => onChange(id)}
        className={cn(
          "flex aspect-square h-full items-center justify-center rounded-full transition",
          active
            ? `${activeClass} shadow-sm`
            : "text-muted-foreground hover:text-foreground [&>span]:opacity-60",
        )}
      >
        {icon}
      </button>
    );
  };

  return (
    <div
      // Height on the track, buttons fill it — same rule as ViewToggle, so the
      // two switches and the filter beside them agree.
      className={cn("inline-flex shrink-0 items-center rounded-full bg-secondary p-0.5", CONTROL_H)}
    >
      {item(
        "todos",
        "Todo",
        <Inbox className="size-[18px]" strokeWidth={1.9} />,
        "bg-primary/15 text-primary",
      )}
      {item("whatsapp", "WhatsApp", <WhatsAppMark size={19} />, "bg-[#25D366]/15 text-foreground")}
      {item("email", "Correo", <EmailMark size={19} />, "bg-foreground/10 text-foreground")}
    </div>
  );
}
