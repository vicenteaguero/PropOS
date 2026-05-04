# Scanner pipeline harness

`make test-scanner` reads each folder under `fixtures/` and produces one PDF per
filter variant under `output/`. Mirrors the algorithm used by the PWA scanner so
you can iterate on quality without booting the browser.

## Layout

```
fixtures/
  01-id-ideal/        # photos for one document, named 0.jpg, 1.jpg, ...
  02-contract-wrinkled/
  ...
scenarios.json        # list of folders + filters to render
output/               # generated PDFs (gitignored, overwritten on each run)
run_scanner.py        # the driver
```

## Photo plan

| Folder | Photos | Document | Condition |
|--------|--------|----------|-----------|
| `01-id-ideal` | 0, 1 | ID front + back | flat surface, natural light |
| `02-contract-wrinkled` | 0, 1, 2 | printed contract | wrinkled, oblique angle |
| `03-id-low-light` | 0 | any ID | dim interior light |
| `04-multipage-mixed` | 0, 1, 2, 3 | 4 different pages | mix `.heic` (iPhone) + `.jpg` (WhatsApp) |
| `05-busy-background` | 0, 1 | document on patterned surface | wood/tablecloth |

Filenames `0`, `1`, `2`, ... determine page order. Folder name is descriptive.
HEIC, JPG, PNG, WebP are all accepted.

## Output naming

`output/<folder>-<filter>.pdf`, e.g. `01-id-ideal-bw.pdf`. Always overwritten.
