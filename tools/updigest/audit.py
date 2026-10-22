"""
第 3.5 步：演示片段审计。提炼时标出的演示片段有不少对不上（名字像、但画面里做的是别的动作，或者是白板讲解、训练单、别人的素材），
这里让 MiniMax 逐段“看”一遍（前后各多留 3 秒），只留高把握的：
提炼时的判断、只看视频“盲认”（不告诉它原来以为是什么）、看逐秒拼图“盲认”三者一致，模型说的动的关节还要和套表的关节活动对得上。
- 只认画面：器械种类（固定器械 / 哑铃 / 杠铃 / 龙门架 / 史密斯）、坐站躺、握法、发力方向要和动作库一致；字幕、标题、名字像都不算；
- 只要 UP 主本人或请来的真人在真实器械上做：白板、幻灯片、解剖图、动画、只在说话、屏幕上只有训练单、插入的别处素材、太糊太暗都不要；
- 宁可少放也不放错：对不上的直接不要，不改挂到别的动作（试过改挂，这个模型看蹲类器械容易认成推举）；
- 同时标出片段里每一小段的机位（正面 / 侧面 / 背面 / 斜侧 / 俯拍 / 特写），给 App 打标签用。
每段结果存 audit/<视频号>_<开始秒>.json，可以随时中断、接着跑；额度用完自动停。整段视频（360p）用完就删。
用法：<装了 yt-dlp 的 python> audit.py <目录（extract/）> <minimax.env>
"""
import base64, json, os, subprocess, sys, threading
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__))
from common import Client, Stop, catalog, ROOT

D, ENV = sys.argv[1], sys.argv[2]
X, A, F = (os.path.join(D, x) for x in ('extract', 'audit', 'full'))
for p in (A, F): os.makedirs(p, exist_ok=True)
cli = Client(ENV)
CAT = catalog(); EX = {c[0]: c for c in CAT}
ytdlp = os.path.join(os.path.dirname(sys.executable), 'yt-dlp')

SYSTEM = """你是健身动作审核员，替“练好吃对”App 核对 B站 UP 主视频里的动作演示片段。
每次给你一小段视频（无声，前后各多留了 3 秒），或者同一段按时间顺序排成的拼图，请你只看画面，从动作目录里认出在做什么。
只按画面判断，不看字幕、标题、名字像不像：
1. 器械种类必须一致：固定器械、哑铃、杠铃、龙门架/绳索、史密斯机、自重、弹力带不能混；坐、站、躺、俯身，平板/上斜/下斜，握法（正握/反握/对握、宽窄）、发力方向也要一致。
2. 必须是真人（UP 主本人，或 UP 主请来示范的人）在真实器械上实际做这个动作，看得清楚。
3. 下面这些都不算演示：白板、幻灯片、解剖图、动画；人只是在说话或摆姿势没做动作；屏幕上主要是文字或训练单；
   插入的别处素材（别的平台水印、明显不是这个 UP 主的画面风格、老比赛录像等）；太糊、太暗、只拍到一部分看不出动作。
4. 画面里实际做的是动作目录里的另一个动作时，actual 填那个动作的 id；目录里都没有填 null。
5. 先观察再判断：在 observed 里写清楚身体姿势（坐/站/躺/俯身、靠背角度）、负重在哪（手里/肩上/器械手柄/踏板）、哪些关节在动（例如“膝和髋屈伸”是蹲类，“肩和肘向上推”是推举类）、器械长什么样。
   UP 主说的话（附在后面）可以帮你理解他在做什么，但最后以画面为准；拿不准就 matches=false。
6. segments 标出片段里真正在做这个动作的每一小段（秒，从这段视频开头算），按机位分开：正面、侧面、背面、斜侧、俯拍、特写。
7. quality 1-5：5 = 机位清楚、动作标准完整、适合给新手看；3 = 能看清但一般；1-2 = 勉强或有问题。

只输出一个 JSON 对象，不要其他文字：
{"observed": "姿势、负重、动的关节、器械（≤60字）", "joints": ["这几秒里明显在屈伸/转动的关节，从 肩 肘 腕 髋 膝 踝 躯干 里选"], "real_demo": true/false, "person": "UP主本人|请来的真人|其他", "actual": "动作 id 或 null", "matches": true/false, "quality": 1-5,
 "segments": [{"start": 秒, "end": 秒, "view": "正面|侧面|背面|斜侧|俯拍|特写"}], "reason": "一句话说明（≤30字）"}

动作目录（id | 名称 | 器械）：
""" + '\n'.join(f'{c[0]} | {c[1]} | {c[3]}' for c in CAT)

