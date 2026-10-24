# 开发与发布

界面设计见 [DESIGN.md](../DESIGN.md)，算法和每条规则的出处见 [ALGORITHM.md](../ALGORITHM.md)。

## 本地开发

```bash
npm ci
npm test                                # 算法测试（含 22 种资料组合）
python3 -m http.server 8766 --directory www   # 浏览器里预览
npx cap sync android                    # 把 www 同步到安卓工程
```

数据生成：

```bash
python3 tools/build-kb.py 套表.xlsx      # 从原表重新生成助手的知识库 www/js/data-kb.js
python3 tools/build-tables.py 套表.xlsx  # 从原表重新生成表16、表19 全表和拉伸图
python3 tools/fetch-ext-images.py        # 下载补充动作的图片（free-exercise-db），需要 Pillow
node tools/build-tips.js                 # 生成动作要点 www/js/data-tips.js
node scripts/screenshots.mjs             # 重新生成 README 里的截图（需要本机装了 Chrome）
```

## UP 主干货

B站 UP 主的讲解视频怎么提取、审核、合并进 App，见 [.claude/skills/up-digest/SKILL.md](../.claude/skills/up-digest/SKILL.md)。UP 主名单在 `tools/updigest/ups.json`，加新 UP 主照着里面的模板写一条就行。

## 发布

版本号规则：**年.月.第几版**（两位年份）。例如 26.10.1 是 2026 年 10 月的第 1 个版本；每次发布只加最后一位，换月份从 1 重新数，不用 -ai、-plus 这类后缀。

```bash
bash scripts/bump-version.sh      # 算出下一个版本号，写进 package.json 和 www/js/core.js
# 在 CHANGELOG.md 和 www/js/ui-guide.js 的 WHATS_NEW 里写这一版的说明，提交后：
git tag v26.10.1 && git push origin main v26.10.1
```

GitHub Actions 会自动编译签名的 APK，并发布到 Releases，发布说明取 CHANGELOG 里这一版那一节。签名密钥保存在仓库的 Secrets 里（`ANDROID_KEYSTORE_B64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`），每次都用同一把密钥签名，所以可以覆盖安装。
