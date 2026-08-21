/**
 * Screenshots every main surface against the REAL dev backend and real demo
 * data, at desktop and phone widths.
 *
 *   (backend on :8000, vite on :5199)
 *   node scripts/shots.mjs [routeFilter]
 *
 * Unlike device-check.mjs this stubs NOTHING but the session: the point is to
 * see exactly what the user sees, which is what reviewing a diff cannot tell
 * you and what shipping without looking got wrong.
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const OUT =
  process.env.SHOT_DIR ??
  "/tmp/claude-501/-Users-vicenteaguero-real-state-PropOS/fb4a9bba-dfa9-4b5d-ae44-f79dd8ce1579/scratchpad/shots";
const BASE = "http://localhost:5199";
const REF = "tlbkwrjzraaikdrajwqh";
const TENANT = "dededede-0000-4000-8000-000000000001";
// A REAL Supabase session, because this harness talks to the real backend.
// Path is an env var: it used to be a hardcoded scratchpad path that died with
// the session that created it, and every run after that failed on ENOENT.
// Mint one with the service-role key:
//   POST {SUPABASE_URL}/auth/v1/admin/generate_link {type:"magiclink",email}
//   POST {SUPABASE_URL}/auth/v1/verify {type:"magiclink",token_hash:<hashed_token>}
const SESSION_PATH = process.env.SHOT_SESSION ?? `${OUT}/../session.json`;
const SESSION = JSON.parse(readFileSync(SESSION_PATH, "utf8"));

const ROUTES = [
  ["home", "/admin"],
  ["clientes-conversaciones", "/admin/clientes?tab=conversaciones"],
  // A real thread, open: the header, the day separators and the composer are
  // only reviewable with messages behind them.
  [
    "clientes-conversacion",
    "/admin/clientes?tab=conversaciones&hilo=whatsapp:623786ce-5a17-5598-b3be-92e88cd20c98",
  ],
  ["clientes-personas", "/admin/clientes?tab=personas"],
  ["clientes-persona", "/admin/personas/0c4c02d8-7a20-5b53-a220-69efe0baabcb"],
  ["clientes-negocios", "/admin/clientes?tab=negocios"],
  ["clientes-negocio", "/admin/negocios/04e138de-fbfd-5892-9364-16ec4d10bc95"],
  ["clientes-propiedades", "/admin/clientes?tab=propiedades"],
  // A unit inside a building AND with two price reductions: the fixture has to
  // exercise both sections or neither can be reviewed from a screenshot.
  ["clientes-propiedad", "/admin/propiedades/0881ce79-cdf7-5473-9abb-c8159c0d96a1"],
  ["clientes-propiedad-historial", "/admin/propiedades/50114b89-d1a6-52bc-b965-b7dd064dead5"],
  ["agenda", "/admin/agenda"],
  ["agenda-tareas", "/admin/agenda?tab=tareas"],
  ["notas", "/admin/agenda?tab=notas"],
  ["finanzas", "/admin/finanzas"],
  ["documentos", "/admin/documentos"],
  ["settings", "/admin/settings"],
  ["propo-politicas", "/admin/settings/propo"],
  ["settings-propo", "/admin/settings/propo"],
  ["pendientes", "/admin/pendientes"],
  ["catalogos-plantillas", "/admin/settings/clientes?tab=plantillas"],
  ["catalogos-listas", "/admin/settings/clientes?tab=listas"],
  ["catalogos-pipelines", "/admin/settings/clientes?tab=pipelines"],
  ["catalogos-etiquetas", "/admin/settings/clientes?tab=etiquetas"],
];

const VIEWS = [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
];

const filter = process.argv[2];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const [vname, width, height] of VIEWS) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  await ctx.addInitScript(
    // `process` does not exist in the page, so reading SHOT_THEME inside this
    // function threw and every run came out dark whatever was asked for. Env
    // has to be resolved here, in Node, and passed in as an argument.
    ([ref, session, tenant, theme]) => {
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
      localStorage.setItem("propos.active_tenant_id", tenant);
      localStorage.setItem("propos:theme", theme);
      localStorage.setItem("propos:install-nudge-dismissed", "1");
    },
    [REF, SESSION, TENANT, process.env.SHOT_THEME ?? "dark"],
  );
  const page = await ctx.newPage();
  // SHOT_DEBUG=1 when a section renders blank and you need to know whether its
  // request was made, refused, or simply returned nothing.
  if (process.env.SHOT_DEBUG === "1") {
    page.on("response", (r) => {
      if (r.url().includes("/api/")) console.log(`  ${r.status()} ${new URL(r.url()).pathname}`);
    });
    page.on("pageerror", (e) => console.log(`  PAGEERROR ${e}`));
  }
  for (const [name, path] of ROUTES) {
    if (filter && !name.includes(filter)) continue;
    await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(Number(process.env.SHOT_WAIT ?? 1800));
    await page.screenshot({ path: join(OUT, `${vname}-${name}.png`) });
    // Below the fold is where new sections land, and it is what a viewport shot
    // cannot show. The app scrolls an inner container rather than the document,
    // so `fullPage` sees one screen and a taller viewport makes the shell
    // render twice — scrolling the real container is the only faithful way.
    if (process.env.SHOT_FULL === "1") {
      const scrolled = await page.evaluate(() => {
        // Every scrollable container, not just the biggest: the page scroller
        // is nested inside the shell, and picking only the tallest one scrolled
        // a wrapper that barely moved while the content stayed put.
        const all = [...document.querySelectorAll("*")].filter(
          (n) => n.scrollHeight > n.clientHeight + 40,
        );
        all.forEach((n) => {
          n.scrollTop = n.scrollHeight;
        });
        window.scrollTo(0, document.body.scrollHeight);
        return all.length > 0;
      });
      if (scrolled) {
        await page.waitForTimeout(900);
        await page.screenshot({ path: join(OUT, `${vname}-${name}-bottom.png`) });
      }
    }
    process.stdout.write(`${vname}-${name} `);
  }
  await ctx.close();
}
await browser.close();
console.log("\ndone →", OUT);
