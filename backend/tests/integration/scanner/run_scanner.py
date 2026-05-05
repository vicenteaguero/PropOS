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

MAX_DIM = 1200
LETTER_W_PT, LETTER_H_PT = letter
MARGIN_PT = 28.35

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
    ordered[0] = pts[np.argmin(s)]
    ordered[1] = pts[np.argmax(d)]
    ordered[2] = pts[np.argmax(s)]
    ordered[3] = pts[np.argmin(d)]
    return ordered


def _find_paper_contour(gray: np.ndarray) -> np.ndarray | None:
    """jscanify's pipeline: Canny → blur → Otsu threshold → biggest contour.
    Simple but effective on flat documents with decent contrast vs background."""
    canny = cv2.Canny(gray, 50, 200)
    blur = cv2.GaussianBlur(canny, (3, 3), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    return max(contours, key=cv2.contourArea)


def _corners_from_contour(contour: np.ndarray) -> np.ndarray:
    """jscanify's getCornerPoints: split contour points into 4 quadrants
    relative to the minAreaRect center, then take the point farthest from the
    center in each quadrant. Robust to rounded/imperfect corners — no
    approxPolyDP convexity assumption."""
    rect = cv2.minAreaRect(contour)
    cx, cy = rect[0]
    pts = contour.reshape(-1, 2).astype(np.float32)

    tl = tr = bl = br = None
    tl_d = tr_d = bl_d = br_d = -1.0
    for x, y in pts:
        d = float((x - cx) ** 2 + (y - cy) ** 2)
        if x < cx and y < cy:
            if d > tl_d:
                tl_d, tl = d, (x, y)
        elif x > cx and y < cy:
            if d > tr_d:
                tr_d, tr = d, (x, y)
        elif x < cx and y > cy:
            if d > bl_d:
                bl_d, bl = d, (x, y)
        elif x > cx and y > cy:
            if d > br_d:
                br_d, br = d, (x, y)

    if None in (tl, tr, bl, br):
        return np.array([])
    return np.array([tl, tr, br, bl], dtype=np.float32)


def detect_corners(image_rgb: np.ndarray) -> tuple[np.ndarray, bool]:
    h, w = image_rgb.shape[:2]
    scale = min(1.0, MAX_DIM / max(h, w))
    small = cv2.resize(image_rgb, (int(w * scale), int(h * scale)))
    sh, sw = small.shape[:2]
    gray = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)

    contour = _find_paper_contour(gray)
    fallback_quad = np.array(
        [
            [w * 0.05, h * 0.05],
            [w - w * 0.05, h * 0.05],
            [w - w * 0.05, h - h * 0.05],
            [w * 0.05, h - h * 0.05],
        ],
        dtype=np.float32,
    )

    if contour is None:
        return fallback_quad, False
    area = cv2.contourArea(contour)
    if area < sh * sw * 0.05 or area > sh * sw * 0.85:
        return fallback_quad, False

    quad_small = _corners_from_contour(contour)
    if quad_small.size == 0:
        return fallback_quad, False

    quad_full = quad_small / scale
    return order_quad(quad_full), True


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
    warped = cv2.warpPerspective(image_rgb, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    # PDF output is always Letter portrait. If warp came out landscape, rotate
    # 90° counterclockwise so content reads upright on the page.
    if warped.shape[1] > warped.shape[0]:
        warped = cv2.rotate(warped, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return warped


def apply_filter(image_rgb: np.ndarray, mode: str) -> np.ndarray:
    if mode == "none":
        return image_rgb
    if mode == "bw":
        gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
        bw = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 25, 15)
        return cv2.cvtColor(bw, cv2.COLOR_GRAY2RGB)
    if mode == "enhance":
        lab = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=1.0, tileGridSize=(16, 16))
        l = clahe.apply(l)
        merged = cv2.merge([l, a, b])
        out = cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)
        blur = cv2.GaussianBlur(out, (0, 0), 1.0)
        return cv2.addWeighted(out, 1.2, blur, -0.2, 0)
    raise ValueError(f"unknown filter: {mode}")


# ---------------------------------------------------------------- pdf


def page_size_for(image_w: int, image_h: int) -> tuple[float, float]:
    """Always Letter portrait. Landscape images are pre-rotated upstream."""
    return LETTER_W_PT, LETTER_H_PT


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
    files.sort(key=lambda p: (len(p.stem), p.stem))
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
