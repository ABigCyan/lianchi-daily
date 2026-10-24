"""
第 3 步：让 MiniMax（MiniMax-M3.1-Flash，能看视频）同时看文字稿和画面，提炼干货，并找出 UP 主在器械上实际演示的片段（精确到秒）。
- 它能看画面但听不到声音，所以每次都给“带时间的文字稿 + 无声视频”；
- 视频先用 Files API 上传（mm_file://，保存 7 天，file_id 记在 extract/<bv>.fid，重跑不重复上传）；
- 超过 20 分钟的长课切成 20 分钟一段，每段单独提炼，时间再加回去；
- 讲动作的视频每秒看 0.5 帧；ups.json 里标了 slides 的（主要是幻灯片讲课）每 5 秒看 1 帧，省额度；
- 提示词前半部分（规则 + App 的全部动作目录）每次都一样，放在最前面，命中 MiniMax 的自动缓存；
- 订阅额度用完（2056 / 2067 / 1008 / 2053）就保存进度退出，下次接着做；被限速（1002、2062、2064、2066、429）就等一会儿再试；
- 同时跑 5 个视频；提炼完的视频文件就删掉。
只要“自己的话”转述的要点，不存原话；每条都带 UP 主、视频号和时间点。
用法：python3 extract.py <目录（videos.json、text/、video/）> <minimax.env>
"""
import json, os, re, subprocess, sys, threading, time, urllib.request, urllib.error, uuid
from concurrent.futures import ThreadPoolExecutor

D, ENV = sys.argv[1], sys.argv[2]
env = dict(re.findall(r'^\s*([A-Z_]+)\s*=\s*(.*?)\s*$', open(ENV).read(), re.M))
KEY, BASE, MODEL = env.get('MINIMAX_API_KEY', ''), env.get('MINIMAX_BASE_URL', 'https://api.minimax.cn/v1').rstrip('/'), env.get('MINIMAX_MODEL', 'MiniMax-M3.1-Flash')
if not KEY: sys.exit('minimax.env 里还没填 MINIMAX_API_KEY')
X, T, V = (os.path.join(D, x) for x in ('extract', 'text', 'video'))
os.makedirs(X, exist_ok=True)
PART = 20 * 60  # 长视频每段秒数

