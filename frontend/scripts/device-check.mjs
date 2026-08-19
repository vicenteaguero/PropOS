/**
 * Device-shape check: cutouts, clipped text, touch targets, back navigation.
 *
 *   npm run dev -- --port 5199
 *   node scripts/device-check.mjs
 *
 * Complements viewport-check.mjs, which only varies width. This one varies the
 * things a width sweep cannot see:
 *
 *   - SAFE AREAS. A headless browser always reports `env(safe-area-inset-*)` as
 *     0, so a notch, a Dynamic Island or a punch-hole can never fail a normal
 *     test — which is why the first pass shipped a header that sat flush against
 *     an island. The app reads its insets from `--safe-top/right/bottom/left`
 *     (index.css) precisely so a test can set them; each profile below injects a
 *     real device's values and we then assert nothing lands in the unsafe strip.
 *   - CLIPPED TEXT. `scrollWidth > clientWidth` on a leaf element means the label
 *     is being cut, which is how "Propiedades" lost its tail in a 4-up grid on a
 *     360px Android.
 *   - TOUCH TARGETS under 44×44 among elements actually on screen.
 *
 * Auth and data are stubbed exactly as in viewport-check.mjs; nothing leaves the
 * machine.
 */
import { mkdirSync, writeFileSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "device-check needs playwright:\n" +
      "  npm i -D playwright && npx playwright install chromium\n" +
      "then start the dev server (npm run dev -- --port 5199) and re-run.",
  );
  process.exit(2);
}

const BASE = process.env.BASE ?? "http://localhost:5199";
const REF = process.env.REF ?? "tlbkwrjzraaikdrajwqh";
const OUT = process.env.OUT ?? "./device-shots";
mkdirSync(OUT, { recursive: true });

const USER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TENANT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function b64url(o) {
  return Buffer.from(JSON.stringify(o))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
const EXP = Math.floor(Date.now() / 1000) + 3600;
const SESSION = {
  access_token: [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp: EXP }),
    "stub",
  ].join("."),
  refresh_token: "stub",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: EXP,
  user: { id: USER_ID, aud: "authenticated", role: "authenticated", email: "demo@propos.test" },
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
    tenant_name: "ANAIDA",
    tenant_slug: "anaida",
    role: "ADMIN",
    admin_scope: [],
    is_dev_admin: false,
    view: "admin",
    is_active: true,
  },
];

function apiFixture(path) {
  if (path.includes("/memberships/me")) return MEMBERSHIPS;
  if (path.includes("/grants/me")) return [];
  if (path.includes("/analytics/pending-count")) return { pending_count: 7 };
  if (path.includes("/uf/today"))
    return {
      today: { date: "2026-08-18", value_clp: 40900, source: "sii.cl" },
      month_delta_pct: 0.3,
      year_delta_pct: 4.2,
    };
  if (path.includes("/uf/forward")) return { points: [] };
  if (path.includes("/uf/usd-today"))
    return { date: "2026-08-18", value_clp: 955.4, source: "mindicador.cl" };
  if (path.includes("/tenants/me"))
    return {
      id: TENANT_ID,
      name: "ANAIDA",
      slug: "anaida",
      settings: { ai_assistant_name: "Propo", default_paper_size: "A4", brand_color: null },
    };
  return [];
}

/**
 * Real devices, with the insets each reports in a standalone PWA. The numbers
 * come from the physical cutouts: 59 for the Dynamic Island, 47 for the classic
 * notch, 34 for the home indicator, 24 for an Android status bar over a
 * punch-hole, 48 for a gesture-nav bar.
 */
const DEVICES = [
  {
    name: "iphone-se-2022",
    width: 375,
    height: 667,
    insets: { top: 20, right: 0, bottom: 0, left: 0 },
    touch: true,
    note: "no cutout, no home indicator",
  },
  {
    name: "iphone-13-notch",
    width: 390,
    height: 844,
    insets: { top: 47, right: 0, bottom: 34, left: 0 },
    touch: true,
    note: "classic notch",
  },
  {
    name: "iphone-15-pro-island",
    width: 393,
    height: 852,
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
    touch: true,
    note: "Dynamic Island",
  },
  {
    name: "iphone-15-pro-max",
    width: 430,
    height: 932,
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
    touch: true,
    note: "Dynamic Island, large",
  },
  {
    name: "android-360-punchhole",
    width: 360,
    height: 800,
    insets: { top: 24, right: 0, bottom: 48, left: 0 },
    touch: true,
    note: "narrowest common Android, gesture nav",
  },
  {
    name: "android-412-pixel",
    width: 412,
    height: 915,
    insets: { top: 24, right: 0, bottom: 48, left: 0 },
    touch: true,
    note: "Pixel-class",
  },
  {
    name: "iphone-13-landscape",
    width: 844,
    height: 390,
    insets: { top: 0, right: 47, bottom: 21, left: 47 },
    touch: true,
    note: "notch moves to the side",
  },
  // Guards against a regression on the big screens, which must not change.
  { name: "tablet-768", width: 768, height: 1024, insets: null, touch: true, note: "iPad portrait" },
  { name: "laptop-1440", width: 1440, height: 900, insets: null, touch: false, note: "laptop (pointer: fine — the touch floor does not apply)" },
];

