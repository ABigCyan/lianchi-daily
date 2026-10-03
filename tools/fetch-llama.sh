#!/usr/bin/env bash
# 下载固定版本的 llama.cpp 源码到安卓工程里（CI 和本地编译都用这个）
set -euo pipefail
TAG="${LLAMA_TAG:-b11247}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/android/app/src/main/cpp/llama.cpp"
if [ -f "$DEST/.tag" ] && [ "$(cat "$DEST/.tag")" = "$TAG" ]; then echo "llama.cpp $TAG 已存在"; exit 0; fi
rm -rf "$DEST" && mkdir -p "$DEST"
curl -sL --retry 5 --connect-timeout 30 "https://github.com/ggml-org/llama.cpp/archive/refs/tags/$TAG.tar.gz" | tar xz --strip-components=1 -C "$DEST"
echo "$TAG" > "$DEST/.tag"
echo "llama.cpp $TAG → $DEST"
