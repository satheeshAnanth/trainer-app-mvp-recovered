#!/usr/bin/env python3
"""Regenerate TrainerApp favicon + Android launcher icons from brand mark."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"
STORE = ROOT / "store-assets"
ASSETS = ROOT / "assets" / "brand"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"

BG = (2, 6, 23, 255)
MINT = (45, 212, 191, 255)
MINT_DIM = (45, 212, 191, 55)
MINT_DIM2 = (45, 212, 191, 80)


def draw_mark(size: int, *, rounded: bool = False, pad_ratio: float = 0.0) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)
    if rounded:
        radius = int(size * 0.22)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
        base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        base.paste(img, (0, 0))
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        img.paste(base, mask=mask)
        draw = ImageDraw.Draw(img)

    cx = size / 2
    ring_cy = size * 0.53
    for r_ratio, width_ratio, color in (
        (0.34, 0.028, MINT_DIM),
        (0.225, 0.024, MINT_DIM2),
    ):
        r = size * r_ratio
        w = max(1, size * width_ratio)
        draw.ellipse([cx - r, ring_cy - r, cx + r, ring_cy + r], outline=color, width=int(w))

    inset = size * (0.22 + pad_ratio)
    top = size * (0.22 + pad_ratio * 0.5)
    bar_h = size * 0.11
    stem_w = size * 0.14
    bar_w = size - 2 * inset
    stem_top = top + bar_h
    stem_bottom = size * (0.78 - pad_ratio * 0.3)
    draw.rounded_rectangle(
        [inset, top, inset + bar_w, top + bar_h],
        radius=max(1, int(size * 0.02)),
        fill=MINT,
    )
    sx0 = (size - stem_w) / 2
    draw.rounded_rectangle(
        [sx0, stem_top - size * 0.01, sx0 + stem_w, stem_bottom],
        radius=max(1, int(size * 0.02)),
        fill=MINT,
    )
    return img


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print("wrote", path.relative_to(ROOT), img.size)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)
    STORE.mkdir(parents=True, exist_ok=True)

    master = draw_mark(1024)
    master_rounded = draw_mark(1024, rounded=True)
    adaptive_fg = draw_mark(1024, pad_ratio=0.08)

    save_png(master, ASSETS / "icon-1024.png")
    save_png(master_rounded, ASSETS / "icon-1024-rounded.png")
    save_png(adaptive_fg, ASSETS / "icon-adaptive-foreground-1024.png")
    save_png(master, PUBLIC / "icon-1024.png")
    save_png(master.resize((512, 512), Image.Resampling.LANCZOS), STORE / "icon-512.png")
    save_png(master_rounded.resize((512, 512), Image.Resampling.LANCZOS), STORE / "icon-512-rounded.png")

    for size in (16, 32, 48):
        save_png(master.resize((size, size), Image.Resampling.LANCZOS), PUBLIC / f"favicon-{size}.png")

    save_png(master.resize((180, 180), Image.Resampling.LANCZOS), PUBLIC / "apple-touch-icon.png")
    save_png(master.resize((192, 192), Image.Resampling.LANCZOS), PUBLIC / "icon-192.png")
    save_png(master.resize((512, 512), Image.Resampling.LANCZOS), PUBLIC / "icon-512.png")

    for size in (48, 72, 96, 128, 192, 256, 512):
        im = master.resize((size, size), Image.Resampling.LANCZOS)
        save_png(im, ICONS / f"icon-{size}.png")
        im.save(ICONS / f"icon-{size}.webp", "WEBP", quality=90)

    save_png(master.resize((512, 512), Image.Resampling.LANCZOS), ICONS / "icon-512-maskable.png")

    ico_sizes = [16, 32, 48]
    png_blobs = []
    for s in ico_sizes:
        buf = __import__("io").BytesIO()
        master.resize((s, s), Image.Resampling.LANCZOS).save(buf, format="PNG")
        png_blobs.append(buf.getvalue())
    import struct

    header = struct.pack("<HHH", 0, 1, len(ico_sizes))
    entries = []
    offset = 6 + 16 * len(ico_sizes)
    data = b""
    for s, blob in zip(ico_sizes, png_blobs):
        entries.append(struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(blob), offset))
        data += blob
        offset += len(blob)
    (PUBLIC / "favicon.ico").write_bytes(header + b"".join(entries) + data)
    print("wrote public/favicon.ico")

    densities = {
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }
    for dens, (launcher, fg) in densities.items():
        mip = ANDROID_RES / f"mipmap-{dens}"
        L = master.resize((launcher, launcher), Image.Resampling.LANCZOS)
        save_png(L, mip / "ic_launcher.png")
        save_png(L, mip / "ic_launcher_round.png")
        save_png(adaptive_fg.resize((fg, fg), Image.Resampling.LANCZOS), mip / "ic_launcher_foreground.png")

    ldpi = ANDROID_RES / "mipmap-ldpi"
    L36 = master.resize((36, 36), Image.Resampling.LANCZOS)
    save_png(L36, ldpi / "ic_launcher.png")
    save_png(L36, ldpi / "ic_launcher_round.png")
    print("done")


if __name__ == "__main__":
    main()
