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

const OUT = process.env.SHOT_DIR ?? "/tmp/claude-501/-Users-vicenteaguero-real-state-PropOS/fb4a9bba-dfa9-4b5d-ae44-f79dd8ce1579/scratchpad/shots";
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
  ["clientes-personas", "/admin/clientes?tab=personas"],
  ["clientes-persona", "/admin/personas/0c4c02d8-7a20-5b53-a220-69efe0baabcb"],
  ["clientes-negocios", "/admin/clientes?tab=negocios"],
  ["clientes-negocio", "/admin/negocios/04e138de-fbfd-5892-9364-16ec4d10bc95"],
  ["clientes-propiedades", "/admin/clientes?tab=propiedades"],
  ["agenda", "/admin/agenda"],
  ["agenda-tareas", "/admin/agenda?tab=tareas"],
  ["notas", "/admin/agenda?tab=notas"],
  ["finanzas", "/admin/finanzas"],
  ["documentos", "/admin/documentos"],
  ["settings", "/admin/settings"],
  ["settings-propo", "/admin/settings/propo"],
  ["pendientes", "/admin/pendientes"],
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
  for (const [name, path] of ROUTES) {
    if (filter && !name.includes(filter)) continue;
    await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(Number(process.env.SHOT_WAIT ?? 1800));
    await page.screenshot({ path: join(OUT, `${vname}-${name}.png`) });
    process.stdout.write(`${vname}-${name} `);
  }
  await ctx.close();
}
await browser.close();
console.log("\ndone →", OUT);
