"""
DocScanner harness (deep-learning rectification).

Runs the pretrained DocScanner-L model from fh2019ustc/DocScanner over each
folder under fixtures/, producing one PDF per filter variant under output/.
Parallel implementation to run_scanner.py (classic CV/jscanify) so we can
compare quality side-by-side.

Pipeline:
  1. U2NETP segments paper from background → mask.
  2. DocScanner produces backward map (bm).
  3. F.grid_sample warps the original photo using bm → flat rectified document.
  4. Apply filter (none/bw/enhance) and assemble Letter portrait PDF.

Pretrained models live in docscanner/model_pretrained/ (downloaded via gdown
from the official Google Drive folder).
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from pillow_heif import register_heif_opener
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas

ROOT = Path(__file__).resolve().parent
DOCSCANNER_DIR = ROOT / "docscanner"
sys.path.insert(0, str(DOCSCANNER_DIR))

from model import DocScanner  # noqa: E402
from seg import U2NETP  # noqa: E402

register_heif_opener()

FIXTURES_DIR = ROOT / "fixtures"
OUTPUT_DIR = ROOT / "output_docscanner"
SCENARIOS = ROOT / "scenarios.json"
SEG_WEIGHTS = DOCSCANNER_DIR / "model_pretrained" / "seg.pth"
REC_WEIGHTS = DOCSCANNER_DIR / "model_pretrained" / "DocScanner-L.pth"

LETTER_W_PT, LETTER_H_PT = letter
MARGIN_PT = 28.35
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}

DEVICE = (
    torch.device("mps")
    if torch.backends.mps.is_available()
    else torch.device("cpu")
)


# --------------------------------------------------------------- model wiring


class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.msk = U2NETP(3, 1)
        self.bm = DocScanner()

    def forward(self, x):
        msk, *_ = self.msk(x)
        msk_bin = (msk > 0.5).float()
        x_masked = msk_bin * x
        bm = self.bm(x_masked, iters=12, test_mode=True)
        bm = (2 * (bm / 286.8) - 1) * 0.99
        return bm, msk_bin


def _load_seg(model: nn.Module, path: Path) -> None:
    raw = torch.load(path, map_location="cpu", weights_only=True)
    state = model.state_dict()
    # Original training prefixed with "module.", strip it and only keep matching keys.
    pretrained = {k[6:]: v for k, v in raw.items() if k[6:] in state}
    state.update(pretrained)
    model.load_state_dict(state)


def _load_rec(model: nn.Module, path: Path) -> None:
    raw = torch.load(path, map_location="cpu", weights_only=True)
    state = model.state_dict()
    pretrained = {k: v for k, v in raw.items() if k in state}
    state.update(pretrained)
    model.load_state_dict(state)


def build_net() -> Net:
    net = Net()
    _load_seg(net.msk, SEG_WEIGHTS)
    _load_rec(net.bm, REC_WEIGHTS)
    net.eval().to(DEVICE)
    return net


# --------------------------------------------------------------- inference


def _crop_to_mask(rectified: np.ndarray, mask: np.ndarray, pad_ratio: float = 0.01) -> np.ndarray:
    """Find the tightest bbox containing the document mask and crop. Adds a
    small padding so the document doesn't kiss the page margin."""
    ys, xs = np.where(mask > 0.5)
    if len(xs) < 50:
        return rectified
    h, w = rectified.shape[:2]
    pad_x = int(w * pad_ratio)
    pad_y = int(h * pad_ratio)
    x0 = max(0, int(xs.min()) - pad_x)
    y0 = max(0, int(ys.min()) - pad_y)
    x1 = min(w, int(xs.max()) + pad_x)
    y1 = min(h, int(ys.max()) + pad_y)
    if x1 - x0 < 50 or y1 - y0 < 50:
        return rectified
    return rectified[y0:y1, x0:x1]


