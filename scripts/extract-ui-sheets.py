"""Crop reusable, text-free UI art from the six user-approved sheets.

Requires Pillow. Source sheets remain untouched; coordinates use their
1536 x 1024 original pixels. Dynamic labels and values stay in HTML.
"""

from pathlib import Path
import sys

from collections import deque

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1] / "public" / "ui"
SHEETS = {
    "a": "sheet-a-pulselock.png",
    "b": "sheet-b-panels.png",
    "c": "sheet-c-hud.png",
    "d": "sheet-d-menu-result.png",
    "e": "sheet-e-textures.png",
    "f": "sheet-f-modern-textures.png",
}

# Each selected rectangle is intentionally free of baked game labels/numbers.
CROPS = {
    "panels/main-shell.png": ("b", (29, 99, 506, 319)),
    "panels/compact-shell.png": ("b", (521, 211, 845, 320)),
    "components/button-shell.png": ("a", (520, 206, 756, 300)),
    "components/header-strip.png": ("a", (778, 98, 1196, 156)),
    "components/dark-label.png": ("a", (1222, 97, 1384, 137)),
    "components/blue-strip.png": ("a", (1217, 350, 1384, 396)),
    "hud/faction-warm.png": ("c", (846, 266, 973, 405)),
    "hud/rice-shell.png": ("c", (986, 184, 1313, 246)),
    "hud/timer-shell.png": ("c", (986, 267, 1312, 337)),
    "hud/skill-blue.png": ("c", (945, 466, 1159, 537)),
    "hud/skill-warm.png": ("c", (1183, 466, 1385, 537)),
    "hud/interaction-shell.png": ("c", (932, 736, 1157, 798)),
    "pulselock/track-shell.png": ("d", (664, 211, 1132, 253)),
    "screens/result-accent.png": ("e", (935, 696, 1158, 754)),
    "textures/paper.png": ("f", (19, 69, 188, 194)),
    "hud/rice-bowl.png": ("c", (620, 145, 704, 222)),
}

# The source sheets are opaque presentation boards. Trace the authored cut
# corners so the surrounding board does not become part of each UI component.
# Coordinates are fractions of the individual crop; the white panel *inside*
# each contour remains because it is part of the selected artwork.
CUTS = {
    "panels/main-shell.png": (0.06, 0.02, 0.00, 0.08),
    "panels/compact-shell.png": (0.06, 0.02, 0.00, 0.10),
    "components/button-shell.png": (0.10, 0.00, 0.00, 0.12),
    "components/header-strip.png": (0.08, 0.01, 0.00, 0.07),
    "components/dark-label.png": (0.10, 0.00, 0.00, 0.11),
    "components/blue-strip.png": (0.12, 0.01, 0.00, 0.12),
    "hud/faction-warm.png": (0.14, 0.01, 0.00, 0.12),
    "hud/rice-shell.png": (0.05, 0.00, 0.00, 0.08),
    "hud/timer-shell.png": (0.06, 0.00, 0.00, 0.09),
    "hud/skill-blue.png": (0.08, 0.00, 0.00, 0.10),
    "hud/skill-warm.png": (0.08, 0.00, 0.00, 0.10),
    "hud/interaction-shell.png": (0.07, 0.00, 0.00, 0.09),
    "pulselock/track-shell.png": (0.05, 0.00, 0.00, 0.06),
    "screens/result-accent.png": (0.08, 0.00, 0.00, 0.12),
}

PAPER_OPACITY = {
    "hud/rice-shell.png": 0.55,
    "hud/timer-shell.png": 0.55,
    "hud/skill-blue.png": 0.36,
    "hud/skill-warm.png": 0.36,
    "hud/interaction-shell.png": 0.18,
}


def cut_corner_alpha(image: Image.Image, cuts: tuple[float, ...]) -> Image.Image:
    width, height = image.size
    tl, tr, bl, br = cuts
    scale = 4
    mask = Image.new("L", (width * scale, height * scale))
    points = [
        (tl * width, 0), (width - tr * width, 0),
        (width, tr * height), (width, height - br * height),
        (width - br * width, height), (bl * width, height),
        (0, height - bl * height), (0, tl * height),
    ]
    ImageDraw.Draw(mask).polygon([(round(x * scale), round(y * scale)) for x, y in points], fill=255)
    image = image.convert("RGBA")
    image.putalpha(mask.resize((width, height), Image.Resampling.LANCZOS)
                   .point(lambda alpha: 0 if alpha < 3 else alpha))
    return image


