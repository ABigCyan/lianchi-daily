"""
第 3 步：用 MiniMax 从文字稿里提炼干货，按动作归类。
- 提示词前半部分（规则 + App 的全部动作目录）每次都一样，放在最前面，命中 MiniMax 的自动缓存（≥512 词元的相同前缀）；
  每个视频只在最后附上自己的文字稿。
- 订阅额度用完（2056 超出资源限制 / 2067 套餐额度已用完 / 1008、2053 余额或积分不足）就保存进度退出，下次接着做。
- 被限速（1002、2062、429）就等一会儿再试。
- 只要“自己的话”转述的要点，不存原话；每条都带 UP 主和视频号，App 里显示出处和链接。
用法：python3 extract.py <目录（videos.json、text/）> <minimax.env>
"""
import json, os, re, subprocess, sys, time, urllib.request, urllib.error

D, ENV = sys.argv[1], sys.argv[2]
env = dict(re.findall(r'^\s*([A-Z_]+)\s*=\s*(.*?)\s*$', open(ENV).read(), re.M))
KEY, BASE, MODEL = env.get('MINIMAX_API_KEY', ''), env.get('MINIMAX_BASE_URL', 'https://api.minimax.cn/v1').rstrip('/'), env.get('MINIMAX_MODEL', 'MiniMax-M3.1-Flash')
if not KEY: sys.exit('minimax.env 里还没填 MINIMAX_API_KEY')
X = os.path.join(D, 'extract'); os.makedirs(X, exist_ok=True)

# App 的动作目录（id、名称、肌群），给模型对号入座用
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
cat = json.loads(subprocess.run(['node', '-e', """
const w={};w.window=w;const fs=require('fs'),vm=require('vm');const c=vm.createContext(w);
for (const f of ['data-training.js','data-training-ext.js']) vm.runInContext(fs.readFileSync('www/js/'+f,'utf8'),c);
const g={};for(const sp of Object.values(w.SPLITS))for(const d of sp.days)for(const gr of d.groups)for(const e of gr.entries)for(const v of (w.ENTRY[e]||[]))g[v]=g[v]||gr.name;
console.log(JSON.stringify(Object.values(w.EX).map(e=>[e.id,e.n,g[e.id]||(e.groups||[]).join('/'),e.eq])));
"""], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
CATALOG = '\n'.join(f'{i} | {n} | {g} | {eq}' for i, n, g, eq in cat)

SYSTEM = f"""你是健身内容编辑，替“练好吃对”App 从 B站 健身 UP 主的视频文字稿里提炼干货。
文字稿是语音识别出来的，可能有错字、口语、重复；按意思理解。

要提炼的：
1. 某个具体动作的做法要点：起始姿势、发力和轨迹、呼吸、幅度、节奏、握距站距、器械调节。
2. 常见错误和纠正办法、受伤风险、感受不到目标肌肉时怎么办。
3. 不属于单个动作的训练、饮食、恢复知识（训练安排、组数次数、减脂增肌、吃什么吃多少等）。
不要：寒暄、带货、个人经历、闲聊、重复的话；没有把握的不要写；不要编造视频里没说的。

每条用你自己的话写，一句话说清楚，不超过 60 个汉字，不要照抄原话，不要写“UP 主说”。
动作要点和错误：在下面的动作目录里找对应的 id（可以有多个，比如讲“杠铃卧推”的同时适用于 bench_bb）；目录里实在没有的，ex 留空并在 topic 写动作名。

只输出一个 JSON 数组，不要其他文字，每个元素：
{{"ex": ["动作 id", ...], "topic": "动作名或主题（≤10字）", "type": "要点|错误|知识", "text": "…"}}
一个视频一般 3-15 条，没有干货就输出 []。

动作目录（id | 名称 | 肌群 | 器械）：
{CATALOG}"""

def call(user):
    body = json.dumps({'model': MODEL, 'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user}],
                       'max_completion_tokens': 12000, 'reasoning_effort': 'low', 'reasoning_split': True}).encode()
    req = urllib.request.Request(BASE + '/chat/completions', data=body, headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    try:
        d = json.loads(urllib.request.urlopen(req, timeout=600).read())
    except urllib.error.HTTPError as e:
        txt = e.read().decode('utf8', 'ignore')
        try: d = json.loads(txt)
        except Exception: d = {'base_resp': {'status_code': e.code, 'status_msg': txt[:200]}}
        if e.code == 429: d.setdefault('base_resp', {})['status_code'] = 1002
    return d

QUOTA = {2056: '超出订阅资源限制（这个时段的额度用完了）', 2067: '套餐额度已用完', 1008: '余额不足', 2053: '积分不足'}
RATE = {1002, 2062, 2064, 2066}
vids = json.load(open(os.path.join(D, 'videos.json')))
todo = [v for v in vids if os.path.exists(os.path.join(D, 'text', v['bv'] + '.txt')) and not os.path.exists(os.path.join(X, v['bv'] + '.json'))]
print(f'有文字稿 {sum(os.path.exists(os.path.join(D, "text", v["bv"] + ".txt")) for v in vids)} 个，还要提炼 {len(todo)} 个', flush=True)
tok = {'in': 0, 'cached': 0, 'out': 0}
for i, v in enumerate(todo, 1):
    text = open(os.path.join(D, 'text', v['bv'] + '.txt')).read()
    parts = [text[k:k + 30000] for k in range(0, len(text), 30000)] or ['']  # 很长的课分段，每段单独提炼
    items, ok = [], True
    for n, part in enumerate(parts, 1):
        user = f"视频：{v['title']}（UP 主：{v['up']}，{v['bv']}，第 {n}/{len(parts)} 段）\n文字稿：\n{part}"
        for attempt in range(6):
            d = call(user)
            code = (d.get('base_resp') or {}).get('status_code', 0)
            if code in QUOTA:
                print(f'停止：{QUOTA[code]}（{code}）。已完成的都存好了，下次运行接着做。', flush=True)
                print(f'本次用量：输入 {tok["in"]}（其中缓存 {tok["cached"]}），输出 {tok["out"]}', flush=True); sys.exit(0)
            if code in RATE: time.sleep(20 * (attempt + 1)); continue
            if code != 0: print(f'{v["bv"]} 出错 {code} {(d.get("base_resp") or {}).get("status_msg")}', flush=True); ok = False; break
            u = d.get('usage') or {}
            tok['in'] += u.get('prompt_tokens', 0); tok['cached'] += (u.get('prompt_tokens_details') or {}).get('cached_tokens', 0); tok['out'] += u.get('completion_tokens', 0)
            content = (d['choices'][0]['message'].get('content') or '')
            m = re.search(r'\[.*\]', content, re.S)
            try: items += json.loads(m.group(0)) if m else []
            except Exception: print(f'{v["bv"]} 第 {n} 段返回的不是合法 JSON，跳过这段', flush=True)
            break
        else:
            ok = False
        if not ok: break
    if not ok: continue
    clean = [x for x in items if isinstance(x, dict) and x.get('text') and len(x['text']) <= 90 and x.get('type') in ('要点', '错误', '知识')]
    json.dump({'bv': v['bv'], 'up': v['up'], 'title': v['title'], 'items': clean}, open(os.path.join(X, v['bv'] + '.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'[{i}/{len(todo)}] {v["bv"]} {v["up"]}：{len(clean)} 条（累计输入 {tok["in"]}，缓存命中 {tok["cached"]}，输出 {tok["out"]}）', flush=True)
print('全部提炼完', flush=True)
