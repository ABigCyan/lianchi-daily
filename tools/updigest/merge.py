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
TOOLS = os.path.join(os.path.dirname(__file__), '..')
UPS = {u['name']: u['mid'] for u in json.load(open(os.path.join(os.path.dirname(__file__), 'ups.json')))['ups']}
PLAN = re.compile(r'\d+\s*组|每组|\d+\s*至\s*\d+\s*次|\d+-\d+\s*次')
slim = lambda x: {k: (html.unescape(x[k])[:40] if k == 'title' else x[k]) for k in ('up', 'bv', 'title', 'type', 'text', 't') if x.get(k) is not None}

def review():
    """人工复核结果 tools/demo-review.json：bad 是挑出来不要的，seen 是看过的，键是“动作|视频|开始秒”"""
    rp = os.path.join(TOOLS, 'demo-review.json')
    rv = json.load(open(rp)) if os.path.exists(rp) else {}
    return set(rv.get('bad', [])), set(rv.get('seen', []))

def merged_demos(D):
    """审计通过的片段，按 (动作, 视频) 把挨着的（间隔 ≤5 秒）合成一段，各小段的机位打成标签。返回 [{key, ex, up, bv, title, start, end, views, q}]"""
    clips = {}
    for f in glob.glob(os.path.join(D, 'audit', '*.json')):
        r = json.load(open(f))
        if not r.get('keep'): continue
        segs = r['segments'] or [{'start': r['start'], 'end': r['end'], 'view': '斜侧'}]
        clips.setdefault((r['keep'], r['bv']), []).append({'up': r['up'], 'bv': r['bv'], 'title': html.unescape(r['title'])[:40], 'q': r['quality'],
                                                            'start': min(s['start'] for s in segs), 'end': max(s['end'] for s in segs), 'segs': segs})
    out = []
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
            out.append({'key': f"{ex}|{m['bv']}|{m['start']}", 'ex': ex, 'up': m['up'], 'bv': m['bv'], 'title': m['title'], 'start': m['start'], 'end': m['end'], 'views': views, 'q': m['q']})
    return out

def main(D):
    out = {}
    for f in glob.glob(os.path.join(D, 'curate', '*.json')):
        c = json.load(open(f)); i = os.path.basename(f)[:-5]
        top = [slim(x) for x in c['top'] if not PLAN.search(x['text'])]
        more = [slim(x) for x in c['more'] if not PLAN.search(x['text'])]
        if top or more: out.setdefault(i, {})['up'] = {'top': top or more[:1], 'more': more if top else more[1:]}
    # 演示：只留人工看过、没挑出来的（宁可少放也不放没看过的）
    BAD, SEEN = review()
    demos, unseen = {}, 0
    for d in merged_demos(D):
        if d['key'] in BAD: continue
        if SEEN and d['key'] not in SEEN: unseen += 1; continue
        demos.setdefault(d['ex'], []).append({k: v for k, v in d.items() if k not in ('key', 'ex')})
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
    if unseen: print(f"还有 {unseen} 段审计通过、但没人工看过的演示没放进去：python3 review_sheets.py {D} <yt-dlp> 出截图，看完用 mark_review.py 记下")
    subprocess.run(['node', os.path.join(TOOLS, 'build-tips.js')], check=True)

if __name__ == '__main__':
    main(sys.argv[1])
