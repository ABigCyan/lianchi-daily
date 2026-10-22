"""
第 4.5 步（人工复核）：把合并后每个动作的演示片段各截 4 帧，拼成带编号的总览图，人眼看一遍是不是标的那个动作。
看完把结果记进 tools/demo-review.json：不对的放进 "bad"，看过的都放进 "seen"（例如 "ohp_m|BV1EbtreVE3B|371"）。
merge.py 只留 seen 里、又不在 bad 里的片段。
输出 <目录>/review/sheet_XX.jpg 和 <目录>/review/index.json（编号 → 动作|视频|开始秒）。
用法：python3 review_sheets.py <目录> <yt-dlp 路径>   （需要 Pillow）
"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont
D, YTDLP = sys.argv[1], sys.argv[2]
R = os.path.join(D, 'review'); os.makedirs(os.path.join(R, 'frames'), exist_ok=True)
TOOLS = os.path.join(os.path.dirname(__file__), '..')
up = json.load(open(os.path.join(TOOLS, 'tips-up.json')))
names = json.loads(subprocess.run(['node', '-e', """
const w={};w.window=w;const fs=require('fs'),vm=require('vm');const c=vm.createContext(w);
for (const f of ['data-training.js','data-training-ext.js']) vm.runInContext(fs.readFileSync('www/js/'+f,'utf8'),c);
console.log(JSON.stringify(Object.fromEntries(Object.values(w.EX).map(e=>[e.id,e.n+'（'+e.eq+'）']))));
"""], cwd=os.path.join(TOOLS, '..'), capture_output=True, text=True, check=True).stdout)
rows = [(ex, d) for ex, v in sorted(up.items()) for d in v.get('demos') or []]

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
        dr.text((6, y), f"#{n}  {names.get(ex_id, ex_id)}  · {next(d['up'] for e, d in rows if e == ex_id and d['bv'] == bv and str(d['start']) == st)}", fill='black', font=font)
        for k, o in enumerate(outs):
            if os.path.exists(o): img.paste(Image.open(o), (4 + k * 260, y + 26))
    img.save(os.path.join(R, f'sheet_{s // PER + 1:02d}.jpg'), quality=80)
json.dump(index, open(os.path.join(R, 'index.json'), 'w'), ensure_ascii=False, indent=1)
print('共', len(res), '段，', (len(res) + PER - 1) // PER, '张总览图：', R)
