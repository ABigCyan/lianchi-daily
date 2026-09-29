# 练吃日课

一个按 **《健身Excel超级套表》（B站好人松松）** 的规则，自动生成减脂/增肌饮食和训练计划，并每天按时间线提醒、打卡、记录的安卓 App。界面设计见 [DESIGN.md](DESIGN.md)。数据只保存在手机上，不需要联网（拍照识别、检查更新、更新节假日时才联网）。

算法和每条规则的出处见 [ALGORITHM.md](ALGORITHM.md)。

## 功能

- **按资料生成计划**：判断减脂还是增肌，计算热量、碳水、蛋白质、脂肪，按训练时间选对应的饮食表（表1-15），按经验、次数、地点选分化（表21-24），可以选想练的部位。
- **卡片式设计**：时间线和训练动作都是卡片，默认按规则生成，可以删除、添加、调整，选择只改今天或以后都这样。
- **今天**：摘要卡（完成度、摄入、消耗、缺口）+ 时间线卡片，完成就打勾；称重卡片里直接填体重。
- **训练**：选今天练哪天或自选部位；动作卡片有图片，可以换成原表同一肌群的备选动作、从动作库添加动作、调整组数；逐组记录重量和次数。
- **饮食**：拍照、相册导入、手动添加（表19 食物、自己填、文字让 AI 估），对比每餐和全天目标。
- **数据**：每日摄入与消耗对比、热量缺口分析（可让 AI 分析）、体重趋势、打卡日历、奖章。
- **基础代谢**：默认按公式，也可以手动输入。
- **导入导出**：导出为文件或复制，可选是否包含大模型接口信息。
- **节假日**：自动跳过法定节假日，调休补班日按工作日算。
- **大模型**：接入你自己的接口（通义千问、智谱、豆包、Kimi、OpenAI、Claude 等），自动扫描可用模型；内置按套表规则写的饮食识别提示词。
- **提醒**：安卓本地通知，按时间线提醒未来 7 天。
- **更新**：设置里“检查更新”读取本仓库的 GitHub Releases，覆盖安装，数据保留。

## 安装

到 [Releases](https://github.com/ABigCyan/lianchi-daily/releases) 下载：

- **安卓**：`lianchi-daily-x.y.z.apk`，在手机上打开安装（需要允许“安装未知来源应用”）。以后的新版本可以直接覆盖安装。

## 开发

```bash
npm ci
node test/engine.test.js          # 算法测试
python3 -m http.server 8766 --directory www   # 浏览器里预览
npx cap sync android               # 把 www 同步到安卓工程
```

发布新版本：改好代码并更新 `package.json` 的 `version` 和 `CHANGELOG.md`，然后

```bash
git tag v1.0.1 && git push origin v1.0.1
```

GitHub Actions 会自动编译签名的 APK 并发布到 Releases。签名密钥保存在仓库的 Secrets 里（`ANDROID_KEYSTORE_B64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`），每次都用同一把密钥签名，所以可以覆盖安装。

## 出处和授权

- 饮食和训练规则：《健身Excel超级套表》，作者 B站好人松松（文件名注明“可任意分享”）。本仓库只引用规则和数值并标注出处，不包含原表文件。
- 动作图片：[free-exercise-db](https://github.com/yuhonas/free-exercise-db)，Unlicense（公有领域）。
- 节假日数据：[holiday-cn](https://github.com/NateScarlet/holiday-cn)，整理自国务院办公厅通知。
- 打包框架：[Capacitor](https://capacitorjs.com)，MIT。
- 界面字体：[Inter](https://rsms.me/inter/)，SIL Open Font License 1.1。

本应用是个人学习工具，不能代替医生建议。
