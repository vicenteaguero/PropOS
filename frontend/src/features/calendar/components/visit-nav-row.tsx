import { NAV_APP_LABEL, navHref } from "@shared/lib/nav-app";
import { MapsMark, WazeMark } from "@shared/ui/icons/brand-marks";

/**
 * Getting to a visit that is about to happen.
 *
 * Only shown for a visit today within the next few hours, directly under it in
 * the list. Everywhere else the preferred-app button on Home is enough; here
 * both apps are offered, because this is the moment someone is walking out the
 * door and it should not depend on a setting they chose months ago.
 *
 * Deliberately oversized for two buttons: this row is where reminders and the
 * rest of the "leaving now" actions will go, so it is built as a row of actions
 * rather than as two links.
 */
export function VisitNavRow({ address }: { address: string }) {
  const waze = navHref(address, "waze");
  const maps = navHref(address, "maps");
  if (!waze && !maps) return null;
  return (
    <div className="flex gap-2 border-b border-border px-[var(--page-x)] pb-3 pt-1">
      {waze && (
        <a
          href={waze}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-secondary text-[14px] font-semibold text-foreground transition active:scale-[0.98]"
        >
          <WazeMark size={18} />
          {NAV_APP_LABEL.waze}
        </a>
      )}
      {maps && (
        <a
          href={maps}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-secondary text-[14px] font-semibold text-foreground transition active:scale-[0.98]"
        >
          <MapsMark size={18} />
          {NAV_APP_LABEL.maps}
        </a>
      )}
    </div>
  );
}
