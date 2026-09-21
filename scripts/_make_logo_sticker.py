"""Rebuild logo sticker with a smooth, even white die-cut margin."""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src/renderer/src/assets/logo-sorteos-cafeteros.jpg"
DST = ROOT / "src/renderer/src/assets/logo-sorteos-cafeteros.png"

SCALE = 4
CLOSE_R = 10
OPEN_R = 6
SMOOTH = 7.0
STROKE = 22
AA = 1.6


def is_near_white(rgb: np.ndarray, lum_min: int = 242, chroma_max: int = 14) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = (r.astype(np.int16) + g + b) / 3
    chroma = np.maximum(np.maximum(r, g), b).astype(np.int16) - np.minimum(
        np.minimum(r, g), b
    )
    return (lum >= lum_min) & (chroma <= chroma_max)


def flood(mask: np.ndarray, seeds: list[tuple[int, int]]) -> np.ndarray:
    h, w = mask.shape
    out = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for y, x in seeds:
        if 0 <= y < h and 0 <= x < w and mask[y, x] and not out[y, x]:
            out[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out


def disk(r: int) -> np.ndarray:
    y, x = np.ogrid[-r : r + 1, -r : r + 1]
    return (x * x + y * y) <= r * r


def fft_conv(mask: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    kh, kw = kernel.shape
    ph, pw = h + kh - 1, w + kw - 1
    fm = np.fft.rfft2(mask.astype(np.float32), s=(ph, pw))
    fk = np.fft.rfft2(kernel.astype(np.float32), s=(ph, pw))
    c = np.fft.irfft2(fm * fk, s=(ph, pw))
    oy, ox = kh // 2, kw // 2
    return c[oy : oy + h, ox : ox + w]


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    return fft_conv(mask, disk(r)) > 0.5


def erode(mask: np.ndarray, r: int) -> np.ndarray:
    k = disk(r)
    return fft_conv(mask, k) > (k.sum() - 0.5)


def morph_close(mask: np.ndarray, r: int) -> np.ndarray:
    return erode(dilate(mask, r), r)


def morph_open(mask: np.ndarray, r: int) -> np.ndarray:
    return dilate(erode(mask, r), r)


def blur_mask(mask: np.ndarray, radius: float) -> np.ndarray:
    im = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
    im = im.filter(ImageFilter.GaussianBlur(radius=radius))
    return np.asarray(im, dtype=np.float32) / 255.0


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    src = src.resize((src.width * SCALE, src.height * SCALE), Image.Resampling.LANCZOS)
    rgb = np.asarray(src)
    h, w = rgb.shape[:2]

    # 1) Remove the outer white square.
    bg = is_near_white(rgb, lum_min=238, chroma_max=18)
    edge_seeds = (
        [(0, x) for x in range(w)]
        + [(h - 1, x) for x in range(w)]
        + [(y, 0) for y in range(h)]
        + [(y, w - 1) for y in range(h)]
    )
    outer_square = flood(bg, edge_seeds)

    # 2) Peel the old crooked sticker margin (white connected to the outside).
    peelable = is_near_white(rgb, lum_min=228, chroma_max=28) & ~outer_square
    trans_border = dilate(outer_square, 2) & ~outer_square
    peel_seeds = list(zip(*np.nonzero(peelable & trans_border)))
    old_margin = flood(peelable, peel_seeds)

    keep = ~(outer_square | old_margin)
    art = np.zeros((h, w, 4), dtype=np.uint8)
    art[..., :3] = rgb
    art[..., 3] = np.where(keep, 255, 0).astype(np.uint8)

    # 3) Smooth silhouette, then offset with a circular stroke.
    core = keep
    core = morph_close(core, CLOSE_R)
    core = morph_open(core, OPEN_R)
    smooth = blur_mask(core, SMOOTH) >= 0.5
    smooth = smooth | keep
    smooth = blur_mask(smooth, SMOOTH * 0.55) >= 0.48

    sticker = dilate(smooth, STROKE)
    alpha = blur_mask(sticker, AA)
    alpha_u8 = np.clip(np.round(alpha * 255), 0, 255).astype(np.uint8)

    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., :3] = 255
    out[..., 3] = alpha_u8

    art_a = art[..., 3:4].astype(np.float32) / 255.0
    out_f = out.astype(np.float32)
    art_f = art.astype(np.float32)
    out_f[..., :3] = art_f[..., :3] * art_a + out_f[..., :3] * (1.0 - art_a)
    out_f[..., 3] = np.maximum(out_f[..., 3], art_f[..., 3])
    out = np.clip(np.round(out_f), 0, 255).astype(np.uint8)

    ys, xs = np.nonzero(out[..., 3] > 8)
    pad = 8
    y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad + 1)
    cropped = Image.fromarray(out[y0:y1, x0:x1], mode="RGBA")
    cropped = cropped.resize(
        (max(1, cropped.width // SCALE), max(1, cropped.height // SCALE)),
        Image.Resampling.LANCZOS,
    )
    cropped.save(DST, "PNG")
    print(f"saved {DST.relative_to(ROOT)} {cropped.size}")


if __name__ == "__main__":
    main()
