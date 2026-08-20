import { BandejaPage } from "@features/bandeja/pages/bandeja-page";

/**
 * `/<role>/client-inbox` — the WhatsApp-only view of the unified Bandeja.
 *
 * This route predates the CRM's four-tab layout and is still linked from the
 * router, so it stays. What it no longer does is carry its own copy of the
 * inbox: the screen it rendered — filters, thread list, master-detail, aside —
 * was the same screen as the email inbox with different nouns, and the two had
 * already drifted (one had a search box, the other a compose button, only one
 * silently hid conversations older than 30 days). It is now the shared inbox
 * with the channel switcher off.
 */
export function ClientInboxPage() {
  return <BandejaPage channels={["whatsapp"]} />;
}

// Default export so the router can code-split this page with React.lazy.
export default ClientInboxPage;
