"""
第 4 步：把每个视频提炼出的条目按动作归类，写进 tools/tips-up.json（按动作 id）和 tools/tips-up-meta.json（UP 主信息、通用知识），
再运行 node tools/build-tips.js 生成 App 用的 www/js/data-tips.js。
同一动作下内容几乎一样的条目只留一条。
用法：python3 merge.py <目录>
"""
import glob, json, os, re, subprocess, sys
D = sys.argv[1]; TOOLS = os.path.join(os.path.dirname(__file__), '..')
UPS = {'好人松松': 2078781964, 'Gandy': 378067652, '东哥': 1024129080, '谭成义': 521903482}
norm = lambda s: re.sub(r'[，。、；：！？,.;:!?\s“”"（）()]', '', s)
by_ex, general = {}, []
for f in sorted(glob.glob(os.path.join(D, 'extract', '*.json'))):
    v = json.load(open(f))
    for x in v['items']:
        e = {'up': v['up'], 'bv': v['bv'], 'title': v['title'][:40], 'type': x['type'], 'text': x['text'].strip(), 'topic': (x.get('topic') or '')[:12]}
        ids = [i for i in (x.get('ex') or []) if isinstance(i, str)]
        if not ids: general.append(e); continue
        for i in ids:
            lst = by_ex.setdefault(i, [])
            if not any(norm(y['text']) == norm(e['text']) for y in lst): lst.append(e)
for lst in by_ex.values(): lst.sort(key=lambda e: ('要点', '错误', '知识').index(e['type']))
json.dump(by_ex, open(os.path.join(TOOLS, 'tips-up.json'), 'w'), ensure_ascii=False, indent=1)
json.dump({'ups': {k: {'mid': m, 'url': f'https://space.bilibili.com/{m}'} for k, m in UPS.items()}, 'general': general},
          open(os.path.join(TOOLS, 'tips-up-meta.json'), 'w'), ensure_ascii=False, indent=1)
print(f'按动作 {len(by_ex)} 个、共 {sum(map(len, by_ex.values()))} 条；通用知识 {len(general)} 条')
subprocess.run(['node', os.path.join(TOOLS, 'build-tips.js')], check=True)
