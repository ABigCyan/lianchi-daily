"""
第 4.5 步（人工复核）：把审计通过、还没人工看过的演示片段各截 4 帧，拼成带编号的总览图，人眼看一遍是不是标的那个动作。
看完用 mark_review.py 记进 tools/demo-review.json（不对的进 bad，这批其余的进 seen）；merge.py 只放 seen 里、又不在 bad 里的片段。
输出 <目录>/review/sheet_XX.jpg 和 <目录>/review/index.json（编号 → 动作|视频|开始秒）。
用法：python3 review_sheets.py <目录> <yt-dlp 路径> [--all]   （默认只出没看过的；--all 全部重出；需要 Pillow）
"""
import json, os, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont
D, YTDLP = sys.argv[1], sys.argv[2]
R = os.path.join(D, 'review'); os.makedirs(os.path.join(R, 'frames'), exist_ok=True)
TOOLS = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, os.path.dirname(__file__))
from merge import merged_demos, review
names = json.loads(subprocess.run(['node', '-e', """
const w={};w.window=w;const fs=require('fs'),vm=require('vm');const c=vm.createContext(w);
for (const f of ['data-training.js','data-training-ext.js']) vm.runInContext(fs.readFileSync('www/js/'+f,'utf8'),c);
console.log(JSON.stringify(Object.fromEntries(Object.values(w.EX).map(e=>[e.id,e.n+'（'+e.eq+'）']))));
"""], cwd=os.path.join(TOOLS, '..'), capture_output=True, text=True, check=True).stdout)
BAD, SEEN = review()
rows = [(d['ex'], d) for d in sorted(merged_demos(D), key=lambda d: (d['ex'], -d['q'])) if d['key'] not in BAD and ('--all' in sys.argv or d['key'] not in SEEN)]
if not rows: sys.exit('没有要复核的新片段')
for f in os.listdir(R):
    if f.startswith('sheet_'): os.remove(os.path.join(R, f))
def frames(ex, d):
    key = f"{ex}|{d['bv']}|{d['start']}"; base = os.path.join(R, 'frames', key.replace('|', '_'))
    outs = [f'{base}_{k}.jpg' for k in range(4)]
    if all(os.path.exists(o) for o in outs): return key, outs
    tmp = base + '.mp4'
    try:
        subprocess.run([YTDLP, '-q', '--no-warnings', '--retries', '10', '-f', 'bv*[height<=360][vcodec^=avc1]/bv*[height<=480]/wv',
                        '--download-sections', f"*{d['start']}-{d['end']}", '-o', tmp, 'https://www.bilibili.com/video/' + d['bv']], check=True, timeout=600)
        dur = max(1, d['end'] - d['start'])
        for k, o in enumerate(outs):
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{dur * (k + 0.5) / 4:.2f}', '-i', tmp, '-frames:v', '1', '-vf', 'scale=256:144:force_original_aspect_ratio=decrease,pad=256:144:(ow-iw)/2:(oh-ih)/2', o], check=True)
    except Exception as e:
        print('失败', key, e, flush=True)
    if os.path.exists(tmp): os.remove(tmp)
    return key, outs

with ThreadPoolExecutor(4) as ex: res = list(ex.map(lambda r: frames(*r), rows))
font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 18)
index, PER = {}, 8
for s in range(0, len(res), PER):
    chunk = res[s:s + PER]
    img = Image.new('RGB', (4 * 260 + 8, len(chunk) * (144 + 30) + 4), 'white'); dr = ImageDraw.Draw(img)
    for i, (key, outs) in enumerate(chunk):
        n = s + i + 1; index[n] = key; ex_id, bv, st = key.split('|')
        y = i * 174 + 4
        d = next(d for e, d in rows if d['key'] == key)
        dr.text((6, y), f"#{n}  {names.get(ex_id, ex_id)}  · {d['up']} · {d['start']}-{d['end']}秒 · {'/'.join(v['v'] for v in d['views'])}", fill='black', font=font)
        for k, o in enumerate(outs):
            if os.path.exists(o): img.paste(Image.open(o), (4 + k * 260, y + 26))
    img.save(os.path.join(R, f'sheet_{s // PER + 1:02d}.jpg'), quality=80)
json.dump(index, open(os.path.join(R, 'index.json'), 'w'), ensure_ascii=False, indent=1)
print('共', len(res), '段，', (len(res) + PER - 1) // PER, '张总览图：', R)
