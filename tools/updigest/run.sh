#!/usr/bin/env bash
# 一键：列视频 → 下载音频并本机转文字 → MiniMax 提炼（额度用完自动停）→ 合并进 App 数据
# 用法：bash tools/updigest/run.sh   （中断后再运行会接着做）
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; LIFE="$(cd "$HERE/../../.." && pwd)"
DATA="$LIFE/up-digest"; ENV="$LIFE/minimax.env"; PY="${ASR_PY:-$DATA/asr-venv/bin/python}"
mkdir -p "$DATA"
if [ ! -x "$PY" ]; then
  python3 -m venv "$DATA/asr-venv" && "$DATA/asr-venv/bin/pip" install -q --upgrade pip && "$DATA/asr-venv/bin/pip" install -q yt-dlp torch torchaudio funasr modelscope
  PY="$DATA/asr-venv/bin/python"
fi
[ -f "$DATA/videos.json" ] || python3 "$HERE/list_videos.py" "$DATA"
"$PY" "$HERE/fetch_asr.py" "$DATA"
python3 "$HERE/extract.py" "$DATA" "$ENV"
python3 "$HERE/merge.py" "$DATA"
