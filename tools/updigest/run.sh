#!/usr/bin/env bash
# 一轮更新：列新视频 → 下载并本机转文字（后台）→ 边下边让 MiniMax 看视频提炼 → 演示片段审计 → 干货精选 → 合并进 App 数据。
# 每一步都能中断后接着做，只处理新的；MiniMax 额度用完自动停，下次再运行接着做。
# 跑完以后还要人工复核新的演示片段（见 .claude/skills/up-digest/SKILL.md 第 4 步），复核完再跑一次 merge.py。
# 用法：bash tools/updigest/run.sh [UP 主名字 ...]      不写名字就把 ups.json 里的都刷新一遍
HERE="$(cd "$(dirname "$0")" && pwd)"; LIFE="$(cd "$HERE/../../.." && pwd)"
DATA="${UPDIGEST_DATA:-$LIFE/up-digest}"; ENV="${MINIMAX_ENV:-$LIFE/minimax.env}"; PY="${ASR_PY:-$DATA/asr-venv/bin/python}"
mkdir -p "$DATA"
[ -f "$ENV" ] || { echo "找不到 $ENV（里面写 MINIMAX_API_KEY=…）"; exit 1; }
if [ ! -x "$PY" ]; then
  echo "第一次运行：在 $DATA/asr-venv 装语音识别和下载工具（几分钟）"
  python3 -m venv "$DATA/asr-venv" && "$DATA/asr-venv/bin/pip" install -q --upgrade pip && "$DATA/asr-venv/bin/pip" install -q yt-dlp torch torchaudio funasr modelscope soundfile || exit 1
  PY="$DATA/asr-venv/bin/python"
fi
"$PY" -m pip install -q -U yt-dlp >/dev/null 2>&1   # B站 改接口时 yt-dlp 要跟着更新

echo "== 1. 列新视频"; python3 "$HERE/list_videos.py" "$DATA" "$@" || exit 1
echo "== 2. 下载、转文字（后台，日志 $DATA/fetch.log）"
"$PY" "$HERE/fetch.py" "$DATA" >> "$DATA/fetch.log" 2>&1 &
FETCH=$!
echo "== 3. 提炼（边下边做）"
while :; do
  python3 "$HERE/extract.py" "$DATA" "$ENV"; code=$?
  [ $code -eq 3 ] && { kill $FETCH 2>/dev/null; echo "额度用完，先停在这里；过几个小时再运行一次本脚本接着做"; exit 0; }
  kill -0 $FETCH 2>/dev/null || { python3 "$HERE/extract.py" "$DATA" "$ENV" || exit 0; break; }
  sleep 120
done
echo "== 4. 演示片段审计"; "$PY" "$HERE/audit.py" "$DATA" "$ENV" || exit 0
echo "== 5. 干货精选"; python3 "$HERE/curate.py" "$DATA" "$ENV" || exit 0
echo "== 6. 合并进 App 数据"; python3 "$HERE/merge.py" "$DATA"
echo
echo "还要做：人工复核新的演示片段"
echo "  python3 $HERE/review_sheets.py $DATA $(dirname "$PY")/yt-dlp     # 出截图 $DATA/review/sheet_*.jpg"
echo "  python3 $HERE/mark_review.py $DATA <不对的编号…>                 # 记下结果"
echo "  python3 $HERE/merge.py $DATA                                     # 再合并一次"