const ROUTES = [
  { path: "/admin", name: "home" },
  { path: "/admin/personas", name: "contacts" },
  { path: "/admin/properties", name: "properties" },
  { path: "/admin/settings", name: "settings" },
  { path: "/admin/calendario", name: "calendar" },
  { path: "/admin/tareas", name: "tasks" },
  { path: "/admin/client-inbox", name: "inbox" },
];

const problems = [];
const add = (dev, route, kind, msg) => problems.push(`[${kind}] ${dev} ${route}: ${msg}`);

async function run() {
  const browser = await chromium.launch();

  for (const dev of DEVICES) {
    const isPhone = dev.width < 768;
    const ctx = await browser.newContext({
      viewport: { width: dev.width, height: dev.height },
      deviceScaleFactor: 2,
      isMobile: isPhone,
      // Must match the profile: without this the browser reports
      // `pointer: fine`, the coarse-only touch floor never applies, and the
      // check then fails a rule it prevented from running.
      hasTouch: !!dev.touch,
    });

    await ctx.addInitScript(
      ([ref, session, insets]) => {
        localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
        localStorage.setItem("propos:theme", "dark");
        localStorage.setItem("propos:install-nudge-dismissed", "1");
        if (insets) {
          // Stand in for env(safe-area-inset-*), which a headless browser always
          // reports as 0. The app reads these tokens, so this exercises the real
          // code path rather than a mock.
          const css = `:root{--safe-top:${insets.top}px;--safe-right:${insets.right}px;--safe-bottom:${insets.bottom}px;--safe-left:${insets.left}px}`;
          document.addEventListener("DOMContentLoaded", () => {
            const el = document.createElement("style");
            el.id = "safe-area-sim";
            el.textContent = css;
            document.head.appendChild(el);
          });
        }
      },
      [REF, SESSION, dev.insets],
    );

    await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
    await ctx.route("**/rest/v1/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(r.request().url().includes("profiles") ? PROFILE : []),
      }),
    );
    await ctx.route("**/auth/v1/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(SESSION),
      }),
    );
    await ctx.route("**/v1/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(apiFixture(new URL(r.request().url()).pathname)),
      }),
    );

    const page = await ctx.newPage();
    const noise = (t) => /websocket|5443|\[vite\]|\/health|Failed to load resource/i.test(t);
    page.on("pageerror", (e) => !noise(String(e)) && add(dev.name, "-", "pageerror", String(e)));

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      await audit(page, dev, route.name);
      await page.screenshot({ path: `${OUT}/${dev.name}__${route.name}.png` });
    }

    // The "Más" sheet is the phone's whole navigation; check it fits.
    if (dev.touch) {
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const more = page.getByRole("button", { name: /^más/i });
      if (await more.count()) {
        await more.first().click();
        await page.waitForTimeout(600);
        await audit(page, dev, "more-sheet");
        await page.screenshot({ path: `${OUT}/${dev.name}__more-sheet.png` });
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(300);
      }
    }

    // The Propo overlay is the surface the phone screenshots showed failing.
    if (isPhone) {
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const fab = page.locator('button[aria-label="Abrir Propo"]');
      if (await fab.count()) {
        await fab.first().click();
        await page.waitForTimeout(700);
        const opened = await page.getByRole("button", { name: /cerrar/i }).count();
        if (!opened) {
          add(dev.name, "propo-overlay", "setup", "overlay did not open — back result is unreliable");
        }
        await audit(page, dev, "propo-overlay");
        await page.screenshot({ path: `${OUT}/${dev.name}__propo-overlay.png` });

        // Android's back gesture must close the overlay, not leave the page.
        // StrictMode double-invokes effects in dev, so the dismiss hook pushes,
        // pops and re-pushes its history entry. Let that settle before testing
        // Back, or this races the hook's own cleanup and pops twice.
        await page.waitForTimeout(600);
        const before = page.url();
        // history.back() is what the OS Back gesture triggers in a standalone
        // PWA. page.goBack() walks the stack this test built with its own
        // goto()s, which is not the same thing.
        await page.evaluate(() => window.history.back());
        await page.waitForTimeout(600);
        const overlayStillOpen = await page.getByRole("button", { name: /cerrar/i }).count();
        if (opened && overlayStillOpen > 0) {
          add(dev.name, "propo-overlay", "back", "back did not close the overlay");
        } else if (opened && page.url() !== before) {
          add(dev.name, "propo-overlay", "back", `back navigated away (${before} -> ${page.url()})`);
        }
      }
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

/** Occlusion by a cutout, clipped text, tiny touch targets, sideways overflow. */
async function audit(page, dev, routeName) {
  const res = await page.evaluate(({ insets, touch }) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out = { occluded: [], clipped: [], small: [], overflow: null };

    const label = (el) => {
      const cls = String(el.className || "").slice(0, 48);
      const txt = (el.textContent || "").trim().slice(0, 28);
      return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${txt ? ` "${txt}"` : ""}`;
    };
    const visible = (el) => {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh;
    };

    const all = [...document.querySelectorAll("body *")].filter(visible);

    // 1. Anything meaningful inside the cutout strip.
    if (insets) {
      for (const el of all) {
        if (!el.matches("button, a, input, textarea, select, h1, h2, [role=button]")) continue;
        const r = el.getBoundingClientRect();
        // An ancestor that scrolls or clips already governs what is on screen,
        // so the element is not sitting under the cutout — it is scrolled or
        // clipped. The collapsed sidebar uses overflow:hidden, the filter chip
        // row uses overflow-x:auto; both were reported as occlusions.
        let contained = false;
        for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
          const ov = getComputedStyle(n);
          if (/(auto|scroll|hidden)/.test(ov.overflowX + " " + ov.overflowY)) {
            contained = true;
            break;
          }
        }
        if (contained) continue;
        if (insets.top && r.top < insets.top) out.occluded.push(`top ${label(el)} top=${Math.round(r.top)} < ${insets.top}`);
        // Only chrome pinned to the viewport can be permanently covered by a
        // bottom cutout; ordinary content past the fold simply scrolls.
        const pinned = ["fixed", "sticky"].includes(getComputedStyle(el).position);
        if (insets.bottom && pinned && r.bottom > vh - insets.bottom)
          out.occluded.push(`bottom ${label(el)} bottom=${Math.round(r.bottom)} > ${vh - insets.bottom}`);
        if (insets.left && r.left < insets.left) out.occluded.push(`left ${label(el)} left=${Math.round(r.left)}`);
        if (insets.right && r.right > vw - insets.right) out.occluded.push(`right ${label(el)} right=${Math.round(r.right)}`);
      }
    }

    // 2. Text cut off by its own box.
    for (const el of all) {
      if (el.children.length) continue;
      const t = (el.textContent || "").trim();
      if (!t) continue;
      // sr-only text is clipped by design; the sidebar rail is pointer-driven.
      if (el.closest(".sr-only") || el.classList.contains("sr-only")) continue;
      const s = getComputedStyle(el);
      if (s.overflow === "visible" && s.textOverflow !== "ellipsis") {
        // A visible overflow spills rather than clips; only flag real clipping.
        if (el.scrollWidth > el.clientWidth + 1 && s.whiteSpace === "nowrap")
          out.clipped.push(`${label(el)} ${el.scrollWidth}>${el.clientWidth}`);
        continue;
      }
      if (s.textOverflow === "ellipsis") continue;
      if (el.scrollWidth > el.clientWidth + 1) out.clipped.push(`${label(el)} ${el.scrollWidth}>${el.clientWidth}`);
    }

    // 3. Touch targets below 44×44, hit-area pseudo-element included.
    //    Only meaningful where a finger is the pointer.
    for (const el of touch ? all : []) {
      if (!el.matches("button, a[href], input[type=checkbox], input[type=radio], [role=button], [role=switch]")) continue;
      if (el.querySelector("button, a[href]")) continue;
      // The desktop sidebar is a pointer surface with its own density; the touch
      // floor applies to the phone shell and to anything inside a touch overlay.
      if (el.closest('[data-slot="sidebar"]')) continue;
      const r = el.getBoundingClientRect();
      const after = getComputedStyle(el, "::after");
      const aw = parseFloat(after.width) || 0;
      const ah = parseFloat(after.height) || 0;
      const w = Math.max(r.width, aw);
      const h = Math.max(r.height, ah);
      if (w < 44 || h < 44) out.small.push(`${label(el)} ${Math.round(w)}x${Math.round(h)}`);
    }

    if (document.documentElement.scrollWidth > vw + 1)
      out.overflow = `${document.documentElement.scrollWidth} > ${vw}`;

    // 4. Fixed chrome that overruns a short viewport. In landscape the phone is
    //    390px tall, so an overlay sized for portrait simply runs off-screen
    //    with its actions unreachable.
    out.tall = [];
    for (const el of all) {
      const pos = getComputedStyle(el).position;
      if (pos !== "fixed" && pos !== "absolute") continue;
      const r = el.getBoundingClientRect();
      if (r.height <= vh + 1) continue;
      // Fine if it scrolls internally.
      const ov = getComputedStyle(el);
      if (/(auto|scroll)/.test(ov.overflowY)) continue;
      if ([...el.querySelectorAll("*")].some((c) => /(auto|scroll)/.test(getComputedStyle(c).overflowY)))
        continue;
      out.tall.push(`${label(el)} h=${Math.round(r.height)} > ${vh}`);
    }
    return out;
  }, { insets: dev.insets, touch: !!dev.touch });

  for (const o of res.occluded.slice(0, 6)) add(dev.name, routeName, "cutout", o);
  for (const c of res.clipped.slice(0, 6)) add(dev.name, routeName, "clipped", c);
  for (const s of res.small.slice(0, 6)) add(dev.name, routeName, "touch", s);
  if (res.overflow) add(dev.name, routeName, "overflow", res.overflow);
  for (const t of (res.tall ?? []).slice(0, 4)) add(dev.name, routeName, "tall", t);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
