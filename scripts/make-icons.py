"""生成 App 图标：钢蓝底色 + 白色哑铃 + 打勾。用法：python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw
import os
BG = (40, 92, 140)
RES = 'android/app/src/main/res'
def draw_mark(size, scale=1.0, bg=None):
    im = Image.new('RGBA', (size, size), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s = size * scale; o = (size - s) / 2
    W = lambda x: o + x * s
    white = (255, 255, 255, 255)
    # 哑铃
    d.rounded_rectangle([W(.14), W(.30), W(.24), W(.62)], radius=s * .03, fill=white)
    d.rounded_rectangle([W(.24), W(.36), W(.31), W(.56)], radius=s * .02, fill=white)
    d.rounded_rectangle([W(.76), W(.30), W(.86), W(.62)], radius=s * .03, fill=white)
    d.rounded_rectangle([W(.69), W(.36), W(.76), W(.56)], radius=s * .02, fill=white)
    d.rectangle([W(.31), W(.43), W(.69), W(.49)], fill=white)
    # 打勾
    d.line([(W(.36), W(.72)), (W(.46), W(.81)), (W(.66), W(.64))], fill=(255, 214, 102, 255), width=max(2, int(s * .065)), joint='curve')
    return im
dens = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for k, px in dens.items():
    folder = f'{RES}/mipmap-{k}'
    fg = draw_mark(int(px * 2.25), 0.62)  # 前景 108dp，安全区约 66dp
    fg.save(f'{folder}/ic_launcher_foreground.png')
    sq = Image.new('RGBA', (px, px), (0, 0, 0, 0)); ImageDraw.Draw(sq).rounded_rectangle([0, 0, px - 1, px - 1], radius=px * .18, fill=BG)
    sq.alpha_composite(draw_mark(px, 0.9)); sq.save(f'{folder}/ic_launcher.png')
    rd = Image.new('RGBA', (px, px), (0, 0, 0, 0)); ImageDraw.Draw(rd).ellipse([0, 0, px - 1, px - 1], fill=BG)
    rd.alpha_composite(draw_mark(px, 0.8)); rd.save(f'{folder}/ic_launcher_round.png')
open(f'{RES}/values/ic_launcher_background.xml', 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#285C8C</color>\n</resources>\n')
big = Image.new('RGBA', (512, 512), BG); big.alpha_composite(draw_mark(512, 0.9)); big.save('www/img/icon-512.png')
print('icons ok')
