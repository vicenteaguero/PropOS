/**
 * Boots the app at every supported viewport and asserts the responsive shell.
 *
 *   npm run dev -- --port 5199        # in one terminal
 *   node scripts/viewport-check.mjs   # in another
 *
 * Checks, per viewport × route:
 *   - which shell rendered (bottom-nav below 768, sidebar at and above)
 *   - `--app-nav-h` / `--app-header-h`, so a pinned pane can't subtract chrome
 *     that isn't there
 *   - no horizontal overflow, naming the offending elements when there is
 *   - the page is named, has an h1, a skip link and a focusable <main>
 *   - no console errors or 4xx/5xx beyond the known dev-only noise
 *
 * Auth and data are INTERCEPTED, never real: the Supabase session is a stubbed
 * JWT in localStorage and every outbound request is either fulfilled from the
 * fixtures below or aborted. Nothing reaches the production project and nothing
 * is written anywhere. Screenshots therefore show structure, not real records.
 *
 * Requires `playwright` (not a project dependency — install it ad hoc):
 *   npm i -D playwright && npx playwright install chromium
 *
 * Found on its first run: a title index that ignored `end` so /admin/settings
 * came out titled "Inicio", a tenant row without `settings` white-screening the
 * whole app, and four optional chains that stopped one level short.
 */
import { mkdirSync, writeFileSync } from "node:fs";

// Playwright is intentionally NOT a project dependency — it pulls ~50 MB of
// browser binaries that only this script needs. Install it when you want to run
// the check, and fail loudly rather than cryptically when it's absent.
let chromium, devices;
try {
  ({ chromium, devices } = await import("playwright"));
} catch {
  console.error(
    "viewport-check needs playwright:\n" +
      "  npm i -D playwright && npx playwright install chromium\n" +
      "then start the dev server (npm run dev -- --port 5199) and re-run.",
  );
  process.exit(2);
}

const BASE = process.env.BASE ?? "http://localhost:5199";
const REF = process.env.REF ?? "tlbkwrjzraaikdrajwqh";
const OUT = process.env.OUT ?? "./viewport-shots";
mkdirSync(OUT, { recursive: true });