def isolate_bowl(image: Image.Image) -> Image.Image:
    """Keep the sheet's actual bowl drawing, not its opaque paper backdrop."""
    image = image.convert("RGBA")
    width, height = image.size
    solid = []
    for y in range(height):
        row = []
        for x in range(width):
            r, g, b, _ = image.getpixel((x, y))
            row.append(min(r, g, b) < 165 or b > r + 20)
        solid.append(row)
    # Close the antialiased dark bowl outline, then flood the outside only.
    outline = Image.new("L", (width, height))
    outline.putdata([255 if pixel else 0 for row in solid for pixel in row])
    outline = outline.filter(ImageFilter.MaxFilter(5))
    occupied = outline.tobytes()
    exterior = bytearray(width * height)
    queue = deque()
    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if exterior[index] or occupied[index]:
            continue
        exterior[index] = 1
        if x > 0: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y > 0: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))
    alpha = Image.new("L", (width, height))
    alpha.putdata([0 if exterior[i] else 255 for i in range(width * height)])
    image.putalpha(alpha.filter(ImageFilter.GaussianBlur(0.6)))
    return image


def lighten_paper(image: Image.Image, opacity: float) -> Image.Image:
    """Let the game world show through pale paper, retaining the sheet ink."""
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, alpha = pixels[x, y]
            if min(r, g, b) > 214 and max(r, g, b) - min(r, g, b) < 42:
                pixels[x, y] = (r, g, b, round(alpha * opacity))
    return image


def separate_panel_dots(image: Image.Image, output: str,
                        regions: dict[str, tuple[int, int, int, int]]) -> None:
    """Keep the authored dots round when a panel's middle is nine-sliced."""
    softened = image.filter(ImageFilter.MedianFilter(9)).filter(ImageFilter.MedianFilter(9))
    base = image.copy()
    for name, box in regions.items():
        detail = Image.new("RGBA", image.size)
        for y in range(box[1], box[3]):
            for x in range(box[0], box[2]):
                original = image.getpixel((x, y))
                paper = softened.getpixel((x, y))
                difference = max(abs(original[i] - paper[i]) for i in range(3))
                if difference <= 18 or min(original[:3]) > 220:
                    continue
                opacity = min(original[3], max(0, (difference - 12) * 9))
                detail.putpixel((x, y), (*original[:3], opacity))
                base.putpixel((x, y), (*paper[:3], original[3]))
        detail.crop(box).save(ROOT / "panels" / f"{output}-dots-{name}.png", optimize=True)
    base.save(ROOT / "panels" / f"{output}-shell-stretch.png", optimize=True)


def separate_panel_details() -> None:
    separate_panel_dots(Image.open(ROOT / "panels" / "main-shell.png").convert("RGBA"),
                        "main", {"left": (7, 81, 80, 216), "right": (408, 72, 470, 171)})
    separate_panel_dots(Image.open(ROOT / "panels" / "compact-shell.png").convert("RGBA"),
                        "compact", {"upper": (37, 18, 103, 78)})


def separate_button_end(image: Image.Image) -> None:
    """Stretch only the paper middle; render the authored diagonal as a fixed end."""
    image.crop((136, 0, image.width, image.height)).save(
        ROOT / "components" / "button-endcap.png", optimize=True)
    base = image.copy()
    for y in range(8, image.height):
        for x in range(136, image.width):
            base.putpixel((x, y), image.getpixel((100 + (x - 136) % 35, y)))
    base.save(ROOT / "components" / "button-shell-stretch.png", optimize=True)


def main() -> None:
    if sys.argv[1:] == ["--stretch-details-only"]:
        separate_panel_details()
        separate_button_end(Image.open(ROOT / "components" / "button-shell.png").convert("RGBA"))
        return
    images = {key: Image.open(ROOT / name) for key, name in SHEETS.items()}
    for relative, (sheet, box) in CROPS.items():
        image = images[sheet]
        if image.size != (1536, 1024):
            raise ValueError(f"Unexpected size for {SHEETS[sheet]}: {image.size}")
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        crop = image.crop(box)
        if relative == "hud/rice-bowl.png":
            crop = isolate_bowl(crop)
        elif relative in CUTS:
            crop = cut_corner_alpha(crop, CUTS[relative])
        if relative in PAPER_OPACITY:
            crop = lighten_paper(crop, PAPER_OPACITY[relative])
        crop.save(target, optimize=True)
        if relative == "panels/main-shell.png":
            separate_panel_dots(crop, "main",
                                {"left": (7, 81, 80, 216), "right": (408, 72, 470, 171)})
        if relative == "panels/compact-shell.png":
            separate_panel_dots(crop, "compact", {"upper": (37, 18, 103, 78)})
        if relative == "components/button-shell.png":
            separate_button_end(crop)
        print(f"{relative} <- {SHEETS[sheet]} {box}")


if __name__ == "__main__":
    main()
