/**
 * Budget check on what the browser must fetch before it can paint.
 *
 * This exists because the regression it guards against was invisible for
 * months. `vite.config.ts` deliberately keeps the heavy route bundles out of
 * the service worker precache, with a comment explaining why — and meanwhile
 * `manualChunks` had quietly absorbed `clsx` into `vendor-pdf` and
 * `use-sync-external-store` into `vendor-charts`, so the entry chunk imported
 * both of them STATICALLY and 1.28 MB shipped on every visit anyway. Nothing
 * measured the first load, so nothing noticed.
 *
 * Three assertions, in increasing order of how badly they mean something broke:
 *
 *   1. No blacklisted chunk is preloaded from index.html.
 *   2. No blacklisted chunk is a static import of the entry chunk. This is the
 *      one that catches the real bug — a `modulepreload` is a symptom, a static
 *      import is the disease.
 *   3. The whole critical path stays under budget.
 *
 * Run after a build:
 *   npm run build && node scripts/critical-path-check.mjs
 *   npm run build:guard          # both, in one step
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = process.env.DIST ?? "./dist";

/**
 * Chunks that must never be on the first-paint path. Each serves exactly one
 * screen and each is enormous; the service worker's CacheFirst rule still keeps
 * them instant from the second visit onwards.
 */
const BLACKLIST = ["vendor-pdf", "vendor-charts", "property-map", "heic2any"];

/**
 * Uncompressed bytes allowed on the critical path: entry + its static vendor
 * imports + the stylesheet + anything `rel=preload` pulls in.
 *
 * Measured at ~1.029 kB after the manualChunks fix, so this leaves ~7% of room
 * for ordinary growth. Raising it is a decision, not a formality: every kB here
 * is paid by every user on every cold load, before anything renders.
 */
const BUDGET_KB = 1_100;

const problems = [];
const fail = (m) => problems.push(m);
const note = (m) => console.log(`  ${m}`);

let html;
try {
  html = readFileSync(join(DIST, "index.html"), "utf8");
} catch {
  console.error(`critical-path-check: no build found at ${DIST}. Run \`npm run build\` first.`);
  process.exit(2);
}

// ── 1. preload / modulepreload links ──────────────────────────────────────────
const linked = [...html.matchAll(/<link[^>]+href="(\/[^"]+)"[^>]*>/g)]
  .filter((m) => /rel="(module)?preload"|rel="stylesheet"/.test(m[0]))
  .map((m) => m[1]);

for (const href of linked) {
  const hit = BLACKLIST.find((name) => href.includes(`/${name}-`) || href.includes(`/${name}.`));
  if (hit) fail(`index.html preloads ${hit} (${href}) — it must not be on the first-paint path`);
}

// ── 2. static imports of the entry chunk ─────────────────────────────────────
const entryMatch = html.match(/<script[^>]+src="(\/assets\/index-[^"]+\.js)"/);
if (!entryMatch) {
  fail("could not find the entry <script> in index.html");
} else {
  const entry = readFileSync(join(DIST, entryMatch[1]), "utf8");
  // Static imports only: `from"./chunk.js"`. The dynamic-import dependency
  // table (__vite__mapDeps) is a plain string array and is deliberately not
  // matched — a lazy route depending on vendor-pdf is correct and expected.
  const staticImports = new Set(
    [...entry.matchAll(/from"\.\/([A-Za-z0-9_.-]+\.js)"/g)].map((m) => m[1]),
  );
  for (const name of staticImports) {
    const hit = BLACKLIST.find((b) => name.startsWith(`${b}-`));
    if (hit) {
      fail(
        `the entry chunk statically imports ${name}. Something small and shared ` +
          `(clsx, use-sync-external-store, …) has been absorbed into a heavy vendor group — ` +
          `name it explicitly in VENDOR_GROUPS in vite.config.ts`,
      );
    }
  }
  note(`entry static imports: ${[...staticImports].join(", ") || "none"}`);
}

// ── 3. budget ────────────────────────────────────────────────────────────────
const assets = new Map();
for (const file of readdirSync(join(DIST, "assets"))) {
  assets.set(`/assets/${file}`, statSync(join(DIST, "assets", file)).size);
}
const critical = new Set(linked);
if (entryMatch) critical.add(entryMatch[1]);
// A preload of something outside /assets (the pdf.js worker used to live in
// /pdfjs) still lands on the critical path, so size it too.
for (const href of linked) {
  if (!href.startsWith("/assets/")) {
    try {
      assets.set(href, statSync(join(DIST, href.slice(1))).size);
    } catch {
      /* missing file is not this check's problem */
    }
  }
}

let total = 0;
const rows = [];
for (const href of critical) {
  const size = assets.get(href) ?? 0;
  total += size;
  rows.push([href, size]);
}
rows.sort((a, b) => b[1] - a[1]);
for (const [href, size] of rows) note(`${(size / 1024).toFixed(1).padStart(8)} kB  ${href}`);

const totalKb = total / 1024;
note(`${totalKb.toFixed(1).padStart(8)} kB  TOTAL (budget ${BUDGET_KB} kB)`);
if (totalKb > BUDGET_KB) {
  fail(`critical path is ${totalKb.toFixed(1)} kB, over the ${BUDGET_KB} kB budget`);
}

if (problems.length) {
  console.error("\ncritical-path-check FAILED:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("\ncritical-path-check OK");
