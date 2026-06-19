// On-brand glyph marks (color + glyph) that lucide doesn't provide.
// Ported from the design mockup (brand.jsx). Not exact trademarked logos.

interface MarkProps {
  size?: number;
  radius?: number;
  className?: string;
}

/** WhatsApp (Kapso channel) — green tile + phone glyph. */
export function WhatsAppMark({ size = 20, radius, className }: MarkProps) {
  const r = radius ?? size * 0.28;
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: "#25D366",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.64} height={size * 0.64} viewBox="0 0 24 24" fill="none">
        <path d="M12 2.6A9.4 9.4 0 003.9 16.8L2.7 21l4.3-1.1A9.4 9.4 0 1012 2.6z" fill="#fff" />
        <path
          d="M8.4 7.3c-.2-.5-.4-.5-.7-.5h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.6.8c-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2-1.2-.7-.6-1.2-1.4-1.3-1.7-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.3 0-.5l-.9-1.6z"
          fill="#25D366"
        />
      </svg>
    </span>
  );
}

/** Titan (email channel) — white tile + geometric "T". */
export function TitanMark({ size = 20, radius, className }: MarkProps) {
  const r = radius ?? size * 0.28;
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#111"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M3.5 6.5 H20.5 L16.8 10.6 L12 9.2 L7.2 10.6 Z" />
        <path d="M9.6 10.4 V15.4 L7.4 17.6 L12 20.5 L16.6 17.6 L14.4 15.4 V10.4" />
      </svg>
    </span>
  );
}

export type ChannelBrand = "whatsapp" | "email" | "titan";

/** Channel mark: whatsapp → WhatsApp, email/titan → Titan. */
export function BrandMark({ brand, ...props }: MarkProps & { brand: ChannelBrand }) {
  return brand === "whatsapp" ? <WhatsAppMark {...props} /> : <TitanMark {...props} />;
}

/** Waze — cyan tile. */
export function WazeMark({ size = 20, radius, className }: MarkProps) {
  const r = radius ?? size * 0.28;
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: "#33CCFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="#fff">
        <path d="M12 4c4.1 0 7 2.8 7 6.4 0 3.9-3.3 6.9-7.8 6.9-.7 0-1.2.3-1.6.9-.4.6-1 1-1.7 1.1.2-.7.1-1.4-.3-1.9-1.3-1.4-1.8-3.2-1.8-5.1C5 7.7 7.9 4 12 4z" />
        <circle cx="9.7" cy="10" r="1" fill="#33CCFF" />
        <circle cx="14.3" cy="10" r="1" fill="#33CCFF" />
        <path
          d="M9.5 12.6c.6.7 1.5 1.1 2.5 1.1s1.9-.4 2.5-1.1"
          stroke="#33CCFF"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** Google Maps — white tile + pin. */
export function MapsMark({ size = 20, radius, className }: MarkProps) {
  const r = radius ?? size * 0.28;
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
        <path d="M12 22c4.5-5 7-8 7-11.5A7 7 0 005 10.5C5 14 7.5 17 12 22z" fill="#34A853" />
        <path d="M12 3.5a7 7 0 015.9 3.2L12 11 6.1 6.7A7 7 0 0112 3.5z" fill="#FBBC04" />
        <path d="M18.6 7.4A7 7 0 0119 10.5c0 1.6-.5 3-1.4 4.6L12 11z" fill="#4285F4" />
        <circle cx="12" cy="10.5" r="2.4" fill="#fff" />
      </svg>
    </span>
  );
}

export type NavApp = "waze" | "maps";

/** Navigation app mark (Waze / Google Maps). */
export function NavMark({ app, ...props }: MarkProps & { app: NavApp }) {
  return app === "waze" ? <WazeMark {...props} /> : <MapsMark {...props} />;
}

/** Lead-source portal mark — colored tile + short token (presentational). */
export function PortalMark({
  short,
  color,
  fg = "#fff",
  label,
  size = 20,
  radius,
  className,
}: MarkProps & { short: string; color: string; fg?: string; label?: string }) {
  const r = radius ?? size * 0.28;
  return (
    <span
      title={label}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: color,
        color: fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontWeight: 800,
        fontSize: size * (short.length > 1 ? 0.4 : 0.52),
        letterSpacing: -0.3,
      }}
    >
      {short}
    </span>
  );
}
