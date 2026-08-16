# Audits (local only)

The audit reports themselves are **not committed**. This repository is public and
the reports enumerate open, unpatched findings with exact `file:line` locations —
publishing them before the fixes ship hands an attacker a map of a live system.

`.gitignore` keeps `docs/audits/*` local except this file.

## What lives here on a maintainer's machine

| Path | Contents |
|---|---|
| `v0.1.0/` | R1 (2026-06-16) — `REPORT.md` + 16 dimension files (security, database, bugs, testing, ui, ux, aesthetics, design, ai, prompt_engineering, performance, bottlenecks, deployment, docs, code_quality, chilean_laws) |
| `v0.1.0-r2/` | R2 (2026-07-02) — `REPORT.md` + PDF; verifies R1's 25 action items, re-audits UI/UX and spec completeness |

## Summary that *is* public

Release status per feature is tracked in
[`../versions/v0.1.0.md`](../versions/v0.1.0.md). It reflects the audited reality
(percentages, not "Done" checkmarks) without disclosing exploit detail.

## When these can be published

Once the Gate A–C remediation from R2 lands and a follow-up pass confirms the
findings closed, drop the `docs/audits/*` ignore rule and commit the reports as a
public engineering record.
