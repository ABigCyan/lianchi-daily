"""
可选：把每个动作的 UP 主演示片段做成本机 GIF（只给自己看、核对片段准不准，不进仓库也不进 App——视频版权归 UP 主，App 里用 B站 官方播放器放）。
只下载片段那几秒（yt-dlp --download-sections），320 宽、10 帧/秒，最长 8 秒。
输出 <目录>/gifs/<动作id>/<视频号>_<开始秒>.gif 和一个总览页 <目录>/gifs/index.html。
用法：<装了 yt-dlp 的 python> make_gifs.py <目录>
"""
import html, json, os, subprocess, sys
D = sys.argv[1]; G = os.path.join(D, 'gifs'); os.makedirs(G, exist_ok=True)
TOOLS = os.path.join(os.path.dirname(__file__), '..')
up = json.load(open(os.path.join(TOOLS, 'tips-up.json')))
ytdlp = os.path.join(os.path.dirname(sys.executable), 'yt-dlp')
rows = []
for ex, v in sorted(up.items()):
    for d in v.get('demos') or []:
        a, b = d['start'], min(d['end'], d['start'] + 8)
        out = os.path.join(G, ex, f"{d['bv']}_{a}.gif"); os.makedirs(os.path.dirname(out), exist_ok=True)
        if not os.path.exists(out):
            tmp = out[:-4] + '.mp4'
            try:
                subprocess.run([ytdlp, '-q', '--no-warnings', '-f', 'bv*[height<=480][vcodec^=avc1]/bv*[height<=480]/wv', '--download-sections', f'*{a}-{b}', '--force-keyframes-at-cuts',
                                '-o', tmp, 'https://www.bilibili.com/video/' + d['bv']], check=True, timeout=600)
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-vf', 'fps=10,scale=320:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer',
                                '-loop', '0', out], check=True)
            except Exception as e:
                print('失败', ex, d['bv'], a, e, flush=True)
            if os.path.exists(tmp): os.remove(tmp)
        if os.path.exists(out):
            rows.append((ex, d, os.path.relpath(out, G)))
            print(ex, d['bv'], a, b, flush=True)
page = ['<!doctype html><meta charset="utf-8"><title>UP 主演示片段</title><style>body{font:14px system-ui;margin:16px}figure{display:inline-block;width:320px;margin:8px;vertical-align:top}img{width:320px;border-radius:8px}h2{margin-top:28px}</style><h1>UP 主演示片段（本机核对用）</h1>']
last = None
for ex, d, rel in rows:
    if ex != last: page.append(f'<h2>{html.escape(ex)}</h2>'); last = ex
    page.append(f'<figure><img src="{html.escape(rel)}" loading="lazy"><figcaption>[{html.escape(d["kind"])}] {html.escape(d["what"])}<br>{html.escape(d["up"])} · {d["bv"]} · {d["start"]}–{d["end"]} 秒</figcaption></figure>')
open(os.path.join(G, 'index.html'), 'w').write('\n'.join(page))
print('共', len(rows), '个 GIF，总览：', os.path.join(G, 'index.html'))