def rectify(net: Net, image_rgb: np.ndarray) -> np.ndarray:
    """Run DocScanner on a single image. Returns rectified+cropped RGB uint8."""
    h, w = image_rgb.shape[:2]
    im_norm = image_rgb.astype(np.float32) / 255.0

    inp = cv2.resize(im_norm, (288, 288)).transpose(2, 0, 1)
    inp_t = torch.from_numpy(inp).float().unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        bm, msk_small = net(inp_t)
        bm = bm.cpu()
        msk_small = msk_small.cpu()

    bm0 = cv2.resize(bm[0, 0].numpy(), (w, h))
    bm1 = cv2.resize(bm[0, 1].numpy(), (w, h))
    bm0 = cv2.blur(bm0, (3, 3))
    bm1 = cv2.blur(bm1, (3, 3))
    grid = torch.from_numpy(np.stack([bm0, bm1], axis=2)).unsqueeze(0)

    src = torch.from_numpy(im_norm).permute(2, 0, 1).unsqueeze(0).float()
    out = F.grid_sample(src, grid, align_corners=True)
    rectified = (out[0].permute(1, 2, 0).numpy() * 255.0).clip(0, 255).astype(np.uint8)

    # The dewarp barely moves pixels in screen space — bbox of the U2NETP mask
    # in source space is a good approximation of the document bbox in rectified
    # space. Apply it directly.
    msk_full = cv2.resize(msk_small[0, 0].numpy(), (w, h))
    rectified = _crop_to_mask(rectified, msk_full)

    # Always-portrait policy: rotate 90° CCW if landscape.
    if rectified.shape[1] > rectified.shape[0]:
        rectified = cv2.rotate(rectified, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return rectified


# --------------------------------------------------------------- filters


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
        clahe = cv2.createCLAHE(clipLimit=1.0, tileGridSize=(16, 16))
        l = clahe.apply(l)
        merged = cv2.merge([l, a, b])
        out = cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)
        blur = cv2.GaussianBlur(out, (0, 0), 1.0)
        return cv2.addWeighted(out, 1.2, blur, -0.2, 0)
    raise ValueError(f"unknown filter: {mode}")


# --------------------------------------------------------------- pdf


def to_jpeg_bytes(image_rgb: np.ndarray, quality: int = 85) -> bytes:
    pil = Image.fromarray(image_rgb)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def build_pdf(images: list[np.ndarray], out_path: Path) -> None:
    c = rl_canvas.Canvas(str(out_path), pagesize=(LETTER_W_PT, LETTER_H_PT))
    for img in images:
        h, w = img.shape[:2]
        content_w = LETTER_W_PT - 2 * MARGIN_PT
        content_h = LETTER_H_PT - 2 * MARGIN_PT
        scale = min(content_w / w, content_h / h)
        draw_w, draw_h = w * scale, h * scale
        x = (LETTER_W_PT - draw_w) / 2
        y = (LETTER_H_PT - draw_h) / 2
        c.drawImage(
            ImageReader(io.BytesIO(to_jpeg_bytes(img))), x, y, width=draw_w, height=draw_h
        )
        c.showPage()
    c.save()


# --------------------------------------------------------------- driver


def discover_files(folder: Path) -> list[Path]:
    files = [p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXTS]
    files.sort(key=lambda p: (len(p.stem), p.stem))
    return files


def load_image(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"))


def main() -> int:
    if not SEG_WEIGHTS.exists() or not REC_WEIGHTS.exists():
        print(
            f"missing pretrained models. expected:\n  {SEG_WEIGHTS}\n  {REC_WEIGHTS}\n"
            "Run: poetry run gdown --folder "
            "https://drive.google.com/drive/folders/1W1_DJU8dfEh6FqDYqFQ7ypR38Z8c5r4D "
            "-O backend/tests/integration/scanner/docscanner/model_pretrained",
            file=sys.stderr,
        )
        return 2
    if not SCENARIOS.exists():
        print(f"missing {SCENARIOS}", file=sys.stderr)
        return 1

    print(f"device: {DEVICE}")
    net = build_net()
    print("model loaded")

    scenarios = json.loads(SCENARIOS.read_text())
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for sc in scenarios:
        folder = FIXTURES_DIR / sc["folder"]
        if not folder.exists():
            print(f"⚠️  skipping {sc['folder']}: folder not found")
            continue
        files = discover_files(folder)
        if not files:
            print(f"⚠️  skipping {sc['folder']}: no images")
            continue

        rectified: list[np.ndarray] = []
        for f in files:
            img = load_image(f)
            rect = rectify(net, img)
            rectified.append(rect)

        formats = ",".join(sorted({p.suffix.lstrip(".").lower() for p in files}))
        for filter_mode in sc["filters"]:
            processed = [apply_filter(r, filter_mode) for r in rectified]
            out_path = OUTPUT_DIR / f"{sc['folder']}-{filter_mode}.pdf"
            build_pdf(processed, out_path)
            size_kb = out_path.stat().st_size // 1024
            print(
                f"✓ {sc['folder']:<26} filter={filter_mode:<7} pages={len(files)} "
                f"formats={formats:<10} → {out_path.name} ({size_kb} KB)"
            )

    print("\nDone. Open PDFs in output_docscanner/ to inspect quality.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