# App 的动作目录（id、名称、肌群、器械），给模型对号入座用
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
cat = json.loads(subprocess.run(['node', '-e', """
const w={};w.window=w;const fs=require('fs'),vm=require('vm');const c=vm.createContext(w);
for (const f of ['data-training.js','data-training-ext.js']) vm.runInContext(fs.readFileSync('www/js/'+f,'utf8'),c);
const g={};for(const sp of Object.values(w.SPLITS))for(const d of sp.days)for(const gr of d.groups)for(const e of gr.entries)for(const v of (w.ENTRY[e]||[]))g[v]=g[v]||gr.name;
console.log(JSON.stringify(Object.values(w.EX).map(e=>[e.id,e.n,g[e.id]||(e.groups||[]).join('/'),e.eq])));
"""], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
CATALOG = '\n'.join(f'{i} | {n} | {g} | {eq}' for i, n, g, eq in cat)
IDS = {c[0] for c in cat}
UPS = {u['name']: u for u in json.load(open(os.path.join(os.path.dirname(__file__), 'ups.json')))['ups']}

SYSTEM = f"""你是健身内容编辑，替“练好吃对”App 整理 B站 健身 UP 主的教学视频。
每次给你一段视频的画面（无声）和同一段的文字稿。文字稿是语音识别出来的，每行开头是这句话开始的时间（分:秒，从这一段开头算），可能有错字、口语、重复，按意思理解。
画面和文字稿要对照着看：说的是什么、画面里在做什么。

任务一：提炼干货（items）
1. 某个具体动作的做法要点：起始姿势、发力和轨迹、呼吸、幅度、节奏、握距站距、器械调节。
2. 常见错误和纠正办法、受伤风险、感受不到目标肌肉时怎么办。
3. 不属于单个动作的训练、饮食、恢复知识（训练安排、组数次数、减脂增肌、吃什么吃多少等）。
不要：寒暄、带货、个人经历、闲聊、重复的话；没有把握的不要写；不要编造视频里没说的。
每条用你自己的话写，一句话说清楚，不超过 60 个汉字，不要照抄原话，不要写“UP 主说”。
t 填这一条在视频里讲到或演示到的时间（秒，从这一段开头算，整数）。

任务二：找演示片段（demos）
只要 UP 主（或请来的人）在真实器械、哑铃杠铃、自重上实际做动作的片段，每段 2-15 秒，越干净越好（一个完整的重复，或一个清楚的细节、错误示范）。
不要：只在说话没做动作、幻灯片、动画、文字画面、跟动作无关的镜头。
start、end 是这一段的开始和结束（秒，从这一段开头算，整数），要和画面对得上。
kind：正确（标准示范）、错误（故意做错给你看）、细节（局部特写，比如握法、脚的位置、肩胛）。
what 用一句话（≤30字）说清楚这几秒里看什么；view 写镜头角度（侧面、正面、背面、俯拍、特写）。

动作对号入座：在下面的动作目录里找对应的 id（可以有多个，比如讲杠铃平板卧推时也适用于器械或史密斯版本的就都写上，但不要牵强）。
目录里实在没有的，ex 留空并在 topic 写动作名。

只输出一个 JSON 对象，不要其他文字：
{{"items": [{{"ex": ["动作 id"], "topic": "动作名或主题（≤10字）", "type": "要点|错误|知识", "text": "…", "t": 秒}}],
 "demos": [{{"ex": ["动作 id"], "topic": "动作名（≤10字）", "kind": "正确|错误|细节", "what": "…", "view": "…", "start": 秒, "end": 秒}}]}}
一段视频一般 3-15 条干货、0-15 个演示；没有就给空数组。

动作目录（id | 名称 | 肌群 | 器械）：
{CATALOG}"""

def post(path, body, ctype):
    req = urllib.request.Request(BASE + path, data=body, headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': ctype})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=900).read())
    except urllib.error.HTTPError as e:
        txt = e.read().decode('utf8', 'ignore')
        try: d = json.loads(txt)
        except Exception: d = {'base_resp': {'status_code': e.code, 'status_msg': txt[:200]}}
        if e.code == 429: d.setdefault('base_resp', {})['status_code'] = 1002
        return d
    except Exception as e:  # 断网、超时：当成限速，等一会儿再试
        return {'base_resp': {'status_code': 1002, 'status_msg': str(e)[:200]}}

def upload(path):
    bd = uuid.uuid4().hex
    body = (f'--{bd}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nvideo_understanding\r\n'
            f'--{bd}\r\nContent-Disposition: form-data; name="file"; filename="{os.path.basename(path)}"\r\nContent-Type: video/mp4\r\n\r\n').encode() \
        + open(path, 'rb').read() + f'\r\n--{bd}--\r\n'.encode()
    return post('/files/upload', body, 'multipart/form-data; boundary=' + bd)

QUOTA = {2056: '超出订阅资源限制（这个时段的额度用完了）', 2067: '套餐额度已用完', 1008: '余额不足', 2053: '积分不足'}
RATE = {1002, 2062, 2064, 2066}
class Stop(Exception): pass
stop, lock = threading.Event(), threading.Lock()
tok = {'in': 0, 'cached': 0, 'out': 0}

def retry(fn):
    for attempt in range(8):
        if stop.is_set(): raise Stop()
        d = fn(); code = (d.get('base_resp') or {}).get('status_code', 0)
        if code in QUOTA:
            if not stop.is_set(): print(f'停止：{QUOTA[code]}（{code}）。已完成的都存好了，下次运行接着做。', flush=True)
            stop.set(); raise Stop()
        if code in RATE: time.sleep(20 * (attempt + 1)); continue
        if code != 0: raise RuntimeError(f'{code} {(d.get("base_resp") or {}).get("status_msg")}')
        return d
    raise RuntimeError('一直被限速')

sec = lambda s: int(s.split(':')[0]) * 60 + int(s.split(':')[1])
def mmss(s): return f'{s // 60}:{s % 60:02d}'

def one(v):
    bv = v['bv']; full = os.path.join(V, bv + '.mp4')
    lines = [(sec(m.group(1)), m.group(2)) for m in (re.match(r'\[(\d+:\d\d)\] (.*)', l) for l in open(os.path.join(T, bv + '.txt'))) if m]
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', full], capture_output=True, text=True).stdout or v['sec'])
    fps = 0.2 if UPS.get(v['up'], {}).get('slides') else 0.5  # 幻灯片讲课每 5 秒看 1 帧，省额度
    items, demos = [], []
    starts = list(range(0, int(dur), PART)) or [0]
    if len(starts) > 1 and dur - starts[-1] < 120: starts.pop()  # 最后不到两分钟的并进前一段
    for n, s0 in enumerate(starts):
        s1 = starts[n + 1] if n + 1 < len(starts) else int(dur) + 1
        fidf = os.path.join(X, f'{bv}.{n}.fid')
        if os.path.exists(fidf) and time.time() - os.path.getmtime(fidf) < 6 * 86400: fid = open(fidf).read().strip()
        else:
            path = full
            if len(starts) > 1:
                path = os.path.join(V, f'{bv}.{n}.mp4')
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(s0), '-i', full, '-t', str(s1 - s0), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-an', path], check=True)
            fid = str(retry(lambda: upload(path))['file']['file_id'])
            open(fidf, 'w').write(fid)
            if path != full: os.remove(path)
        tr = '\n'.join(f'[{mmss(t - s0)}] {x}' for t, x in lines if s0 <= t < s1)
        user = [{'type': 'text', 'text': f"视频：{v['title']}（UP 主：{v['up']}，{bv}，第 {n + 1}/{len(starts)} 段，这一段约 {(s1 - s0) // 60} 分钟）\n文字稿：\n{tr or '（这一段没有说话）'}"},
                {'type': 'video_url', 'video_url': {'url': f'mm_file://{fid}', 'fps': fps, 'detail': 'low'}}]
        body = json.dumps({'model': MODEL, 'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user}],
                           'max_completion_tokens': 16000, 'reasoning_effort': 'low', 'reasoning_split': True}).encode()
        r = None
        for k in range(2):  # 返回的不是合法 JSON（被截断、引号没转义）就再要一次
            d = retry(lambda: post('/chat/completions', body, 'application/json'))
            u = d.get('usage') or {}
            with lock:
                tok['in'] += u.get('prompt_tokens', 0); tok['cached'] += (u.get('prompt_tokens_details') or {}).get('cached_tokens', 0); tok['out'] += u.get('completion_tokens', 0)
            content = d['choices'][0]['message'].get('content') or ''
            m = re.search(r'\{.*\}', content, re.S)
            try: r = json.loads(m.group(0)) if m else {}; break
            except Exception:
                open(os.path.join(X, f'{bv}.{n}.raw.txt'), 'w').write(content)
        if r is None: r = {}; print(f'{bv} 第 {n + 1} 段两次都不是合法 JSON，跳过这段（原文存在 extract/{bv}.{n}.raw.txt）', flush=True)
        num = lambda x: int(x) if isinstance(x, (int, float)) or (isinstance(x, str) and x.isdigit()) else None
        for x in r.get('items') or []:
            if isinstance(x, dict) and x.get('text') and len(x['text']) <= 90 and x.get('type') in ('要点', '错误', '知识'):
                x['ex'] = [i for i in (x.get('ex') or []) if i in IDS]
                x['t'] = num(x.get('t')) + s0 if num(x.get('t')) is not None else None
                items.append(x)
        for x in r.get('demos') or []:
            a, b = num((x or {}).get('start')), num((x or {}).get('end'))
            if a is None or b is None or not (0 < b - a <= 30) or a > s1 - s0: continue
            x['ex'] = [i for i in (x.get('ex') or []) if i in IDS]
            x['start'], x['end'] = a + s0, b + s0
            demos.append(x)
    json.dump({'bv': bv, 'up': v['up'], 'title': v['title'], 'items': items, 'demos': demos}, open(os.path.join(X, bv + '.json'), 'w'), ensure_ascii=False, indent=1)
    os.remove(full)
    for f in os.listdir(X):
        if f.startswith(bv + '.') and f.endswith('.fid'): os.remove(os.path.join(X, f))
    return len(items), len(demos)

vids = json.load(open(os.path.join(D, 'videos.json')))
ready = lambda v: os.path.exists(os.path.join(T, v['bv'] + '.txt')) and os.path.exists(os.path.join(V, v['bv'] + '.mp4'))
todo = [v for v in vids if ready(v) and not os.path.exists(os.path.join(X, v['bv'] + '.json'))]
print(f'能提炼的 {len(todo)} 个（文字稿和视频都准备好了的）', flush=True)
k = [0]
def job(v):
    if stop.is_set(): return
    try:
        ni, nd = one(v)
        with lock:
            k[0] += 1
            print(f'[{k[0]}/{len(todo)}] {v["bv"]} {v["up"]} {v["sec"] // 60} 分钟：干货 {ni} 条、演示 {nd} 段（累计输入 {tok["in"]}，缓存命中 {tok["cached"]}，输出 {tok["out"]}）', flush=True)
    except Stop: pass
    except Exception as e: print(f'{v["bv"]} 出错：{e}', flush=True)
with ThreadPoolExecutor(5) as ex: list(ex.map(job, todo))
print(f'本次用量：输入 {tok["in"]}（其中缓存 {tok["cached"]}），输出 {tok["out"]}', flush=True)
print('额度用完，停在这里' if stop.is_set() else '这一批都提炼完了', flush=True)
sys.exit(3 if stop.is_set() else 0)