const USER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TENANT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/** Well-formed (unsigned) JWT — auth-js decodes and checks `exp` before use. */
function b64url(o) {
  return Buffer.from(JSON.stringify(o))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
const EXP = Math.floor(Date.now() / 1000) + 3600;
const ACCESS_TOKEN = [
  b64url({ alg: "HS256", typ: "JWT" }),
  b64url({
    sub: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    aud: "authenticated",
    role: "authenticated",
    email: "demo@propos.test",
    exp: EXP,
    iat: Math.floor(Date.now() / 1000),
    iss: "https://stub.supabase.co/auth/v1",
    session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }),
  "stubsignature",
].join(".");

const SESSION = {
  access_token: ACCESS_TOKEN,
  refresh_token: "stub-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: EXP,
  user: {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "demo@propos.test",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  },
};

const PROFILE = {
  id: USER_ID,
  full_name: "Vicente Agüero",
  role: "ADMIN",
  tenant_id: TENANT_ID,
  is_active: true,
  avatar_url: null,
  admin_scope: [],
};

const MEMBERSHIPS = [
  {
    user_id: USER_ID,
    tenant_id: TENANT_ID,
    tenant_name: "Propiedades Demo",
    tenant_slug: "demo",
    role: "ADMIN",
    admin_scope: [],
    is_dev_admin: true,
    view: "admin-dev",
    is_active: true,
  },
  {
    user_id: USER_ID,
    tenant_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    tenant_name: "Segunda Corredora",
    tenant_slug: "segunda",
    role: "ADMIN",
    admin_scope: [],
    is_dev_admin: false,
    view: "admin",
    is_active: true,
  },
];

/** Fixture rows keyed by the path fragment the app asks for. */
function apiFixture(path) {
  if (path.includes("/memberships/me")) return MEMBERSHIPS;
  if (path.includes("/grants/me")) return [];
  if (path.includes("/attention"))
    return {
      items: Array.from({ length: 6 }, (_, i) => ({
        id: `unanswered:a${i}`,
        kind: ["unanswered", "visit", "task", "lead", "stalled", "unanswered"][i],
        urgency: ["now", "now", "today", "today", "soon", "soon"][i],
        title: ["Ana Pérez", "Bruno Soto", "Carla Díaz", "Diego Rojas"][i % 4],
        subtitle: "Departamento 2D/2B en venta en Ñuñoa",
        reason: "Sin responder hace 3 h",
        at: "2026-08-18T12:00:00Z",
        deadline: "2026-08-19T12:00:00Z",
        contact_id: `c${i}`,
        property_id: null,
        conversation_id: i % 2 === 0 ? `conv${i}` : null,
        thread_id: null,
        event_id: null,
        task_id: null,
        opportunity_id: null,
      })),
      counts: { unanswered: 2, lead: 1, visit: 1, task: 1, stalled: 1 },
      total: 6,
    };
  if (path.includes("/analytics/pending-count")) return { pending_count: 7 };
  if (path.includes("/uf/today"))
    return {
      today: { date: "2026-08-18", value_clp: 39250.11, source: "sii.cl" },
      month_delta_pct: 0.31,
      year_delta_pct: 4.2,
    };
  if (path.includes("/uf/forward")) return { points: [] };
  if (path.includes("/uf/usd-today"))
    return { date: "2026-08-18", value_clp: 955.4, source: "mindicador.cl" };
  if (path.includes("/tenants/me"))
    return {
      id: TENANT_ID,
      name: "Propiedades Demo",
      slug: "demo",
      settings: {
        ai_assistant_name: "Propo",
        default_paper_size: "A4",
        brand_color: null,
      },
    };
  if (path.includes("/me")) return { id: USER_ID, full_name: "Vicente Agüero", admin_scope: [] };
  if (path.includes("/contacts"))
    return Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      tenant_id: TENANT_ID,
      full_name: ["Ana Pérez", "Bruno Soto", "Carla Díaz", "Diego Rojas"][i % 4] + ` ${i + 1}`,
      email: `persona${i}@ejemplo.cl`,
      phone: "+56 9 1234 5678",
      type: ["BUYER", "SELLER", "LANDOWNER", "STAKEHOLDER"][i % 4],
      rut: null,
      birthdate: null,
      address: "Av. Providencia 1234, Santiago",
      notes: null,
      metadata: {},
      is_draft: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
      deleted_at: null,
    }));
  if (path.includes("/properties"))
    return Array.from({ length: 9 }, (_, i) => ({
      id: `p${i}`,
      tenant_id: TENANT_ID,
      title: ["Departamento Providencia", "Casa Ñuñoa", "Oficina Las Condes"][i % 3] + ` ${i + 1}`,
      address: "Av. Providencia 1234, Santiago",
      status: "ACTIVE",
      is_draft: i === 4,
      description: null,
      bedrooms: 2 + (i % 3),
      bathrooms: 1 + (i % 2),
      area_sqm: 60 + i * 8,
      list_price_cents: (120000000 + i * 5000000) * 100,
      currency: "CLP",
      listing_kind: ["SALE", "RENT", "LEASE"][i % 3],
      year_built: 2015,
    }));
  return [];
}

const VIEWPORTS = [
  { name: "320-iphone-se", width: 320, height: 568, mobile: true },
  { name: "390-iphone-14", width: 390, height: 844, mobile: true },
  { name: "768-ipad-portrait", width: 768, height: 1024, mobile: true },
  { name: "1024-ipad-landscape", width: 1024, height: 768, mobile: false },
  { name: "1440-laptop", width: 1440, height: 900, mobile: false },
  { name: "2560-desktop", width: 2560, height: 1440, mobile: false },
];

const ROUTES = [
  { path: "/admin", name: "home" },
  { path: "/admin/clientes?tab=conversaciones", name: "clientes-conversaciones" },
  { path: "/admin/personas", name: "contacts" },
  { path: "/admin/properties", name: "properties" },
  { path: "/admin/settings", name: "settings" },
];

const problems = [];

