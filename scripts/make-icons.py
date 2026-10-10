"""生成 App 图标（练好吃对）：墨色底 + 琥珀色的碗里放一只白色哑铃（练 + 吃），右上一颗小 ✦（内置 AI）。
和 App 里的“Quiet Glass”风格一致：深墨色、白色主体、一个暖色点缀。先按 1024 画，再缩小到各个尺寸，边缘平滑。
用法：python3 scripts/make-icons.py
"""
from PIL import Image, ImageDraw, ImageFilter
import math

RES = 'android/app/src/main/res'
INK_TOP, INK_BOT = (46, 52, 62), (14, 16, 20)
AMBER_TOP, AMBER_BOT = (255, 206, 112), (232, 150, 52)
WHITE = (255, 255, 255, 255)
S = 1024


def gradient(size, top, bot):
    g = Image.new('RGBA', (1, size))
    for y in range(size):
        t = y / (size - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,))
    return g.resize((size, size))


def sparkle(d, cx, cy, r, fill, k=0.24):
    pts = []
    for i in range(8):
        a = math.pi / 4 * i - math.pi / 2
        rr = r if i % 2 == 0 else r * k
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)


def glyph(scale):
    """透明底上的图案（1024 画布，scale 是图案占画布的比例）"""
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    o = S * (1 - scale) / 2
    X = lambda v: o + v * S * scale   # 图案坐标 0-1 → 画布像素
    R = lambda v: v * S * scale
    # 碗：下半圆，琥珀色渐变；碗口一条亮边
    bowl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    m = Image.new('L', (S, S), 0)
    md = ImageDraw.Draw(m)
    cx, cy, r = X(.5), X(.52), R(.40)
    md.pieslice([cx - r, cy - r, cx + r, cy + r], 0, 180, fill=255)
    md.rectangle([cx - r, cy - R(.012), cx + r, cy + R(.02)], fill=255)
    bowl.paste(gradient(S, AMBER_TOP, AMBER_BOT), (0, 0), m)
    im.alpha_composite(bowl)
    d = ImageDraw.Draw(im)
    # 碗底的圈足
    d.rounded_rectangle([cx - R(.13), cy + r - R(.01), cx + R(.13), cy + r + R(.055)], radius=R(.025), fill=(232, 150, 52, 255))
    # 哑铃：横在碗口上方，白色
    y = X(.40)
    bar_h = R(.045)
    d.rounded_rectangle([X(.20), y - bar_h / 2, X(.80), y + bar_h / 2], radius=bar_h / 2, fill=WHITE)
    for side in (-1, 1):
        for (w, h, off) in ((.085, .30, .225), (.06, .21, .305)):
            x0 = X(.5) + side * R(off) - R(w) / 2
            d.rounded_rectangle([x0, y - R(h) / 2, x0 + R(w), y + R(h) / 2], radius=R(.03), fill=WHITE)
    # 碗口的弧形高光
    hl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(hl).arc([cx - r * .82, cy - r * .82, cx + r * .82, cy + r * .82], 25, 70, fill=(255, 255, 255, 140), width=int(R(.02)))
    im.alpha_composite(hl)
    # 右上的小 ✦
    sparkle(d, X(.83), X(.13), R(.085), (255, 214, 120, 255))
    return im


def tile(px, shape):
    """完整图标（老版本安卓 / 应用内）：墨色渐变底 + 图案"""
    bg = gradient(S, INK_TOP, INK_BOT)
    # 顶部一层淡淡的光
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([-S * .2, -S * .75, S * 1.2, S * .45], fill=(255, 255, 255, 26))
    bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(S * .14)))
    bg.alpha_composite(glyph(.78 if shape == 'square' else .72))
    mask = Image.new('L', (S, S), 0)
    md = ImageDraw.Draw(mask)
    if shape == 'square':
        md.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * .23, fill=255)
    else:
        md.ellipse([0, 0, S - 1, S - 1], fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)
    return out.resize((px, px), Image.LANCZOS)


dens = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for k, px in dens.items():
    folder = f'{RES}/mipmap-{k}'
    fg_px = int(px * 2.25)  # 自适应图标前景 108dp，图案放在中间约 66dp 的安全区内
    glyph(.58).resize((fg_px, fg_px), Image.LANCZOS).save(f'{folder}/ic_launcher_foreground.png')
    gradient(fg_px, INK_TOP, INK_BOT).save(f'{folder}/ic_launcher_background.png')
    tile(px, 'square').save(f'{folder}/ic_launcher.png')
    tile(px, 'round').save(f'{folder}/ic_launcher_round.png')
# 自适应图标的底改用渐变图（原来是纯色）
xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@mipmap/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>'
for n in ('ic_launcher', 'ic_launcher_round'):
    open(f'{RES}/mipmap-anydpi-v26/{n}.xml', 'w').write(xml)
open(f'{RES}/values/ic_launcher_background.xml', 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1E2228</color>\n</resources>\n')
tile(512, 'square').save('www/img/icon-512.png')

print('icons ok')

# 启动画面：App 的底色 + 中间的图标（原来是 Capacitor 默认的蓝色标志）
import glob
icon = tile(1024, 'square')
for f in glob.glob(f'{RES}/drawable*/splash.png'):
    w, h = Image.open(f).size
    sp = Image.new('RGBA', (w, h), (233, 235, 239, 255))
    n = int(min(w, h) * .24)
    sp.alpha_composite(icon.resize((n, n), Image.LANCZOS), ((w - n) // 2, (h - n) // 2))
    sp.convert('RGB').save(f)
print('splash ok')
