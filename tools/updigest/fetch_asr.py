"""
第 2 步：下载音频（只要音频，不用登录）并在本机转成文字（SenseVoice，阿里开源，模型从 ModelScope 下载）。
可以随时中断，再运行会跳过已经做完的。音频转完就删，只留文字稿（不进仓库）。
用法：<装了 yt-dlp 和 funasr 的 python> fetch_asr.py <目录（里面有 videos.json）>
"""
import json, os, subprocess, sys, time
D = sys.argv[1]; A = os.path.join(D, 'audio'); T = os.path.join(D, 'text'); os.makedirs(A, exist_ok=True); os.makedirs(T, exist_ok=True)
vids = json.load(open(os.path.join(D, 'videos.json')))
todo = [v for v in vids if not os.path.exists(os.path.join(T, v['bv'] + '.txt'))]
print(f'共 {len(vids)} 个，还要处理 {len(todo)} 个', flush=True)
if not todo: sys.exit()
from funasr import AutoModel
from funasr.utils.postprocess_utils import rich_transcription_postprocess
model = AutoModel(model='iic/SenseVoiceSmall', vad_model='fsmn-vad', vad_kwargs={'max_single_segment_time': 30000}, device='cpu', disable_update=True, hub='ms')
ytdlp = os.path.join(os.path.dirname(sys.executable), 'yt-dlp')
for i, v in enumerate(todo, 1):
    bv, t0 = v['bv'], time.time()
    try:
        subprocess.run([ytdlp, '-q', '--no-warnings', '-f', 'ba', '-o', os.path.join(A, bv + '.%(ext)s'), 'https://www.bilibili.com/video/' + bv], check=True, timeout=1800)
        src = next(os.path.join(A, f) for f in os.listdir(A) if f.startswith(bv + '.') and not f.endswith('.wav'))
        wav = os.path.join(A, bv + '.wav')
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-ac', '1', '-ar', '16000', wav], check=True)
        res = model.generate(input=wav, language='zh', use_itn=True, batch_size_s=60, merge_vad=True, merge_length_s=20)
        text = '\n'.join(rich_transcription_postprocess(r['text']) for r in res)
        open(os.path.join(T, bv + '.txt'), 'w').write(text)
        for f in (src, wav): os.remove(f)
        print(f'[{i}/{len(todo)}] {bv} {v["up"]} {v["sec"] // 60} 分钟 → {len(text)} 字，用时 {time.time() - t0:.0f} 秒', flush=True)
    except Exception as e:
        print(f'[{i}/{len(todo)}] {bv} 失败：{e}', flush=True)