async function run() {
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      userAgent: vp.mobile ? devices["iPhone 13"].userAgent : undefined,
    });

    // Seed the Supabase session before any app code runs.
    await ctx.addInitScript(
      ([ref, session]) => {
        // supabase-js v2 writes the session object itself under this key
        // (`setItemAsync(storage, storageKey, session)`), not the v1
        // `{ currentSession }` envelope.
        localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
        localStorage.setItem("propos:theme", "dark");
        localStorage.setItem("propos:install-nudge-dismissed", "0");
      },
      [REF, SESSION],
    );

    // Playwright matches the LAST registered route first, so the catch-all
    // deny must be registered before the specific handlers or it shadows them.
    await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) => route.abort());

    // Supabase REST (profiles).
    await ctx.route("**/rest/v1/**", (route) => {
      const body = route.request().url().includes("profiles") ? PROFILE : [];
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(body),
      });
    });
    // Supabase auth.
    await ctx.route("**/auth/v1/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(SESSION),
      }),
    );
    // Backend.
    await ctx.route("**/api/v1/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(apiFixture(new URL(route.request().url()).pathname)),
      }),
    );

    const page = await ctx.newPage();
    // vite.config pins the HMR client to :5443 (the mkcert HTTPS proxy), which
    // isn't running in this harness. Filter that noise, keep everything else.
    // Dev-only noise, not app defects:
    //  - vite.config pins the HMR client to :5443 (the mkcert HTTPS proxy),
    //    which isn't running here;
    //  - /health proxies to the backend, which a frontend-only run doesn't start.
    const isNoise = (t) => /websocket|5443|\[vite\]|\/health/i.test(t);
    // "Failed to load resource" carries no URL, and every one of them is already
    // reported by the response/requestfailed handlers below with the URL
    // attached — so drop it rather than log an unattributable duplicate.
    const isUnattributable = (t) => /^Failed to load resource/i.test(t);
    page.on("console", (m) => {
      const t = m.text();
      if (m.type() === "error" && !isNoise(t) && !isUnattributable(t))
        problems.push(`[console] ${vp.name} ${t.slice(0, 200)}`);
    });
    page.on("pageerror", (e) => {
      const t = String(e);
      if (!isNoise(t)) problems.push(`[pageerror] ${vp.name} ${t.slice(0, 200)}`);
    });
    page.on("response", (r) => {
      if (r.status() >= 400 && !isNoise(r.url()))
        problems.push(`[http ${r.status()}] ${vp.name} ${r.url().replace(BASE, "")}`);
    });
    page.on("requestfailed", (r) => {
      if (!isNoise(r.url()))
        problems.push(`[failed] ${vp.name} ${r.failure()?.errorText} ${r.url().replace(BASE, "")}`);
    });

    for (const r of ROUTES) {
      await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(900);

      // Horizontal overflow is the single most common responsive defect.
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
        offenders: [...document.querySelectorAll("*")]
          .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
          .slice(0, 5)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(r.right)}`;
          }),
      }));
      if (overflow.doc > overflow.win + 1) {
        problems.push(
          `[overflow] ${vp.name} ${r.name}: scrollWidth ${overflow.doc} > ${overflow.win}\n      ${overflow.offenders.join("\n      ")}`,
        );
      }

      // Which shell rendered, and is the nav reachable?
      const shell = await page.evaluate(() => {
        const bottomNav = document.querySelector('nav[aria-label="Navegación principal"]');
        const sidebar =
          document.querySelector('[data-slot="sidebar"]') ||
          document.querySelector('[data-sidebar]') ||
          document.querySelector("aside") ||
          document.querySelector('header [data-slot="sidebar-trigger"]');
        const main = document.getElementById("main-content");
        const navH = getComputedStyle(document.documentElement).getPropertyValue("--app-nav-h");
        const headerH = main
          ? getComputedStyle(main.parentElement).getPropertyValue("--app-header-h")
          : "";
        return {
          shell: bottomNav ? "bottom-nav" : sidebar ? "sidebar" : "none",
          navH: navH.trim(),
          headerH: headerH.trim(),
          mainTabIndex: main?.getAttribute("tabindex") ?? null,
          title: document.title,
          h1: document.querySelector("h1")?.textContent?.trim().slice(0, 40) ?? null,
          skipLink: !!document.querySelector('a[href="#main-content"]'),
        };
      });
      writeFileSync(
        `${OUT}/${vp.name}__${r.name}.json`,
        JSON.stringify({ ...shell, overflow }, null, 2),
      );
      await page.screenshot({ path: `${OUT}/${vp.name}__${r.name}.png`, fullPage: false });
      console.log(
        `  ${vp.name.padEnd(20)} ${r.name.padEnd(11)} shell=${shell.shell.padEnd(10)} navH=${(shell.navH || "0px").padEnd(7)} hdr=${(shell.headerH || "-").padEnd(7)} title="${shell.title}"`,
      );
    }
    await ctx.close();
  }

  await browser.close();
  const unique = [...new Set(problems)];
  console.log("\n=== PROBLEMS ===");
  console.log(unique.length ? unique.join("\n") : "  none");
  writeFileSync(`${OUT}/problems.txt`, unique.join("\n"));
  if (unique.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
