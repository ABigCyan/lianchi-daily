"""
第 2 步：下载视频（360p，不用登录），在本机把声音转成带时间的文字稿（SenseVoice，阿里开源，模型从 ModelScope 下载），
画面压成 2 帧/秒、无声的小视频，留给第 3 步让 MiniMax 一起看（它能看视频但不能听声音，所以文字稿和画面都要给）。
- text/<bv>.txt：每行“[分:秒] 这一句话”，时间是这句话开始的地方
- video/<bv>.mp4：360p、2 帧/秒、无声；第 3 步提炼完就删
可以随时中断，再运行会跳过已经做完的。文字稿和视频都只留在本机，不进仓库。
用法：<装了 yt-dlp 和 funasr 的 python> fetch.py <目录（里面有 videos.json）>
"""
import json, os, subprocess, sys, time
D = sys.argv[1]
A, T, V = (os.path.join(D, x) for x in ('audio', 'text', 'video'))
for p in (A, T, V): os.makedirs(p, exist_ok=True)
X = os.path.join(D, 'extract')
vids = json.load(open(os.path.join(D, 'videos.json')))
done = lambda bv: os.path.exists(os.path.join(T, bv + '.txt')) and (os.path.exists(os.path.join(V, bv + '.mp4')) or os.path.exists(os.path.join(X, bv + '.json')))
todo = [v for v in vids if not done(v['bv'])]
print(f'共 {len(vids)} 个，还要处理 {len(todo)} 个', flush=True)
if not todo: sys.exit()
import numpy as np, soundfile as sf
from funasr import AutoModel
from funasr.utils.postprocess_utils import rich_transcription_postprocess
vad = AutoModel(model='fsmn-vad', max_single_segment_time=20000, device='cpu', disable_update=True, hub='ms')
import torch, re
asr = AutoModel(model='iic/SenseVoiceSmall', device='mps' if torch.backends.mps.is_available() else 'cpu', disable_update=True, hub='ms', disable_pbar=True)
EMOJI = re.compile(r'[\U0001F300-\U0001FAFF\u2600-\u27BF]')  # 识别结果里标背景音乐、笑声、情绪的符号
ytdlp = os.path.join(os.path.dirname(sys.executable), 'yt-dlp')
def mmss(ms): s = int(ms // 1000); return f'{s // 60}:{s % 60:02d}'

for i, v in enumerate(todo, 1):
    bv, t0 = v['bv'], time.time()
    url = 'https://www.bilibili.com/video/' + bv
    try:
        for f in os.listdir(A):
            if f.startswith(bv + '.'): os.remove(os.path.join(A, f))
        # 视频和声音分开下：画面要 360p 的 H.264，声音要最小的那条
        subprocess.run([ytdlp, '-q', '--no-warnings', '-f', 'bv*[height<=360][vcodec^=avc1]/bv*[height<=480]/wv', '-o', os.path.join(A, bv + '.v.%(ext)s'), url], check=True, timeout=3600)
        subprocess.run([ytdlp, '-q', '--no-warnings', '-f', 'wa/ba', '-o', os.path.join(A, bv + '.a.%(ext)s'), url], check=True, timeout=3600)
        src_v = next(os.path.join(A, f) for f in os.listdir(A) if f.startswith(bv + '.v.'))
        src_a = next(os.path.join(A, f) for f in os.listdir(A) if f.startswith(bv + '.a.'))
        wav = os.path.join(A, bv + '.wav')
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src_a, '-ac', '1', '-ar', '16000', wav], check=True)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src_v, '-vf', 'fps=2,scale=-2:360', '-c:v', 'libx264', '-preset', 'veryfast',
                        '-crf', '30', '-an', '-movflags', '+faststart', os.path.join(V, bv + '.mp4')], check=True)
        # 先切出说话的片段（带开始时间），按长短排好、8 段一批识别（长短差不多的放一批，少做无用功，快好几倍）
        audio, sr = sf.read(wav, dtype='float32')
        segs = vad.generate(input=wav, disable_pbar=True)[0]['value']
        order, text = sorted(range(len(segs)), key=lambda j: segs[j][1] - segs[j][0]), {}
        for k in range(0, len(order), 8):
            batch = order[k:k + 8]
            res = asr.generate(input=[audio[int(segs[j][0] * sr / 1000):int(segs[j][1] * sr / 1000)] for j in batch], language='zh', use_itn=True, batch_size=len(batch), disable_pbar=True)
            for j, r in zip(batch, res): text[j] = EMOJI.sub('', rich_transcription_postprocess(r['text'])).strip()
        lines = [f'[{mmss(segs[j][0])}] {text[j]}' for j in range(len(segs)) if text.get(j)]
        open(os.path.join(T, bv + '.txt'), 'w').write('\n'.join(lines))
        for f in (src_v, src_a, wav): os.remove(f)
        mb = os.path.getsize(os.path.join(V, bv + '.mp4')) / 1e6
        print(f'[{i}/{len(todo)}] {bv} {v["up"]} {v["sec"] // 60} 分钟 → {len(lines)} 句，视频 {mb:.1f} MB，用时 {time.time() - t0:.0f} 秒', flush=True)
    except Exception as e:
        print(f'[{i}/{len(todo)}] {bv} 失败：{e}', flush=True)
