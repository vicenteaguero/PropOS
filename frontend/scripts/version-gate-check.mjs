/**
 * End-to-end check for the update gate.
 *
 * Serves the production build, lies to the running tab about which commit the
 * server has, and asserts the tab notices and reloads onto it — plus that the
 * loop guard stops after the cap when the "new" build never actually arrives
 * (the half-propagated-CDN case).
 *
 *   npm run build && npm run preview -- --port 4180
 *   BASE=http://localhost:4180 node scripts/version-gate-check.mjs
 */
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("version-gate-check needs playwright:\n  npm i -D playwright");
  process.exit(2);
}

const BASE = process.env.BASE ?? "http://localhost:4180";
const OVERLAY = "Actualizando aplicación";

const problems = [];
const note = (m) => console.log(`  ${m}`);
const fail = (m) => {
  problems.push(m);
  console.log(`  ✗ ${m}`);
};
const pass = (m) => console.log(`  ✓ ${m}`);

const browser = await chromium.launch();
const context = await browser.newContext({ serviceWorkers: "allow" });
const page = await context.newPage();

/** Serve a version for /version.json; `null` lets the real file through. */
let served = null;
await context.route("**/version.json*", async (route) => {
  if (served === null) return route.fallback();
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ version: served }),
  });
});

let reloads = 0;
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) reloads += 1;
});

console.log(`\n=== update gate @ ${BASE} ===`);

// --- control: matching version must not raise the overlay -------------------
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
const real = await page.evaluate(async () => {
  const r = await fetch("/version.json", { cache: "no-store" });
  return (await r.json()).version;
});
note(`build servido: ${real}`);

await page.waitForTimeout(1500);
if (await page.getByText(OVERLAY).isVisible().catch(() => false)) {
  fail("overlay aparece con versiones iguales (falso positivo)");
} else {
  pass("sin overlay cuando la versión coincide");
}

// --- mismatch: the tab must notice and reload -------------------------------
served = "e2e-nueva-version";
const before = reloads;
await page.evaluate(() => window.dispatchEvent(new Event("focus")));

let sawOverlay = false;
try {
  await page.getByText(OVERLAY).waitFor({ state: "visible", timeout: 4000 });
  sawOverlay = true;
  pass("overlay 'Actualizando aplicación' visible al detectar build nuevo");
} catch {
  fail("overlay no apareció con una versión distinta en el servidor");
}

if (sawOverlay) {
  // Must cover a real network round trip plus the UPDATE_DEADLINE_MS ceiling in
  // applyUpdate — a local preview reloads in milliseconds and hides regressions
  // that only show up against a deployed origin.
  const deadline = Date.now() + 12000;
  while (reloads === before && Date.now() < deadline) await page.waitForTimeout(500);
  if (reloads > before) pass(`recargó (${reloads - before} navegación/es)`);
  else fail("mostró el overlay pero nunca recargó dentro de 12s");
}

// --- loop guard: a version that never arrives must not spin forever ---------
// `served` still advertises a build the bundle will never match, so every check
// is a mismatch. The guard has to stop after MAX_ATTEMPTS (2).
await page.waitForTimeout(2000);
const attempts = await page.evaluate(() => {
  try {
    return JSON.parse(sessionStorage.getItem("propos:update-attempt") ?? "null");
  } catch {
    return null;
  }
});
if (attempts && attempts.count <= 2) {
  pass(`guard tope respetado (count=${attempts.count}, target=${attempts.target})`);
} else if (!attempts) {
  fail("no quedó registro de intentos — el guard no se está aplicando");
} else {
  fail(`guard excedido: count=${attempts.count}`);
}

const settled = reloads;
await page.evaluate(() => window.dispatchEvent(new Event("focus")));
await page.waitForTimeout(2500);
if (reloads > settled) fail(`siguió recargando tras el tope (${reloads - settled} más)`);
else pass("dejó de recargar tras alcanzar el tope");

await browser.close();

console.log("\n=== PROBLEMS ===");
console.log(problems.length ? problems.map((p) => `  ${p}`).join("\n") : "  none");
process.exit(problems.length ? 1 : 0);
