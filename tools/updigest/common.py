"""审计（audit.py）和精选（curate.py）共用：读 minimax.env、调 MiniMax、额度用完就停、App 的动作目录。"""
import json, os, re, subprocess, sys, threading, time, urllib.request, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def load_env(path):
    env = dict(re.findall(r'^\s*([A-Z_]+)\s*=\s*(.*?)\s*$', open(path).read(), re.M))
    if not env.get('MINIMAX_API_KEY'): sys.exit('minimax.env 里还没填 MINIMAX_API_KEY')
    return env['MINIMAX_API_KEY'], env.get('MINIMAX_BASE_URL', 'https://api.minimax.cn/v1').rstrip('/'), env.get('MINIMAX_MODEL', 'MiniMax-M3.1-Flash')

def catalog():
    """[(id, 名称, 肌群, 器械, 动作库图片目录, 图片是不是相近动作的示意)]"""
    out = subprocess.run(['node', '-e', """
const w={};w.window=w;const fs=require('fs'),vm=require('vm');const c=vm.createContext(w);
for (const f of ['data-training.js','data-training-ext.js']) vm.runInContext(fs.readFileSync('www/js/'+f,'utf8'),c);
const g={};for(const sp of Object.values(w.SPLITS))for(const d of sp.days)for(const gr of d.groups)for(const e of gr.entries)for(const v of (w.ENTRY[e]||[]))g[v]=g[v]||gr.name;
console.log(JSON.stringify(Object.values(w.EX).map(e=>[e.id,e.n,g[e.id]||(e.groups||[]).join('/'),e.eq,e.img,!!e.approx])));
"""], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)

QUOTA = {2056: '超出订阅资源限制（这个时段的额度用完了）', 2067: '套餐额度已用完', 1008: '余额不足', 2053: '积分不足'}
RATE = {1002, 2062, 2064, 2066}
class Stop(Exception): pass

class Client:
    def __init__(self, env_path):
        self.key, self.base, self.model = load_env(env_path)
        self.stop, self.lock = threading.Event(), threading.Lock()
        self.tok = {'in': 0, 'cached': 0, 'out': 0}

    def _post(self, body):
        req = urllib.request.Request(self.base + '/chat/completions', data=json.dumps(body).encode(),
                                     headers={'Authorization': 'Bearer ' + self.key, 'Content-Type': 'application/json'})
        try:
            return json.loads(urllib.request.urlopen(req, timeout=900).read())
        except urllib.error.HTTPError as e:
            txt = e.read().decode('utf8', 'ignore')
            try: d = json.loads(txt)
            except Exception: d = {'base_resp': {'status_code': e.code, 'status_msg': txt[:200]}}
            if e.code == 429: d.setdefault('base_resp', {})['status_code'] = 1002
            return d
        except Exception as e:
            return {'base_resp': {'status_code': 1002, 'status_msg': str(e)[:200]}}

    def ask_json(self, system, user, max_tokens=4000):
        """发一次请求，返回解析好的 JSON（对象或数组）；不是合法 JSON 就再要一次，还不行返回 None。额度用完抛 Stop。"""
        body = {'model': self.model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
                'max_completion_tokens': max_tokens, 'reasoning_effort': 'low', 'reasoning_split': True}
        for k in range(2):
            d = None
            for attempt in range(8):
                if self.stop.is_set(): raise Stop()
                d = self._post(body); code = (d.get('base_resp') or {}).get('status_code', 0)
                if code in QUOTA:
                    if not self.stop.is_set(): print(f'停止：{QUOTA[code]}（{code}）。已完成的都存好了，下次运行接着做。', flush=True)
                    self.stop.set(); raise Stop()
                if code in RATE: time.sleep(20 * (attempt + 1)); continue
                if code != 0: raise RuntimeError(f'{code} {(d.get("base_resp") or {}).get("status_msg")}')
                break
            else:
                raise RuntimeError('一直被限速')
            u = d.get('usage') or {}
            with self.lock:
                self.tok['in'] += u.get('prompt_tokens', 0); self.tok['cached'] += (u.get('prompt_tokens_details') or {}).get('cached_tokens', 0); self.tok['out'] += u.get('completion_tokens', 0)
            if not d.get('choices'): continue  # 偶尔返回空结果（比如内容审核拦了），再要一次
            content = d['choices'][0]['message'].get('content') or ''
            m = re.search(r'(\{.*\}|\[.*\])', content, re.S)
            try: return json.loads(m.group(0)) if m else None
            except Exception: continue
        return None

    def usage(self):
        return f'输入 {self.tok["in"]}（其中缓存 {self.tok["cached"]}），输出 {self.tok["out"]}'
