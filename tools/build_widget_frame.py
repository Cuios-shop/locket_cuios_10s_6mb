"""Build an original geometric frame. Optional authoring tool; requires Pillow."""
from pathlib import Path

from PIL import Image, ImageDraw

SCALE = 3
SIZE = 1024
canvas = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)


def rounded(box, radius, width, color):
    draw.rounded_rectangle(
        tuple(int(value * SCALE) for value in box),
        radius=int(radius * SCALE),
        outline=color,
        width=int(width * SCALE),
    )


rounded((14, 14, 1010, 1010), 188, 22, "#D6A637")
rounded((40, 40, 984, 984), 166, 4, "#FFE3A0")
rounded((51, 51, 973, 973), 155, 3, "#B98627")
for x, y in [(512, 26), (512, 998), (26, 512), (998, 512)]:
    draw.polygon(
        [(x * SCALE, (y - 11) * SCALE), ((x + 7) * SCALE, y * SCALE),
         (x * SCALE, (y + 11) * SCALE), ((x - 7) * SCALE, y * SCALE)],
        fill="#FFE3A0",
    )

canvas = canvas.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
assert canvas.getpixel((512, 512))[3] == 0, "Frame must have a transparent center"
assert canvas.getpixel((512, 25))[3] > 0, "Frame border must be visible"
target = Path(__file__).resolve().parents[1] / "assets" / "widget-gold.png"
target.parent.mkdir(exist_ok=True)
canvas.save(target, optimize=True)
print(f"Built {target.name}: {canvas.size}, RGBA, transparent center")
