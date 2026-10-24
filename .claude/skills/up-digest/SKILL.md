---
name: up-digest
description: 从 B站 健身 UP 主的视频里提取干货（动作要点、常见错误、训练和饮食知识）和动作演示片段，审核后合并进“练好吃对”App 的动作要点和助手资料。用户说“UP 主更新了”“再整理一轮”“加一个新 UP 主”“补演示”“补动作库里没有的动作”，或要核对某段演示对不对时使用。
---

# UP 主干货提取（练好吃对）

工具都在 `tools/updigest/`，中间数据放在仓库外的 `../up-digest/`（文字稿、视频、提炼结果，不进仓库），MiniMax Key 在 `../minimax.env`（只写 `MINIMAX_API_KEY=…`，不要打印、不要提交）。

## 质量原则（用户定的，必须遵守）

- **简洁、宁缺毋滥。** 每个动作的“要点”只放 2 条 UP 主提醒，演示先放 3 段，其余收进“更多”。宁可少放也不放错。
- **演示必须是 UP 主本人或他请来的真人，在真实器械上做这个动作，而且是这种器械。** 名字像、字幕像都不算。不要：
  - 白板、幻灯片、解剖图、动画；
  - 屏幕主要是训练单；
  - 只在说话、没做动作；
  - 插入的别人的素材（外国博主、女生示范、比赛合集）；
  - 错误示范、看不清的。
- **MiniMax 的看图判断不可靠**（会把蹲类器械认成推举、分不清直腿硬拉和罗马尼亚硬拉）。演示上线前**必须人工看截图复核**，由你（Claude）用 Read 看总览图来判断。
- 干货是转述，不是原话。和套表不同时以套表为准。

## 加一个新 UP 主

1. 在 B站 找到他的空间页 `space.bilibili.com/<mid>`，记下 mid。
2. 编辑 `tools/updigest/ups.json`，照 `_模板` 在 `ups` 里加一条：
   - `keep_all`：投稿全是讲解课就填 true；
   - `slides`：主要是幻灯片讲课就填 true，看画面时省额度；
   - `keywords`：空间接口被风控时，搜索用的额外关键词；
   - `drop`：这位 UP 要额外排除的标题关键词（正则）；
   - `note`：风格和要小心的地方，复核时看。
3. 跑一轮：`bash tools/updigest/run.sh <新UP名字>`（只处理他）。

## 一轮更新（UP 主发了新视频）

```bash
bash tools/updigest/run.sh            # 全部 UP；或在后面写名字只刷新几位
```

依次做六步，每一步只处理新的，中断后再跑会接着做：

1. **列新视频**：`list_videos.py`，增量写进 `videos.json`。B站 空间接口常被风控（412/-352），会自动改用搜索，可能漏几个；漏了可以把 BV 号手动加进 `videos.json`。
2. **下载 360p 视频，本机转成带时间的文字稿**：`fetch.py`，用 SenseVoice。
3. **MiniMax 同时看文字稿和画面，提炼干货、标出演示片段**：`extract.py`。
4. **演示审计**：`audit.py`。盲认两次（视频一次、逐秒拼图一次），都和原来标的动作一致才留。
5. **干货精选**：`curate.py`。每个动作只留讲这个动作、这种器械的；候选变了才重做。
6. **合并**：`merge.py`，生成 `tools/tips-up.json` 和 `www/js/data-tips.js`。

MiniMax 额度用完时，脚本会自动停（错误码 2056 或 2067），过几个小时再运行一次就接着做。脚本最后会打印用量。

## 第 4 步之后：人工复核演示（必须做）

```bash
python3 tools/updigest/review_sheets.py ../up-digest ../up-digest/asr-venv/bin/yt-dlp
```

只给还没看过的片段出图：`../up-digest/review/sheet_XX.jpg`，每段 4 帧，标了编号、动作、UP 主、时间、机位。

1. 用 Read 一张张看，按上面的质量原则挑出不对的编号。
2. 拿不准的，用 bili-watch MCP 的 `bili_frames` 多截几帧再看。
3. 记下结果：`python3 tools/updigest/mark_review.py ../up-digest <不对的编号…>`。这一批其余的都会记为看过，存在 `tools/demo-review.json`。
4. `python3 tools/updigest/merge.py ../up-digest`。合并只放看过、又没挑出来的片段。

## 视频里有、动作库里没有的动作

1. 在 free-exercise-db 找对应动作（`exercises.json` 的 id 就是图片目录名）。
2. 在 `www/js/data-training-ext.js` 的 `raw` 里加一行：名称、图片 id、器械、依据，挂到合适的肌群。肌群不够用时，在 `NEW_GROUPS` 加。
3. `python3 tools/fetch-ext-images.py` 下载图片，看一眼图对不对；不对就在 `approx` 里标成“相近动作示意”。
4. 在 `tools/tips-cues.json` 写“准备 / 动作 / 注意”三句。
5. 把 `../up-digest/extract/*.json` 里 `ex` 为空、`topic` 是这个动作的条目和片段改成新 id；删掉对应的 `audit/<BV>_<秒>.json`；重跑第 4-6 步和人工复核。

## 收尾

- `npm test` 要全部通过。
- 用 preview 打开 App，看几个动作的“要点”面板，点演示能不能播。
- 用户说发布才发布：先 `bash scripts/bump-version.sh`，再写 CHANGELOG 和 `ui-guide.js` 的 WHATS_NEW。发布前用子 agent 做一遍审查。

## 资料都在哪

| 内容 | 位置 | App 里谁用 |
|---|---|---|
| 每个动作的 UP 主提醒和演示 | `tools/tips-up.json` → `www/js/data-tips.js`（`TIPS`） | “要点”面板；助手的 `exercise_info`、`search_up_tips` |
| 不针对动作的理论（训练安排、饮食、恢复） | `tools/tips-up-meta.json` → `TIPS_UP.general` | 只有助手能搜到（`search_up_tips`、`search_all`）；**还没审过，也没和套表对照** |
| 文字稿、提炼原始结果、审计记录 | `../up-digest/text`、`extract`、`audit` | 不进仓库 |
| UP 主名单 | `tools/updigest/ups.json` | 所有脚本 |
| 人工复核记录 | `tools/demo-review.json` | `merge.py` |

## 常见问题

- **B站 下载超时**：重跑就行，已完成的会跳过。
- **yt-dlp 报格式不可用**：`run.sh` 每次都会更新 yt-dlp；格式写法是 `bv*[height<=360][vcodec^=avc1]/bv*[height<=480]/wv`。
- **SenseVoice 慢**：确认用了 MPS，并且按长度排序、8 段一批识别（`fetch.py` 已这样做）。
- **不要用用户的 B站 登录 Cookie。**
