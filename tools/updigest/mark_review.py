"""
记下人工复核结果：review_sheets.py 出的这一批总览图看完后，把不对的编号写进 bad，这一批其余的都算看过（seen）。
不对的包括：认错动作、器械不对、插入的别人素材、只在讲解没做动作、错误示范、看不清。
用法：python3 mark_review.py <目录> [不对的编号 ...]      例如：python3 mark_review.py ../up-digest 3 7 12
"""
import json, os, sys
D = sys.argv[1]; bad_n = sys.argv[2:]
idx = json.load(open(os.path.join(D, 'review', 'index.json')))
rp = os.path.join(os.path.dirname(__file__), '..', 'demo-review.json')
rv = json.load(open(rp)) if os.path.exists(rp) else {'note': '人工逐段看截图复核', 'bad': [], 'seen': []}
for n in bad_n:
    if n not in idx: sys.exit(f'没有编号 {n}')
bad = [idx[n] for n in bad_n]
rv['bad'] = sorted(set(rv.get('bad', [])) | set(bad))
rv['seen'] = sorted(set(rv.get('seen', [])) | set(idx.values()))
json.dump(rv, open(rp, 'w'), ensure_ascii=False, indent=1)
print(f'这一批 {len(idx)} 段：不要 {len(bad)} 段，其余 {len(idx) - len(bad)} 段记为看过。再跑 merge.py 更新 App 数据。')
