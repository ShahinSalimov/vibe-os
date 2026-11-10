# Generates the VIBE OS icon set: golden equalizer bars forming a "V" on a dark stage background.
from PIL import Image, ImageDraw, ImageFilter
import math, sys
OUT = sys.argv[1]
S = 1024
BG = (11, 10, 16)
GOLD_TOP, GOLD_BOT = (255, 214, 128), (226, 146, 40)

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def bars_mask(size, scale):
    """Alpha mask of the mark, centred, occupying `scale` of the canvas width."""
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    n = 7
    w = size * scale
    gap = w * 0.035
    bw = (w - gap * (n - 1)) / n
    x0 = (size - w) / 2
    base = size / 2 + w * 0.42          # bottom of all bars
    hmax, hmin = w * 0.84, w * 0.22      # outer bars tall, centre short -> a "V" outline on top
    for i in range(n):
        t = abs(i - (n - 1) / 2) / ((n - 1) / 2)   # 0 centre .. 1 edge
        h = hmin + (hmax - hmin) * (t ** 1.15)
        x = x0 + i * (bw + gap)
        d.rounded_rectangle([x, base - h, x + bw, base], radius=bw / 2, fill=255)
    return m

def gold_fill(size):
    g = Image.new('RGB', (size, size))
    px = g.load()
    for y in range(size):
        c = lerp(GOLD_TOP, GOLD_BOT, y / size)
        for x in range(size): px[x, y] = c
    return g

def background(size):
    bg = Image.new('RGB', (size, size), BG)
    glow = Image.new('L', (size, size), 0)
    ImageDraw.Draw(glow).ellipse([size * .18, size * .12, size * .82, size * .76], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(size * .12))
    warm = Image.new('RGB', (size, size), (120, 70, 20))
    return Image.composite(warm, bg, glow)

def icon(size, scale, with_bg=True, mono=False):
    mask = bars_mask(size, scale)
    if mono:
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste((255, 255, 255, 255), (0, 0), mask)
        return out
    fill = gold_fill(size)
    if with_bg:
        base = background(size)
        shadow = mask.filter(ImageFilter.GaussianBlur(size * .02))
        base = Image.composite(Image.new('RGB', (size, size), (0, 0, 0)), base, shadow.point(lambda v: v * .6))
        base.paste(fill, (0, 0), mask)
        return base
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(fill, (0, 0), mask)
    return out

icon(S, 0.60).save(f'{OUT}/icon.png')                                    # iOS / store: square, no alpha
icon(S, 0.42, with_bg=False).save(f'{OUT}/android-icon-foreground.png')  # inside the adaptive safe zone
background(S).save(f'{OUT}/android-icon-background.png')
icon(S, 0.42, mono=True).save(f'{OUT}/android-icon-monochrome.png')      # Android 13 themed icons
icon(512, 0.62, with_bg=False).save(f'{OUT}/splash-icon.png')
icon(64, 0.70).resize((48, 48), Image.LANCZOS).save(f'{OUT}/favicon.png')
print('ok')
