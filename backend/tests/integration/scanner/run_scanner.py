"""
Scanner pipeline visual harness.

Mirrors the JS pipeline used by the PWA editor (corner detection → perspective
warp → readability filter → Letter PDF assembly with 1 cm margins) so you can
iterate on output quality across many photos without booting the browser.

Reads `scenarios.json`, processes each folder under `fixtures/`, and writes
one PDF per filter variant under `output/<folder>-<filter>.pdf` (overwritten
on every run).

Dependencies: opencv-python, numpy, pillow, pillow-heif, reportlab.
The Makefile target installs them into the project's poetry env if missing.
"""
from __future__ import annotations

import io
import json
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    import cv2  # type: ignore[import-not-found]
    import numpy as np
    from PIL import Image  # type: ignore[import-not-found]
    from pillow_heif import register_heif_opener  # type: ignore[import-not-found]
    from reportlab.lib.pagesizes import letter  # type: ignore[import-not-found]
    from reportlab.pdfgen import canvas as rl_canvas  # type: ignore[import-not-found]
except ImportError as exc:
    sys.stderr.write(
        "Missing scanner-harness deps. Install with:\n"
        "  cd backend && poetry run pip install opencv-python pillow pillow-heif reportlab numpy\n"
        f"Original error: {exc}\n"
    )
    sys.exit(2)

register_heif_opener()

ROOT = Path(__file__).resolve().parent
FIXTURES_DIR = ROOT / "fixtures"
OUTPUT_DIR = ROOT / "output"
SCENARIOS = ROOT / "scenarios.json"

MAX_DIM = 800  # detection downscale
LETTER_W_PT, LETTER_H_PT = letter  # 612 x 792
MARGIN_PT = 28.35  # 1 cm

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


@dataclass
class Scenario:
    folder: str
    filters: list[str]


# ---------------------------------------------------------------- decoding


def load_image(path: Path) -> np.ndarray:
    """Returns RGB uint8 numpy array."""
    pil = Image.open(path).convert("RGB")
    return np.array(pil)


# ---------------------------------------------------------------- detection


def order_quad(pts: np.ndarray) -> np.ndarray:
    pts = pts.reshape(4, 2).astype(np.float32)
    s = pts.sum(axis=1)
    d = pts[:, 0] - pts[:, 1]
    ordered = np.zeros((4, 2), dtype=np.float32)
    ordered[0] = pts[np.argmin(s)]   # TL
    ordered[1] = pts[np.argmax(d)]   # TR
    ordered[2] = pts[np.argmax(s)]   # BR
    ordered[3] = pts[np.argmin(d)]   # BL
    return ordered


def detect_corners(image_rgb: np.ndarray) -> tuple[np.ndarray, bool]:
    h, w = image_rgb.shape[:2]
    scale = min(1.0, MAX_DIM / max(h, w))
    small = cv2.resize(image_rgb, (int(w * scale), int(h * scale)))
    gray = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    sh, sw = small.shape[:2]
    min_area = sh * sw * 0.2
    candidates = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4 and cv2.isContourConvex(approx):
            candidates.append((area, approx.astype(np.float32) / scale))
    if not candidates:
        # fallback: 5% inset rect
        ix, iy = w * 0.05, h * 0.05
        return (
            np.array([[ix, iy], [w - ix, iy], [w - ix, h - iy], [ix, h - iy]], dtype=np.float32),
            False,
        )
    candidates.sort(key=lambda t: t[0], reverse=True)
    return order_quad(candidates[0][1]), True


# ---------------------------------------------------------------- warp + filter


def output_size(quad: np.ndarray) -> tuple[int, int]:
    tl, tr, br, bl = quad
    width = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
    height = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
    return int(round(width)), int(round(height))


def warp(image_rgb: np.ndarray, quad: np.ndarray) -> np.ndarray:
    w, h = output_size(quad)
    dst = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)
    m = cv2.getPerspectiveTransform(quad, dst)
    return cv2.warpPerspective(
        image_rgb, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE
    )


