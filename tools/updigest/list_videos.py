"""
第 1 步：列出 UP 主的全部投稿，只留讲动作、讲知识的视频（去掉 vlog、吃播、训练记录、放纵这类）。
不需要登录。用 B站 空间投稿接口（WBI 签名），失败时退回到“UP 主名 + 关键词”搜索。
输出 videos.json（每条：bv、UP 主、标题、时长、播放量）。
用法：python3 list_videos.py <输出目录>
"""
import hashlib, http.cookiejar, json, os, re, sys, time, urllib.parse, urllib.request
from functools import reduce

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
UPS = {  # UP 主 → B站 账号（mid）
    '好人松松': 2078781964,
    'Gandy': 378067652,
    '东哥': 1024129080,
    '谭成义': 521903482,
}
# 讲解、知识类标题里常见的词；以及要排除的生活类内容
KEEP = re.compile(r'教学|讲解|干货|动作|正确|错误|做错|保姆级|解析|知识|怎么|为什么|如何|技巧|细节|呼吸|发力|要点|新手|小白|入门|原理|科普|答疑|误区|计划|练胸|练背|练肩|练腿|练臀|手臂|腹肌|卧推|深蹲|硬拉|划船|下拉|引体|推举|平举|弯举|臂屈伸|飞鸟|夹胸|卷腹|举腿|臀冲|臀桥|减脂|增肌|饮食|热量|蛋白|私教')
DROP = re.compile(r'vlog|日常|放纵|吃播|开箱|挑战|比赛|备赛|第[一二三四五六七八九十\d]+天|训练记录|记录一下|旅行|搞笑|整活|直播|抽奖|带货|好物|测评|探店|辣评|健身房打几分', re.I)

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders = [('User-Agent', UA), ('Referer', 'https://www.bilibili.com/')]
op.open('https://www.bilibili.com/', timeout=20).read()

def get(url):
    return json.loads(op.open(url, timeout=20).read().decode('utf8', 'ignore'), strict=False)

# WBI 签名（B站 公开网页用的参数签名算法）
TAB = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
       61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52]
def mixin_key():
    d = get('https://api.bilibili.com/x/web-interface/nav')['data']['wbi_img']
    raw = d['img_url'].rsplit('/', 1)[1].split('.')[0] + d['sub_url'].rsplit('/', 1)[1].split('.')[0]
    return reduce(lambda s, i: s + raw[i], TAB, '')[:32]
def signed(url, params, key):
    params = dict(params, wts=int(time.time()))
    params = {k: re.sub(r"[!'()*]", '', str(v)) for k, v in sorted(params.items())}
    q = urllib.parse.urlencode(params)
    return f'{url}?{q}&w_rid={hashlib.md5((q + key).encode()).hexdigest()}'

def by_space(mid, key):
    out, pn = [], 1
    while True:
        d = get(signed('https://api.bilibili.com/x/space/wbi/arc/search', {'mid': mid, 'ps': 40, 'pn': pn, 'order': 'pubdate'}, key))
        if d.get('code') != 0: raise RuntimeError(f"空间接口返回 {d.get('code')} {d.get('message')}")
        vl = d['data']['list']['vlist']
        for v in vl:
            mm, ss = (v.get('length') or '0:0').split(':')[-2:]
            out.append({'bv': v['bvid'], 'title': v['title'], 'sec': int(mm) * 60 + int(ss), 'play': v.get('play') or 0})
        if len(vl) < 40 or pn >= 20: return out
        pn += 1; time.sleep(1.2)

def by_search(up, mid):
    out = {}
    for kw in ['', '教学', '讲解', '干货', '动作', '新手', '饮食', '训练', '胸', '背', '肩', '腿', '手臂', '腹', '卧推', '推胸', '夹胸', '飞鸟', '下拉', '引体', '划船', '推举', '侧平举', '弯举', '臂屈伸', '下压', '深蹲', '硬拉', '臀', '卷腹', '举腿', '平板支撑', '减脂', '增肌']:
        d = get('https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=' + urllib.parse.quote(f'{up} {kw}'.strip()))
        for v in (d.get('data') or {}).get('result', []) or []:
            if v.get('mid') != mid or v['bvid'] in out: continue
            mm, ss = (v.get('duration') or '0:0').split(':')[-2:]
            out[v['bvid']] = {'bv': v['bvid'], 'title': re.sub('<.*?>', '', v['title']), 'sec': int(mm) * 60 + int(ss), 'play': v.get('play') or 0}
        time.sleep(0.8)
    return list(out.values())

allv = []
try: key = mixin_key()
except Exception as e: key = None; print('拿不到 WBI 密钥，改用搜索：', e)
for up, mid in UPS.items():
    try: vids = by_space(mid, key) if key else by_search(up, mid)
    except Exception as e:
        print(up, '空间接口失败，改用搜索：', e); vids = by_search(up, mid)
    keep = [dict(v, up=up, mid=mid) for v in vids if (up == '好人松松' or KEEP.search(v['title'])) and not DROP.search(v['title']) and v['sec'] >= 40]
    print(f'{up}: 投稿 {len(vids)} 个，留下讲解/知识类 {len(keep)} 个，共 {sum(v["sec"] for v in keep) // 60} 分钟')
    allv += sorted(keep, key=lambda v: -v['play'])
    time.sleep(1.5)
os.makedirs(OUT, exist_ok=True)
json.dump(allv, open(os.path.join(OUT, 'videos.json'), 'w'), ensure_ascii=False, indent=1)
print('写入', os.path.join(OUT, 'videos.json'), len(allv), '个')
