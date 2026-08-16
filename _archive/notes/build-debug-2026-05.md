# Build Debug Report — Final

## Fixes shipped (working now)

1. **Lint 1s warm**: removed 4 stale `eslint-disable` directives (rules not loaded in flat config), deleted dead `.eslintrc.cjs`, added `--cache` to `npm run lint`.
2. **Node 22 LTS via nvm**: brew Node 25.1 was buggy (`npm run` adds 60s). Run `nvm use 22` per shell, or new shell auto-loads (zshrc updated, default alias 22).
3. **Decoupled tsc from build**: `package.json` scripts:
   - `build` = `vite build` (no tsc)
   - `build:check` = old `tsc -b && vite build`
   - `typecheck` = `tsc --noEmit -p tsconfig.app.json`

## Confirmed root cause (still affects build)

**Bulk file operations on `~/Desktop/Desktop/real-state/PropOS` are extremely slow.**

Evidence:
- Single file read from Desktop: 855 MB/s (FAST).
- `cp -R frontend /tmp/frontend-test` (~600MB): **>2min, only got 8MB done** before kill.
- Same single-file read from `/tmp`: 7 GB/s.
- `tsc --noEmit test.ts` cold in `/tmp`: 20s. Warm: 0.3s.
- `tsc -b` on project: process running 2+ min, 1s CPU, 0 bytes output.
- `vite build` on project: same — stuck in "transforming..." indefinitely.

Sample/profiler shows main thread spinning in JS interpreter calling `node::fs::Read` → `uv__fs_work` → `read()` syscall. Per-syscall is fast, but bulk loops crawl.

## Likely culprit

`~/Desktop` has `com.apple.file-provider-domain-id` xattr → it's an iCloud Drive Desktop & Documents sync folder.
`defaults read com.apple.finder` shows `FXICloudDriveDesktop = 1` — iCloud Desktop sync ENABLED.

Even though individual file reads succeed instantly, macOS adds per-file overhead for:
- iCloud file-provider intercepts
- Spotlight indexing (Desktop is indexed by default)
- TCC privacy sandbox checks (`Desktop` requires user-granted access in modern macOS)

When `tsc`/`vite`/`rollup` walk thousands of files (lib.dom.d.ts, every `@types/*`, every src file, source maps), the per-file overhead × thousands = effectively a hang.

## Recommended fix (user action)

**Move the project out of `~/Desktop`.** E.g.:
```bash
mkdir -p ~/dev
mv ~/Desktop/Desktop/real-state ~/dev/real-state
cd ~/dev/real-state/PropOS
# update .vscode workspace, terminals, anything pinning the old path
```

After move:
- `npm run build` should complete in <60s
- `npm run typecheck` should complete (slow first time, fast warm with `tsc --build` incremental)
- Docker no longer required for normal frontend dev

## Alternatives if move not possible

- **Disable iCloud Desktop sync**: System Settings → Apple ID → iCloud → Drive → Options → uncheck "Desktop & Documents".
- **Exclude from Spotlight**: System Settings → Siri & Spotlight → Spotlight Privacy → add `~/Desktop/Desktop/real-state/PropOS`.
- **Grant Full Disk Access** to Terminal/iTerm/VS Code in System Settings → Privacy → Full Disk Access (TCC overhead drops).
- **Keep Docker for build** (current workflow).

## Next steps if user moves project

1. Verify `vite build` completes <60s.
2. Verify `tsc --noEmit -p tsconfig.app.json` completes (probably 30-90s warm; first cold may still be slow).
3. Re-test `make dev-pwa-hmr`.
