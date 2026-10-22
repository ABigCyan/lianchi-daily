#!/usr/bin/env bash
# 一键：列视频 → 下载视频并本机转文字（后台）→ 边下边让 MiniMax 看视频提炼 → 演示片段审计 → 干货精选 → 合并进 App 数据（额度用完自动停）
# 合并后还要人工复核演示：python3 review_sheets.py 出截图，看完记进 tools/demo-review.json，再跑一次 merge.py
# 用法：bash tools/updigest/run.sh   （中断后再运行会接着做）
HERE="$(cd "$(dirname "$0")" && pwd)"; LIFE="$(cd "$HERE/../../.." && pwd)"
DATA="$LIFE/up-digest"; ENV="$LIFE/minimax.env"; PY="${ASR_PY:-$DATA/asr-venv/bin/python}"
mkdir -p "$DATA"
if [ ! -x "$PY" ]; then
  python3 -m venv "$DATA/asr-venv" && "$DATA/asr-venv/bin/pip" install -q --upgrade pip && "$DATA/asr-venv/bin/pip" install -q yt-dlp torch torchaudio funasr modelscope soundfile
  PY="$DATA/asr-venv/bin/python"
fi
[ -f "$DATA/videos.json" ] || python3 "$HERE/list_videos.py" "$DATA" || exit 1
"$PY" "$HERE/fetch.py" "$DATA" >> "$DATA/fetch.log" 2>&1 &
FETCH=$!
while :; do
  python3 "$HERE/extract.py" "$DATA" "$ENV"; code=$?
  [ $code -eq 3 ] && { kill $FETCH 2>/dev/null; break; }   # 额度用完
  kill -0 $FETCH 2>/dev/null || { python3 "$HERE/extract.py" "$DATA" "$ENV"; break; }  # 下载转写都完了，最后再扫一遍
  sleep 120
done
"$PY" "$HERE/audit.py" "$DATA" "$ENV" || exit 0
python3 "$HERE/curate.py" "$DATA" "$ENV" || exit 0
python3 "$HERE/merge.py" "$DATA"
