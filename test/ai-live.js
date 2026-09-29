// 用真实接口测试拍照识别：node test/ai-live.js [env 文件路径，默认 ../ai-test.env]
// 直接加载 App 里的 www/js/ai.js，走和手机上一样的请求代码；不会打印 API Key。
const fs = require('fs'), path = require('path'), vm = require('vm');
const envPath = path.resolve(process.argv[2] || path.join(__dirname, '../../ai-test.env'));
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});
for (const k of ['AI_MODEL', 'TEST_IMAGE', 'TEST_TEXT', 'TEST_WEEK']) if (process.env[k]) env[k] = process.env[k];
const ctx = { console, fetch, URL, setTimeout, clearTimeout, AbortController };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data-tables.js', 'data-rules.js', 'ai.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../www/js', f), 'utf8'), ctx);
const AI = ctx.AI;
if (process.env.AI_DEBUG) ctx.__AI_DEBUG = c => console.log('--- 原始返回 ---\n' + String(c).slice(0, 1500) + '\n---');
const mask = s => s ? s.slice(0, 3) + '…' + s.slice(-2) + `（${s.length} 位）` : '（空）';

(async () => {
  const preset = AI.PRESETS.find(p => p.id === (env.AI_PROVIDER || 'dashscope'));
  if (!preset) throw new Error('AI_PROVIDER 不认识：' + env.AI_PROVIDER);
  const cfg = { preset: preset.id, type: preset.type, base: env.AI_BASE_URL || preset.base, key: env.AI_API_KEY, model: env.AI_MODEL };
  console.log(`服务商：${preset.name}\n接口：${cfg.base}\nKey：${mask(cfg.key)}`);
  if (!cfg.key) throw new Error('AI_API_KEY 没填');

  console.log('\n[1] 扫描模型…');
  let models = [];
  try {
    models = await AI.listModels(cfg);
    console.log(`找到 ${models.length} 个模型，其中疑似支持看图 ${models.filter(m => m.vision).length} 个：`);
    console.log('  ' + models.filter(m => m.vision).slice(0, 25).map(m => m.id).join('、'));
  } catch (e) { console.log('扫描失败：' + e.message); }
  if (!cfg.model) cfg.model = AI.defaultModel(cfg, models);
  console.log('使用模型：' + (cfg.model || '（没有可用模型）'));

  if (env.TEST_TEXT) {
    console.log(`\n[文字估算] ${env.TEST_TEXT}`);
    const r = await AI.analyze(cfg, null, { meal: '午饭', goal: 'cut', target: { c: 88, p: 65 }, text: env.TEST_TEXT });
    r.items.forEach(it => console.log(`  ${it.name}  ${it.grams}g  碳水${it.carbs_g} 蛋白${it.protein_g} 脂肪${it.fat_g}  ${it.kcal}kcal  [${it.category}]`));
    console.log(`合计 ${r.total.kcal} kcal；建议：${r.advice}`);
  }
  if (env.TEST_WEEK) {
    console.log('\n[热量分析]');
    const txt = await AI.analyzeWeek(cfg, { 目标: '减脂', 天数: 7, 平均摄入kcal: 1699, 平均消耗kcal: 2516, 应吃kcal: 1805, 平均蛋白质g: 103, 蛋白质目标g: 120, 平均碳水g: 180, 碳水目标g: 204, 平均缺口kcal: 817, 最近体重: [{ 日期: '09-21', 体重kg: 79.2 }, { 日期: '09-27', 体重kg: 78.4 }] });
    console.log(txt);
  }
  if (!env.TEST_IMAGE) { console.log('\n没填 TEST_IMAGE，跳过识图测试。'); return; }
  const img = fs.readFileSync(env.TEST_IMAGE);
  const mime = /\.png$/i.test(env.TEST_IMAGE) ? 'image/png' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${img.toString('base64')}`;
  console.log(`\n[2] 识别照片 ${path.basename(env.TEST_IMAGE)}（${Math.round(img.length / 1024)} KB）…`);
  const t0 = Date.now();
  const r = await AI.analyze(cfg, dataUrl, { meal: '午饭', goal: 'cut', target: { c: 88, p: 65 }, eaten: { c: 33, p: 28 }, day: { c: 216, p: 120 } });
  console.log(`用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒，把握度 ${Math.round(r.confidence * 100)}%`);
  r.items.forEach(it => console.log(`  ${it.name}  ${it.grams}g  碳水${it.carbs_g} 蛋白${it.protein_g} 脂肪${it.fat_g}  ${it.kcal}kcal  [${it.category}] ${it.note}`));
  console.log(`合计：碳水 ${r.total.carbs_g}g，蛋白质 ${r.total.protein_g}g，脂肪 ${r.total.fat_g}g，${r.total.kcal} kcal`);
  if (r.flags.length) console.log('提醒：' + r.flags.join('；'));
  console.log('建议：' + r.advice);
})().catch(e => { console.error('\n测试失败：' + e.message); process.exit(1); });
