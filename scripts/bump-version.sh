#!/usr/bin/env bash
# 版本号规则：年.月.第几版（两位年份，不补零），例如 26.10.1 = 2026 年 10 月的第 1 个版本。
# - 每次发布（新功能或修 bug）都只加最后一位；换月份从 1 重新数；
# - 不再用 -ai、-plus 这类后缀和预览版；
# - 安卓的 versionCode 用 GitHub Actions 的运行序号，一直递增，可以覆盖安装。
# 用法：bash scripts/bump-version.sh   → 算出下一个版本号，写进 package.json 和 www/js/core.js，并打印出来
set -e
cd "$(dirname "$0")/.."
git fetch --tags -q 2>/dev/null || true   # 按远端已有的 tag 算
YM="$(date +%y).$(date +%-m)"
N=$(git tag -l "v$YM.*" | sed "s/^v$YM\.//" | grep -E '^[0-9]+$' | sort -n | tail -1)
V="$YM.$(( ${N:-0} + 1 ))"
node -e "const f='package.json',p=require('./'+f);p.version='$V';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
sed -i.bak -E "s/const APP_VERSION = '[^']+'/const APP_VERSION = '$V'/" www/js/core.js && rm -f www/js/core.js.bak
grep -q "^## $V\$" CHANGELOG.md || echo "提醒：CHANGELOG.md 里还没有“## $V”这一节" >&2
echo "$V"
