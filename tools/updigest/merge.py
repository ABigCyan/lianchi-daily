"""
第 4 步：合并进 App 数据。
- 干货：用 curate/ 里每个动作精选好的（top ≤3、more ≤5）；训练安排类（几组几次）不放进动作要点；
- 演示：只用 audit/ 里审计通过、并且人工复核过、没挑出来（tools/demo-review.json）的片段；同一个视频里挨着的几段（间隔 ≤5 秒）合成一段，各小段的机位打成标签（正面、侧面……）；
  每个动作按质量排，几位 UP 主轮流，最多 8 段（App 先显示 3 段，其余在“更多”里）；
- 通用知识（不针对某个动作的训练、饮食、恢复知识）写进 tips-up-meta.json，给助手搜。
写 tools/tips-up.json、tools/tips-up-meta.json，再运行 node tools/build-tips.js 生成 www/js/data-tips.js。
用法：python3 merge.py <目录>
"""
import glob, html, json, os, re, subprocess, sys
D = sys.argv[1]; TOOLS = os.path.join(os.path.dirname(__file__), '..')
UPS = {'好人松松': 2078781964, 'Gandy': 378067652, '东哥': 1024129080, '谭成义': 521903482}
PLAN = re.compile(r'\d+\s*组|每组|\d+\s*至\s*\d+\s*次|\d+-\d+\s*次')
slim = lambda x: {k: (html.unescape(x[k])[:40] if k == 'title' else x[k]) for k in ('up', 'bv', 'title', 'type', 'text', 't') if x.get(k) is not None}

out = {}
for f in glob.glob(os.path.join(D, 'curate', '*.json')):
    c = json.load(open(f)); i = os.path.basename(f)[:-5]
    top = [slim(x) for x in c['top'] if not PLAN.search(x['text'])]
    more = [slim(x) for x in c['more'] if not PLAN.search(x['text'])]
    if top or more: out.setdefault(i, {})['up'] = {'top': top or more[:1], 'more': more if top else more[1:]}

# 人工复核结果 tools/demo-review.json（review_sheets.py 出截图，人看过后记下）：bad 是挑出来不要的，seen 是看过的，键是“动作|视频|开始秒”
# 有 seen 时只留人工看过的（宁可少放也不放没看过的）
RP = os.path.join(TOOLS, 'demo-review.json')
REV = json.load(open(RP)) if os.path.exists(RP) else {}
BAD, SEEN = set(REV.get('bad', [])), set(REV.get('seen', []))

# 演示：审计通过的，按 (动作, 视频) 合并挨着的
clips = {}
for f in glob.glob(os.path.join(D, 'audit', '*.json')):
    r = json.load(open(f))
    if not r.get('keep'): continue
    segs = r['segments'] or [{'start': r['start'], 'end': r['end'], 'view': '斜侧'}]
    clips.setdefault((r['keep'], r['bv']), []).append({'up': r['up'], 'bv': r['bv'], 'title': html.unescape(r['title'])[:40], 'q': r['quality'],
                                                        'start': min(s['start'] for s in segs), 'end': max(s['end'] for s in segs), 'segs': segs})
demos = {}
for (ex, bv), lst in clips.items():
    lst.sort(key=lambda c: c['start']); merged = []
    for c in lst:
        if merged and c['start'] <= merged[-1]['end'] + 5:
            m = merged[-1]; m['end'] = max(m['end'], c['end']); m['segs'] += c['segs']; m['q'] = max(m['q'], c['q'])
        else: merged.append(dict(c))
    for m in merged:
        views = []
        for s in sorted(m['segs'], key=lambda s: s['start']):
            if views and views[-1]['v'] == s['view']: views[-1]['e'] = max(views[-1]['e'], s['end'])
            elif not any(v['v'] == s['view'] for v in views): views.append({'v': s['view'], 's': s['start'], 'e': s['end']})
        key = f"{ex}|{m['bv']}|{m['start']}"
        if key in BAD or (SEEN and key not in SEEN): continue
        demos.setdefault(ex, []).append({'up': m['up'], 'bv': m['bv'], 'title': m['title'], 'start': m['start'], 'end': m['end'], 'views': views, 'q': m['q']})
for ex, lst in demos.items():
    # 质量高、长度适中（5-30 秒）的在前；几位 UP 主轮流
    lst.sort(key=lambda d: (-d['q'], not 5 <= d['end'] - d['start'] <= 30))
    seen = {}
    for d in lst: seen[d['up']] = seen.get(d['up'], 0) + 1; d['_r'] = seen[d['up']]
    out.setdefault(ex, {})['demos'] = [{k: v for k, v in d.items() if k != '_r'} for d in sorted(lst, key=lambda d: (d['_r'], -d['q']))][:8]

general = []
for f in sorted(glob.glob(os.path.join(D, 'extract', '*.json'))):
    v = json.load(open(f))
    for x in v['items']:
        if not x.get('ex'): general.append(slim({**x, 'up': v['up'], 'bv': v['bv'], 'title': v['title']}) | {'type': x['type'], 'topic': (x.get('topic') or '')[:12]})
json.dump(out, open(os.path.join(TOOLS, 'tips-up.json'), 'w'), ensure_ascii=False, indent=1)
json.dump({'ups': {k: {'mid': m, 'url': f'https://space.bilibili.com/{m}'} for k, m in UPS.items()}, 'general': general},
          open(os.path.join(TOOLS, 'tips-up-meta.json'), 'w'), ensure_ascii=False, indent=1)
print(f"有干货的动作 {sum(1 for x in out.values() if x.get('up'))} 个，有演示的动作 {sum(1 for x in out.values() if x.get('demos'))} 个、共 {sum(len(x.get('demos', [])) for x in out.values())} 段；通用知识 {len(general)} 条")
subprocess.run(['node', os.path.join(TOOLS, 'build-tips.js')], check=True)
