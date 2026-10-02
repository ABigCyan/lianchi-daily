#!/usr/bin/env python3
"""下载补充动作的图片（free-exercise-db，Unlicense 公有领域），压缩成和原有图片一样的 360×240 渐进式 JPEG。

用法：python3 tools/fetch-ext-images.py
只下载 www/img/ex 里还没有的动作；需要 Pillow（pip install pillow）。
"""
import io
import os
import re
import sys
import urllib.request

from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{}/{}.jpg'
OUT = os.path.join(ROOT, 'www', 'img', 'ex')


def ids():
    text = open(os.path.join(ROOT, 'www', 'js', 'data-training-ext.js'), encoding='utf-8').read()
    # 每行形如  key: ['中文显示名', '图库ID', ...
    return sorted(set(re.findall(r"^\s+\w+: \['[^']*[\u4e00-\u9fff][^']*', '([^']+)'", text, re.M)))


def fetch(img_id, frame):
    with urllib.request.urlopen(SRC.format(img_id, frame), timeout=30) as r:
        return r.read()


def save(data, path):
    im = Image.open(io.BytesIO(data)).convert('RGB')
    # 底图：同一张图放大铺满再模糊，竖图两边不会留白
    k = max(360 / im.width, 240 / im.height)
    bg = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    left, top = (bg.width - 360) // 2, (bg.height - 240) // 2
    canvas = bg.crop((left, top, left + 360, top + 240)).filter(ImageFilter.GaussianBlur(18))
    im.thumbnail((360, 240), Image.LANCZOS)
    canvas.paste(im, ((360 - im.width) // 2, (240 - im.height) // 2))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    canvas.save(path, 'JPEG', quality=72, optimize=True, progressive=True)


def main():
    missing = 0
    for img_id in ids():
        for frame in (0, 1):
            path = os.path.join(OUT, img_id, f'{frame}.jpg')
            if os.path.exists(path):
                continue
            try:
                save(fetch(img_id, frame), path)
                print('下载', img_id, frame)
            except Exception as e:  # 网络问题时继续下一张，最后报告
                missing += 1
                print('失败', img_id, frame, e, file=sys.stderr)
    with open(os.path.join(ROOT, 'scripts', 'image-ids.txt'), encoding='utf-8') as f:
        known = [x.strip() for x in f if x.strip()]
    extra = [x for x in ids() if x not in known]
    if extra:
        with open(os.path.join(ROOT, 'scripts', 'image-ids.txt'), 'a', encoding='utf-8') as f:
            f.write('\n'.join(extra) + '\n')
    sys.exit(1 if missing else 0)


if __name__ == '__main__':
    main()
