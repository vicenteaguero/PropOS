/**
 * Brand glyphs lucide does not carry.
 *
 * The outlines are the official ones, taken from Simple Icons (CC0) rather than
 * redrawn: the previous versions were freehand approximations, and a WhatsApp
 * bubble that is nearly right or a Waze face that is not quite the Waze face
 * reads as a knock-off — which is exactly how a broker judges whether the tool
 * on their phone is a real product. Colours are each brand's own.
 */

const WHATSAPP_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";

const WAZE_PATH =
  "M13.218 0C9.915 0 6.835 1.49 4.723 4.148c-1.515 1.913-2.31 4.272-2.31 6.706v1.739c0 .894-.62 1.738-1.862 1.813-.298.025-.547.224-.547.522-.05.82.82 2.31 2.012 3.502.82.844 1.788 1.515 2.832 2.036a3 3 0 0 0 2.955 3.528 2.966 2.966 0 0 0 2.931-2.385h2.509c.323 1.689 2.086 2.856 3.974 2.21 1.64-.546 2.36-2.409 1.763-3.924a12.84 12.84 0 0 0 1.838-1.465 10.73 10.73 0 0 0 3.18-7.65c0-2.882-1.118-5.589-3.155-7.625A10.899 10.899 0 0 0 13.218 0zm0 1.217c2.558 0 4.967.994 6.78 2.807a9.525 9.525 0 0 1 2.807 6.78A9.526 9.526 0 0 1 20 17.585a9.647 9.647 0 0 1-6.78 2.807h-2.46a3.008 3.008 0 0 0-2.93-2.41 3.03 3.03 0 0 0-2.534 1.367v.024a8.945 8.945 0 0 1-2.41-1.788c-.844-.844-1.316-1.614-1.515-2.11a2.858 2.858 0 0 0 1.441-.846 2.959 2.959 0 0 0 .795-2.036v-1.789c0-2.11.696-4.197 2.012-5.861 1.863-2.385 4.62-3.726 7.6-3.726zm-2.41 5.986a1.192 1.192 0 0 0-1.191 1.192 1.192 1.192 0 0 0 1.192 1.193A1.192 1.192 0 0 0 12 8.395a1.192 1.192 0 0 0-1.192-1.192zm7.204 0a1.192 1.192 0 0 0-1.192 1.192 1.192 1.192 0 0 0 1.192 1.193 1.192 1.192 0 0 0 1.192-1.193 1.192 1.192 0 0 0-1.192-1.192zm-7.377 4.769a.596.596 0 0 0-.546.845 4.813 4.813 0 0 0 4.346 2.757 4.77 4.77 0 0 0 4.347-2.757.596.596 0 0 0-.547-.845h-.025a.561.561 0 0 0-.521.348 3.59 3.59 0 0 1-3.254 2.061 3.591 3.591 0 0 1-3.254-2.061.64.64 0 0 0-.546-.348z";

const MAPS_PATH =
  "M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.314-.236.684-.627.687h-.007c-.466-.001-.579-.53-.695-.887-.284-.874-.581-1.713-1.019-2.525-.51-.944-1.145-1.817-1.79-2.671L19.527 4.799zM8.545 7.705l-3.959 4.707c.724 1.54 1.821 2.863 2.871 4.18.247.31.494.622.737.936l4.984-5.925-.029.01c-1.741.601-3.691-.291-4.392-1.987a3.377 3.377 0 0 1-.209-.716c-.063-.437-.077-.761-.004-1.198l.001-.007zM5.492 3.149l-.003.004c-1.947 2.466-2.281 5.88-1.117 8.77l4.785-5.689-.058-.05-3.607-3.035zM14.661.436l-3.838 4.563a.295.295 0 0 1 .027-.01c1.6-.551 3.403.15 4.22 1.626.176.319.323.683.377 1.045.068.446.085.773.012 1.22l-.003.016 3.836-4.561A8.382 8.382 0 0 0 14.67.439l-.009-.003zM9.466 5.868L14.162.285l-.047-.012A8.31 8.31 0 0 0 11.986 0a8.439 8.439 0 0 0-6.169 2.766l-.016.018 3.665 3.084z";

interface MarkProps {
  size?: number;
  radius?: number;
  className?: string;
}

/** WhatsApp (Kapso channel) — brand green tile + the official glyph. */
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
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="#fff" aria-hidden>
        <path d={WHATSAPP_PATH} />
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

/**
 * E-mail — a neutral tile, deliberately not a provider logo.
 *
 * WhatsApp is one service and can wear its own colour; "correo" is Titan today,
 * Gmail tomorrow and a portal's no-reply address most of the time. Painting one
 * vendor's mark on all of them would be a claim the data does not support, so
 * the channel gets a tile that matches WhatsApp's SHAPE — same size, same
 * radius — and carries the interface's own ink.
 */
export function EmailMark({ size = 20, radius, className }: MarkProps) {
  const r = radius ?? size * 0.28;
  return (
    <span
      // Tokens rather than a hex pair: this one has to read in both themes.
      className={["bg-foreground/10 text-foreground", className].filter(Boolean).join(" ")}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
        <path d="m3.5 6.5 8.5 6 8.5-6" />
      </svg>
    </span>
  );
}

export type ChannelBrand = "whatsapp" | "email" | "titan";

/** Channel mark: whatsapp → WhatsApp, email/titan → Titan. */
/**
 * Monochrome channel glyph — no tile, no brand colour, inherits currentColor.
 *
 * Full brand colour is for CHOOSING a channel (the inbox filter, a "write on
 * WhatsApp" action). Scanning a list is the opposite situation: nearly every
 * thread is WhatsApp, so the tile made the least informative element the most
 * saturated thing on screen — a green stripe down the left edge competing with
 * the state pill, which is the one thing in the row that should carry colour.
 */
function MonoChannelMark({ brand, size = 20, className }: MarkProps & { brand: ChannelBrand }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {brand === "whatsapp" ? (
        <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.6-5A8.4 8.4 0 1 1 21 11.5Z" />
      ) : (
        <>
          <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
          <path d="m3.5 6.5 8.5 6 8.5-6" />
        </>
      )}
    </svg>
  );
}

export function BrandMark({
  brand,
  mono,
  ...props
}: MarkProps & { brand: ChannelBrand; mono?: boolean }) {
  if (mono) return <MonoChannelMark brand={brand} {...props} />;
  return brand === "whatsapp" ? <WhatsAppMark {...props} /> : <TitanMark {...props} />;
}

/** Waze — brand cyan tile + the official mark. */
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
      <svg width={size * 0.68} height={size * 0.68} viewBox="0 0 24 24" fill="#fff" aria-hidden>
        <path d={WAZE_PATH} />
      </svg>
    </span>
  );
}

/** Google Maps — white tile + the official pin, in Maps red. */
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
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="#EA4335" aria-hidden>
        <path d={MAPS_PATH} />
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
