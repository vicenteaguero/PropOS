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
const SESSION = JSON.parse(
  readFileSync("/tmp/claude-501/-Users-vicenteaguero-real-state-PropOS/fb4a9bba-dfa9-4b5d-ae44-f79dd8ce1579/scratchpad/session.json", "utf8"),
);

const ROUTES = [
  ["home", "/admin"],
  ["crm-bandeja", "/admin/crm?tab=bandeja"],
  ["crm-personas", "/admin/crm?tab=personas"],
  ["crm-pipeline", "/admin/crm?tab=oportunidades"],
  ["crm-propiedades", "/admin/crm?tab=propiedades"],
  ["agenda", "/admin/agenda"],
  ["agenda-tareas", "/admin/agenda?tab=tareas"],
  ["notas", "/admin/agenda?tab=notas"],
  ["finanzas", "/admin/finanzas"],
  ["documentos", "/admin/documentos"],
  ["settings", "/admin/settings"],
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
    ([ref, session, tenant]) => {
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
      localStorage.setItem("propos.active_tenant_id", tenant);
      localStorage.setItem("propos:theme", "light");
      localStorage.setItem("propos:install-nudge-dismissed", "1");
    },
    [REF, SESSION, TENANT],
  );
  const page = await ctx.newPage();
  for (const [name, path] of ROUTES) {
    if (filter && !name.includes(filter)) continue;
    await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1800);
    await page.screenshot({ path: join(OUT, `${vname}-${name}.png`) });
    process.stdout.write(`${vname}-${name} `);
  }
  await ctx.close();
}
await browser.close();
console.log("\ndone →", OUT);