def said(bv, a, b):
    """这几秒 UP 主说的话（本机文字稿），帮模型理解画面"""
    p = os.path.join(D, 'text', bv + '.txt')
    if not os.path.exists(p): return ''
    out = []
    for l in open(p):
        try: t = int(l[1:l.index(']')].split(':')[0]) * 60 + int(l[1:l.index(']')].split(':')[1])
        except Exception: continue
        if a - 15 <= t <= b: out.append(l.strip()[l.index(']') + 1:].strip())
    return ' '.join(out)[:600]

def sheet_b64(full, cs, ce, key):
    """把片段按时间顺序排成一张拼图（最多 16 帧，4 列），给模型当高清图看"""
    dur = max(1, ce - cs); fps = min(1.0, 16 / dur); path = os.path.join(F, key + '.jpg')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(cs), '-i', full, '-t', str(dur), '-vf', f'fps={fps:.3f},scale=426:-2,tile=4x4:padding=4',
                    '-frames:v', '1', path], check=True)
    b = base64.b64encode(open(path, 'rb').read()).decode(); os.remove(path); return b

def blind_sheet(b64, ctx):
    content = [{'type': 'text', 'text': (ctx + '\n' if ctx else '') + '这次给的是同一段视频按时间顺序排成的拼图（从左上到右下，大约每秒一帧）。先对比第一帧到最后一帧身体哪些部位在动、负重在哪，再从目录里认出在做什么动作。'},
               {'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + b64, 'detail': 'high'}}]
    return cli.ask_json(SYSTEM, content, 3000)

def blind(clip_b64, ctx):
    content = [{'type': 'text', 'text': (ctx + '\n' if ctx else '') + '这次只给视频，请先看画面认出在做什么动作（actual 填目录里的 id；matches 填 true 表示你认得出来）。视频片段：'},
               {'type': 'video_url', 'video_url': {'url': 'data:video/mp4;base64,' + clip_b64, 'fps': 2, 'detail': 'default'}}]
    return cli.ask_json(SYSTEM, content, 3000)

# 套表里每个动作的关节活动（表21-24 + 表28），用来校验模型看到的关节对不对得上
def _joints():
    out = subprocess.run(['node', '-e', """
const w={};w.window=w;const fs=require('fs'),vm=require('vm');const c=vm.createContext(w);vm.runInContext(fs.readFileSync('www/js/data-tips.js','utf8'),c);
const o={};for(const [k,t] of Object.entries(w.TIPS)) if(t.excel&&t.excel.acts&&t.excel.acts.length) o[k]=t.excel.acts;console.log(JSON.stringify(o));
"""], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    J = {'肩': '肩', '肘': '肘', '膝': '膝', '髋': '髋', '躯': '躯干', '骨': '躯干', '踝': '踝', '足': '踝'}
    return {k: {J[a[0]] for a in acts if a[0] in J} for k, acts in json.loads(out).items()}
JOINTS = _joints()
def joints_ok(ex_id, r):
    need, seen = JOINTS.get(ex_id), set((r or {}).get('joints') or [])
    if not need or not seen: return True  # 套表没写（补充动作）或模型没给：不拦
    return bool(need & seen) and not ({'膝', '髋'} <= seen and not need & {'膝', '髋'}) and not ({'肩', '肘'} <= seen and not need & {'肩', '肘'})

def num(x):
    try: return float(x)
    except Exception: return None

def judge(r, cs):
    """审计结果 → (动作 id 或 None, 机位小段[绝对秒], 质量)"""
    if not isinstance(r, dict) or not r.get('real_demo') or r.get('person') not in ('UP主本人', '请来的真人'): return None, [], 0
    q = int(num(r.get('quality')) or 0)
    segs = []
    for s in r.get('segments') or []:
        a, b = num((s or {}).get('start')), num((s or {}).get('end'))
        if a is None or b is None or b - a < 1.5: continue
        segs.append({'start': int(cs + a), 'end': int(round(cs + b)), 'view': s.get('view') if s.get('view') in ('正面', '侧面', '背面', '斜侧', '俯拍', '特写') else '斜侧'})
    return (r.get('actual') if r.get('actual') in EX else None), segs, q

def one_clip(full, d, cand):
    key = f"{d['bv']}_{cand['start']}"; out = os.path.join(A, key + '.json')
    if os.path.exists(out): return
    cs, ce = max(0, cand['start'] - 3), min(cand['end'] + 3, cand['start'] + 40)
    tmp = os.path.join(F, key + '.mp4')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(cs), '-i', full, '-t', str(ce - cs), '-vf', 'fps=4,scale=-2:480', '-c:v', 'libx264',
                    '-preset', 'veryfast', '-crf', '30', '-an', tmp], check=True)
    b64 = base64.b64encode(open(tmp, 'rb').read()).decode(); os.remove(tmp)
    claims = [i for i in cand.get('ex') or [] if i in EX]
    rec = {'bv': d['bv'], 'up': d['up'], 'title': d['title'], 'start': cand['start'], 'end': cand['end'], 'claims': claims, 'topic': cand.get('topic', ''),
           'kind': cand.get('kind', ''), 'what': cand.get('what', ''), 'checks': [], 'keep': None, 'segments': [], 'quality': 0}
    ctx = f"视频标题：《{d['title']}》（UP 主：{d['up']}）。"
    # 只留高把握的：提炼时的判断（UP 主讲解 + 画面）、只看视频“盲认”、看逐秒拼图“盲认”三者一致才收。
    # 盲认时不告诉它原来以为是什么，免得顺着说；宁可少放也不放错。
    r = blind(b64, ctx); rec['checks'].append(r)
    actual, segs, q = judge(r, cs)
    if actual and actual in claims and q >= 3 and joints_ok(actual, r):
        r2 = blind_sheet(sheet_b64(full, cs, ce, key), ctx); rec['checks'].append(r2)
        if isinstance(r2, dict) and r2.get('actual') == actual and joints_ok(actual, r2):
            rec.update(keep=actual, segments=segs, quality=q)
    json.dump(rec, open(out, 'w'), ensure_ascii=False, indent=1)

def one_video(d):
    if cli.stop.is_set(): return
    cands = [c for c in d.get('demos') or [] if not os.path.exists(os.path.join(A, f"{d['bv']}_{c['start']}.json"))]
    if not cands: return
    full = os.path.join(F, d['bv'] + '.mp4')
    try:
        if not os.path.exists(full):
            subprocess.run([ytdlp, '-q', '--no-warnings', '--retries', '10', '--socket-timeout', '30', '-f', 'bv*[height<=480][vcodec^=avc1]/bv*[height<=480]/wv', '-o', full + '.part.mp4',
                            'https://www.bilibili.com/video/' + d['bv']], check=True, timeout=3600)
            os.rename(full + '.part.mp4', full)
        with ThreadPoolExecutor(int(os.environ.get('CLIPS', 3))) as ex: list(ex.map(lambda c: one_clip(full, d, c), cands))
        done = sum(os.path.exists(os.path.join(A, f"{d['bv']}_{c['start']}.json")) for c in cands)
        if done == len(cands): os.remove(full)
        kept = sum(1 for c in cands if (json.load(open(os.path.join(A, f"{d['bv']}_{c['start']}.json"))).get('keep') if os.path.exists(os.path.join(A, f"{d['bv']}_{c['start']}.json")) else None))
        with cli.lock: print(f'{d["bv"]} {d["up"]}：审了 {done}/{len(cands)} 段，留下 {kept} 段（累计 {cli.usage()}）', flush=True)
    except Stop: pass
    except Exception as e: print(f'{d["bv"]} 出错：{e}', flush=True)

vids = [json.load(open(os.path.join(X, f))) for f in sorted(os.listdir(X)) if f.endswith('.json')]
vids = [v for v in vids if v.get('demos')]
print(f'有演示片段的视频 {len(vids)} 个，共 {sum(len(v["demos"]) for v in vids)} 段，已审 {len(os.listdir(A))} 段', flush=True)
with ThreadPoolExecutor(int(os.environ.get('VIDEOS', 4))) as ex: list(ex.map(one_video, vids))
print('本次用量：' + cli.usage(), flush=True)
print('额度用完，停在这里' if cli.stop.is_set() else '全部审完', flush=True)
sys.exit(3 if cli.stop.is_set() else 0)
