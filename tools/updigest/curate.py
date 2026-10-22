"""
第 3.6 步：干货精选。提炼时一条干货常常挂了好几个动作（讲“推胸”的挂到所有推胸动作上），一个动作下面能堆一百多条，又乱又不准。
这里每个动作让 MiniMax 从候选里挑：只留真正讲这个动作、这种器械的；最多 3 条“最该记住的”+ 5 条补充；意思不变地压短到 28 字以内。
结果存 curate/<动作id>.json，可以接着跑；额度用完自动停。
用法：python3 curate.py <目录（extract/）> <minimax.env>
"""
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__))
from common import Client, Stop, catalog, ROOT

D, ENV = sys.argv[1], sys.argv[2]
X, C = os.path.join(D, 'extract'), os.path.join(D, 'curate')
os.makedirs(C, exist_ok=True)
cli = Client(ENV)
EX = {c[0]: c for c in catalog()}
acts = json.loads(subprocess.run(['node', '-e', """
const w={};w.window=w;const fs=require('fs'),vm=require('vm');const c=vm.createContext(w);vm.runInContext(fs.readFileSync('www/js/data-tips.js','utf8'),c);
const o={};for(const [k,t] of Object.entries(w.TIPS)) o[k]={acts:(t.excel&&t.excel.acts)||[],muscles:(t.excel&&t.excel.muscles)||[],cues:t.cues||[]};console.log(JSON.stringify(o));
"""], cwd=ROOT, capture_output=True, text=True, check=True).stdout)

SYSTEM = """你是健身内容编辑，替“练好吃对”App 给每个动作挑 UP 主的干货。App 的原则是简洁明了：用户点开一个动作，一眼看到练什么、要点在哪、去哪看动作。
每次给你一个动作（名称、器械、套表里的关节活动），以及从 B站 UP 主视频里提炼出的候选条目（编号、UP 主、类型、内容）。
挑选规则：
1. 只要真正讲这个动作、这种器械的。讲别的器械版本（例如哑铃推举的条目不能给器械推举）、泛泛的训练原理、饮食、计划安排都不要。
2. 要具体、能照着做：姿势、握法、发力、轨迹、幅度、呼吸、常见错误怎么改。空话、重复、互相矛盾的不要；和套表关节活动矛盾的不要。
3. top 最多 3 条：新手最该记住的、最能避免受伤或练错的；more 最多 5 条补充。没有合格的就给空数组，宁缺毋滥。
4. 每条可以在不改变意思的前提下改写得更短更清楚，不超过 28 个汉字，不要写“UP 主说”。
只输出 JSON：{"top": [{"i": 编号, "text": "…"}], "more": [{"i": 编号, "text": "…"}]}"""

def items_by_ex():
    out = {}
    for f in sorted(os.listdir(X)):
        if not f.endswith('.json'): continue
        v = json.load(open(os.path.join(X, f)))
        for x in v['items']:
            if x.get('type') not in ('要点', '错误'): continue
            for i in x.get('ex') or []:
                out.setdefault(i, []).append({'up': v['up'], 'bv': v['bv'], 'title': v['title'], 'type': x['type'], 'text': x['text'], 't': x.get('t'), 'n': len(x['ex'])})
    return out

def one(ex_id, cands):
    out = os.path.join(C, ex_id + '.json')
    if os.path.exists(out) or cli.stop.is_set(): return
    e, a = EX[ex_id], acts.get(ex_id, {})
    # 专门讲这个动作的排前面，最多给 80 条
    cands = sorted(cands, key=lambda x: x['n'])[:80]
    lines = '\n'.join(f"{k}. [{x['up']}·{x['type']}] {x['text']}" for k, x in enumerate(cands))
    user = f"动作：{e[1]}（器械：{e[3]}）。套表关节活动：{'、'.join(a.get('acts') or []) or '（套表没写）'}；练到：{'、'.join(a.get('muscles') or [])[:60]}\n候选：\n{lines}"
    try:
        r = cli.ask_json(SYSTEM, user, 3000)
    except Stop: return
    if not isinstance(r, dict): print(ex_id, '返回的不是合法 JSON', flush=True); return
    pick = lambda arr: [dict(cands[p['i']], text=str(p.get('text') or cands[p['i']]['text'])[:40]) for p in (arr or [])
                        if isinstance(p, dict) and isinstance(p.get('i'), int) and 0 <= p['i'] < len(cands)]
    res = {'top': pick(r.get('top'))[:3], 'more': pick(r.get('more'))[:5]}
    for lst in res.values():
        for x in lst: x.pop('n', None)
    json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
    print(f"{ex_id} {e[1]}：候选 {len(cands)} 条 → 主要 {len(res['top'])}、补充 {len(res['more'])}（累计 {cli.usage()}）", flush=True)

todo = items_by_ex()
print(f'有候选干货的动作 {len(todo)} 个', flush=True)
with ThreadPoolExecutor(4) as ex: list(ex.map(lambda kv: one(*kv), [(k, v) for k, v in todo.items() if k in EX]))
print('本次用量：' + cli.usage(), flush=True)
sys.exit(3 if cli.stop.is_set() else 0)