def apply_filter(image_rgb: np.ndarray, mode: str) -> np.ndarray:
    if mode == "none":
        return image_rgb
    if mode == "bw":
        gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
        bw = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 25, 15
        )
        return cv2.cvtColor(bw, cv2.COLOR_GRAY2RGB)
    if mode == "enhance":
        lab = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        merged = cv2.merge([l, a, b])
        out = cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)
        blur = cv2.GaussianBlur(out, (0, 0), 1.5)
        return cv2.addWeighted(out, 1.5, blur, -0.5, 0)
    raise ValueError(f"unknown filter: {mode}")


# ---------------------------------------------------------------- pdf


def page_size_for(image_w: int, image_h: int) -> tuple[float, float]:
    """Pick portrait or landscape Letter to minimize wasted area."""
    portrait_waste = wasted(image_w, image_h, LETTER_W_PT, LETTER_H_PT)
    landscape_waste = wasted(image_w, image_h, LETTER_H_PT, LETTER_W_PT)
    return (
        (LETTER_H_PT, LETTER_W_PT) if landscape_waste < portrait_waste else (LETTER_W_PT, LETTER_H_PT)
    )


def wasted(iw: int, ih: int, pw: float, ph: float) -> float:
    cw = pw - 2 * MARGIN_PT
    ch = ph - 2 * MARGIN_PT
    if cw <= 0 or ch <= 0:
        return float("inf")
    scale = min(cw / iw, ch / ih)
    drawn = iw * scale * ih * scale
    return pw * ph - drawn


def to_jpeg_bytes(image_rgb: np.ndarray, quality: int = 85) -> bytes:
    pil = Image.fromarray(image_rgb)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def build_pdf(processed_images: list[np.ndarray], out_path: Path) -> None:
    c = rl_canvas.Canvas(str(out_path))
    for img in processed_images:
        h, w = img.shape[:2]
        page_w, page_h = page_size_for(w, h)
        c.setPageSize((page_w, page_h))
        content_w = page_w - 2 * MARGIN_PT
        content_h = page_h - 2 * MARGIN_PT
        scale = min(content_w / w, content_h / h)
        draw_w = w * scale
        draw_h = h * scale
        x = (page_w - draw_w) / 2
        y = (page_h - draw_h) / 2
        jpeg = to_jpeg_bytes(img)
        from reportlab.lib.utils import ImageReader  # type: ignore[import-not-found]

        c.drawImage(ImageReader(io.BytesIO(jpeg)), x, y, width=draw_w, height=draw_h)
        c.showPage()
    c.save()


# ---------------------------------------------------------------- driver


def discover_files(folder: Path) -> list[Path]:
    files = [p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXTS]
    files.sort(key=lambda p: (len(p.stem), p.stem))  # 0, 1, 2, ..., 10
    return files


def process_image(path: Path, filter_mode: str) -> tuple[np.ndarray, bool]:
    img = load_image(path)
    quad, auto = detect_corners(img)
    warped = warp(img, quad)
    return apply_filter(warped, filter_mode), auto


def main() -> int:
    if not SCENARIOS.exists():
        print(f"missing {SCENARIOS}", file=sys.stderr)
        return 1
    scenarios_raw = json.loads(SCENARIOS.read_text())
    scenarios = [Scenario(s["folder"], s["filters"]) for s in scenarios_raw]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows: list[tuple[str, str, int, str, int]] = []

    for sc in scenarios:
        folder = FIXTURES_DIR / sc.folder
        if not folder.exists():
            print(f"⚠️  skipping {sc.folder}: folder not found")
            continue
        files = discover_files(folder)
        if not files:
            print(f"⚠️  skipping {sc.folder}: no images")
            continue

        formats = ",".join(sorted({p.suffix.lstrip(".").lower() for p in files}))
        for filter_mode in sc.filters:
            processed: list[np.ndarray] = []
            auto_count = 0
            for f in files:
                img, auto = process_image(f, filter_mode)
                processed.append(img)
                if auto:
                    auto_count += 1
            out_path = OUTPUT_DIR / f"{sc.folder}-{filter_mode}.pdf"
            build_pdf(processed, out_path)
            size_kb = out_path.stat().st_size // 1024
            rows.append((sc.folder, filter_mode, len(files), formats, size_kb))
            print(
                f"✓ {sc.folder:<26} filter={filter_mode:<7} pages={len(files)} "
                f"auto={auto_count}/{len(files)} formats={formats:<10} → {out_path.name} "
                f"({size_kb} KB)"
            )

    print("\nDone. Open PDFs in output/ to inspect quality.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
