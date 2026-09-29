"""
内置模型分支：在启动图标右上角加一个黄色圆形小角标，里面是 ✦（和 App 里助手按钮同一个符号），
用来和正式版区分。在原图标上叠加，所有尺寸一起生成。用法：python3 tools/make-ai-icon.py
"""
from PIL import Image, ImageDraw

RES = 'android/app/src/main/res'
NAVY, GOLD = (40, 92, 140, 255), (255, 209, 102, 255)
# 每种图标里角标的位置（占边长的比例）：圆心 x、y，半径
SPOTS = {
    'ic_launcher_foreground.png': (0.650, 0.320, 0.070),   # 自适应图标前景：保持在 66/108 安全圆内
    'ic_launcher.png': (0.740, 0.270, 0.120),
    'ic_launcher_round.png': (0.705, 0.295, 0.115),
}

def sparkle(d, cx, cy, r, fill):
    """四角星：尖端在上下左右，内收点在 45°"""
    k = 0.22
    pts = []
    for i in range(8):
        import math
        a = math.pi / 4 * i - math.pi / 2
        rr = r if i % 2 == 0 else r * k
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)

def badge(im, fx, fy, fr):
    w, h = im.size
    s = 4  # 放大 4 倍画再缩小，边缘更平滑
    layer = Image.new('RGBA', (w * s, h * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy, r = fx * w * s, fy * h * s, fr * w * s
    ring = r * 1.18  # 深蓝描边，和下面的图案隔开
    d.ellipse((cx - ring, cy - ring, cx + ring, cy + ring), fill=NAVY)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GOLD)
    sparkle(d, cx - r * 0.08, cy + r * 0.06, r * 0.62, NAVY)
    sparkle(d, cx + r * 0.46, cy - r * 0.42, r * 0.24, NAVY)
    layer = layer.resize((w, h), Image.LANCZOS)
    out = im.convert('RGBA')
    out.alpha_composite(layer)
    return out

for dpi in ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']:
    for name, (fx, fy, fr) in SPOTS.items():
        p = f'{RES}/mipmap-{dpi}/{name}'
        badge(Image.open(p), fx, fy, fr).save(p)
im = Image.open('www/img/icon-512.png')
badge(im, 0.745, 0.255, 0.12).save('www/img/icon-512.png')
print('done')
