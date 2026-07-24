#!/usr/bin/env python3
"""Install Cadence brand icons into public/ + Android mipmaps (Option A)."""
from pathlib import Path
from PIL import Image
import io
import shutil
import struct

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "brand" / "cadence"
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"
ANDROID = ROOT / "android" / "app" / "src" / "main" / "res"
STORE = ROOT / "store-assets"
ASSETS = ROOT / "assets" / "brand"
BG = (14, 19, 25, 255)


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print("wrote", path.relative_to(ROOT))


def make_full(size=1024, pad_ratio=0.16) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    mark = Image.open(SRC / "cadence_mark_512.png").convert("RGBA")
    target = int(size * (1 - 2 * pad_ratio))
    mark = mark.resize((target, target), Image.Resampling.LANCZOS)
    x = (size - target) // 2
    canvas.alpha_composite(mark, (x, x))
    return canvas


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing Cadence source folder: {SRC}")

    for name in (
        "favicon.svg",
        "favicon-16.png",
        "favicon-32.png",
        "favicon-48.png",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
    ):
        shutil.copy2(SRC / name, PUBLIC / name)

    shutil.copy2(SRC / "cadence_icon_1024.png", PUBLIC / "icon-1024.png")
    shutil.copy2(SRC / "cadence_icon_512.png", STORE / "icon-512.png")
    shutil.copy2(SRC / "cadence_icon_1024.png", ASSETS / "icon-1024.png")
    shutil.copy2(SRC / "cadence_mark.svg", PUBLIC / "cadence-mark.svg")
    shutil.copy2(SRC / "cadence_logo_horizontal_dark.svg", PUBLIC / "cadence-logo-dark.svg")
    shutil.copy2(SRC / "cadence_icon.svg", PUBLIC / "cadence-icon.svg")

    sizes = [16, 32, 48]
    blobs = []
    for s in sizes:
        buf = io.BytesIO()
        Image.open(SRC / f"favicon-{s}.png").convert("RGBA").save(buf, format="PNG")
        blobs.append(buf.getvalue())
    header = struct.pack("<HHH", 0, 1, len(sizes))
    entries = []
    offset = 6 + 16 * len(sizes)
    data = b""
    for s, blob in zip(sizes, blobs):
        entries.append(struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(blob), offset))
        data += blob
        offset += len(blob)
    (PUBLIC / "favicon.ico").write_bytes(header + b"".join(entries) + data)

    master = make_full(1024, 0.16)
    ICONS.mkdir(exist_ok=True)
    for size in (48, 72, 96, 128, 192, 256, 512):
        im = master.resize((size, size), Image.Resampling.LANCZOS)
        save(im, ICONS / f"icon-{size}.png")
        im.save(ICONS / f"icon-{size}.webp", "WEBP", quality=90)
    save(master.resize((512, 512), Image.Resampling.LANCZOS), ICONS / "icon-512-maskable.png")

    densities = {
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }
    for dens, (launcher, fg) in densities.items():
        mip = ANDROID / f"mipmap-{dens}"
        L = master.resize((launcher, launcher), Image.Resampling.LANCZOS)
        save(L, mip / "ic_launcher.png")
        save(L, mip / "ic_launcher_round.png")
        fg_img = Image.new("RGBA", (fg, fg), (0, 0, 0, 0))
        mark = Image.open(SRC / "cadence_mark_512.png").convert("RGBA")
        t = int(fg * 0.56)
        mark = mark.resize((t, t), Image.Resampling.LANCZOS)
        fg_img.alpha_composite(mark, ((fg - t) // 2, (fg - t) // 2))
        save(fg_img, mip / "ic_launcher_foreground.png")

    ldpi = ANDROID / "mipmap-ldpi"
    L36 = master.resize((36, 36), Image.Resampling.LANCZOS)
    save(L36, ldpi / "ic_launcher.png")
    save(L36, ldpi / "ic_launcher_round.png")
    print("done")


if __name__ == "__main__":
    main()
