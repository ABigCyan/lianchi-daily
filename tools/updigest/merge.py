"""
第 4 步：把每个视频提炼出的干货和演示片段按动作归类，写进 tools/tips-up.json（按动作 id：up 干货、demos 演示片段）
和 tools/tips-up-meta.json（UP 主信息、通用知识），
再运行 node tools/build-tips.js 生成 App 用的 www/js/data-tips.js。
同一动作下内容几乎一样的条目只留一条。
用法：python3 merge.py <目录>
"""
import glob, html, json, os, re, subprocess, sys
D = sys.argv[1]; TOOLS = os.path.join(os.path.dirname(__file__), '..')
UPS = {'好人松松': 2078781964, 'Gandy': 378067652, '东哥': 1024129080, '谭成义': 521903482}
norm = lambda s: re.sub(r'[，。、；：！？,.;:!?\s“”"（）()]', '', s)
by_ex, demos, general = {}, {}, []
for f in sorted(glob.glob(os.path.join(D, 'extract', '*.json'))):
    v = json.load(open(f)); v['title'] = html.unescape(v['title'])
    for x in v['items']:
        e = {'up': v['up'], 'bv': v['bv'], 'title': v['title'][:40], 'type': x['type'], 'text': x['text'].strip(), 'topic': (x.get('topic') or '')[:12]}
        if isinstance(x.get('t'), int): e['t'] = x['t']
        e['_n'] = len(x.get('ex') or [])  # 一条同时挂了几个动作：越少越是专门讲这个动作的
        ids = [i for i in (x.get('ex') or []) if isinstance(i, str)]
        if not ids: general.append(e); continue
        for i in ids:
            lst = by_ex.setdefault(i, [])
            if not any(norm(y['text']) == norm(e['text']) for y in lst): lst.append(e)
    for x in v.get('demos') or []:
        e = {'up': v['up'], 'bv': v['bv'], 'title': v['title'][:40], 'kind': x.get('kind') if x.get('kind') in ('正确', '错误', '细节') else '正确',
             'what': (x.get('what') or '')[:40], 'view': (x.get('view') or '')[:12], 'start': x['start'], 'end': x['end']}
        for i in x.get('ex') or []:
            lst = demos.setdefault(i, [])
            # 同一个视频里时间重叠的只留一段
            if not any(y['bv'] == e['bv'] and y['start'] < e['end'] and e['start'] < y['end'] for y in lst): lst.append(e)
# 每个动作的干货：专门讲这个动作的在前，几位 UP 主轮流排，要点、错误优先，最多 16 条
def pick(lst, n=16):
    lst = sorted(lst, key=lambda e: (e['_n'] > 2, ('要点', '错误', '知识').index(e['type']) == 2, e['_n']))
    seen = {}
    for e in lst: seen[e['up']] = seen.get(e['up'], 0) + 1; e['_r'] = seen[e['up']]
    out = sorted(lst, key=lambda e: (e['_n'] > 2, e['_r']))[:n]
    out.sort(key=lambda e: ('要点', '错误', '知识').index(e['type']))
    return [{k: v for k, v in e.items() if not k.startswith('_')} for e in out]
by_ex = {i: pick(lst) for i, lst in by_ex.items()}
general = [{k: v for k, v in e.items() if not k.startswith('_')} for e in general]
# 每个动作的演示：正确示范在前，几位 UP 主轮流排，最多 12 段
for i, lst in demos.items():
    lst.sort(key=lambda e: (('正确', '细节', '错误').index(e['kind']), e['bv'], e['start']))
    seen = {}
    for e in lst: seen[e['up']] = seen.get(e['up'], 0) + 1; e['_r'] = seen[e['up']]
    demos[i] = [{k: e[k] for k in e if k != '_r'} for e in sorted(lst, key=lambda e: (('正确', '细节', '错误').index(e['kind']), e['_r']))][:12]
by_ex = {i: {'up': by_ex.get(i, []), 'demos': demos.get(i, [])} for i in set(by_ex) | set(demos)}
json.dump(by_ex, open(os.path.join(TOOLS, 'tips-up.json'), 'w'), ensure_ascii=False, indent=1)
json.dump({'ups': {k: {'mid': m, 'url': f'https://space.bilibili.com/{m}'} for k, m in UPS.items()}, 'general': general},
          open(os.path.join(TOOLS, 'tips-up-meta.json'), 'w'), ensure_ascii=False, indent=1)
print(f'按动作 {len(by_ex)} 个、干货 {sum(len(x["up"]) for x in by_ex.values())} 条、演示 {sum(len(x["demos"]) for x in by_ex.values())} 段；通用知识 {len(general)} 条')
subprocess.run(['node', os.path.join(TOOLS, 'build-tips.js')], check=True)
