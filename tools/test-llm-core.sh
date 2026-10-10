#!/usr/bin/env bash
# 在电脑上编译并用真实模型测试内置模型核心（文字 + 看图）。
# 用法：bash tools/test-llm-core.sh 模型.gguf [mmproj.gguf 图片.jpg]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/tools/fetch-llama.sh"
B="${TMPDIR:-/tmp}/llm-core-test-build"
cmake -S "$ROOT/android/app/src/main/cpp/test" -B "$B" -DCMAKE_BUILD_TYPE=Release > /dev/null
cmake --build "$B" --target llm-core-test -j 8 > /dev/null
"$B/llm-core-test" "$@"
