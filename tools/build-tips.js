// 生成每个动作的“动作要点”数据 www/js/data-tips.js 里套表部分（excel 字段），全部从原表文字里取：
//   - 关节活动和握法：表21-24 训练计划的 E/F 列（“[中握]肩内收mix肩伸 · 肘屈”），按每个肌群记录的原表行号对应到动作
//   - 练到的肌肉：表28《健身解剖总结》A 表（第17-28行：一个关节活动有哪些肌肉参与）
//   - 补充动作（data-training-ext.js 里标 excel28 的）：用它自己写的表28 行号说明
// 动作要点（cues）和 UP 主干货（up）是另外整理的，见 tools/tips-cues.json、tools/tips-up.json，这里一起合并输出。
// 用法：node tools/build-tips.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), JS = path.join(ROOT, 'www/js');
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data-kb.js', 'data-tables.js', 'data-rules.js', 'data-training.js', 'data-training-ext.js', 'data-splits-ext.js']) {
  if (fs.existsSync(path.join(JS, f))) vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx);
}
const KB = ctx.KB, EX = ctx.EX, ENTRY = ctx.ENTRY, SPLITS = ctx.SPLITS;
const row = (s, r) => KB.rows.find(x => x.s === String(s) && x.r === r);
const cells = t => Object.fromEntries(String(t || '').split(' ｜ ').map(c => { const i = c.indexOf(':'); return [c.slice(0, i), c.slice(i + 1).trim()]; }));

/* 表28 A 表：关节活动 → 参与肌肉（去掉注释用的数字角标） */
const MUSCLE = {}, PLAIN = {};
let joint = '';
for (let r = 17; r <= 28; r++) {
  const c = cells((row(28, r) || {}).t);
  if (c.B) joint = c.B.replace('关节', '');
  if (!c.C) continue;
  const act = joint + c.C.replace(/^足/, '');            // 肩屈、肩水平内收、肘伸、膝伸、髋伸、踝跖屈……
  // 去掉注释角标；“上胸中胸”“下胸中胸”是两块肌肉写在一格里
  MUSCLE[act] = ['F', 'G', 'H', 'I', 'J'].map(k => c[k]).filter(Boolean).map(m => m.replace(/\d+$/, '')).flatMap(m => m.match(/^(上胸|下胸)(中胸)$/) ? [m.slice(0, 2), '中胸'] : [m]);
  PLAIN[act] = c.D || '';
}
// 训练表里的写法和表28 的名字对齐
const ALIAS = { 踝跖屈: '踝跖屈', 足跖屈: '踝跖屈' };
const musclesOf = acts => [...new Set(acts.flatMap(a => MUSCLE[ALIAS[a] || a] || []))];

/* 表21-24：每个肌群从哪一行开始，第 i 个条目就是第 start+i 行 */
const out = {};
const take = (sheet, r, ids, groupName) => {
  const c = cells((row(sheet, r) || {}).t);
  const txt = [c.E, c.F].filter(Boolean);
  if (!txt.length) return;
  const grip = (txt.join(' ').match(/\[(.+?)\]/) || [])[1] || '';
  const acts = txt.join('mix').replace(/\[.+?\]/g, '').split(/mix|、/).map(s => s.trim()).filter(Boolean)
    .filter(a => !/借用/.test(a) || true).map(a => a.replace(/（借用.*?）/, ''));
  ids.forEach(id => {
    if (out[id]) return;  // 同一个动作在几张表里都有时，用第一次出现的（表21 优先）
    out[id] = { name: c.D || '', grip, joints: txt.map(t => t.replace(/（借用.*?）/, '')).join(' · '), acts,
      muscles: musclesOf(acts), plain: acts.map(a => PLAIN[a] ? `${a}：${PLAIN[a]}` : '').filter(Boolean), src: `表${sheet} 第${r}行`, group: groupName };
  });
};
for (const sp of Object.values(SPLITS)) {
  for (const day of sp.days) for (const g of day.groups) {
    const m = String(g.src || '').match(/D(\d+)-D(\d+)/); if (!m || !g.sheet) continue;
    const sheet = String(g.sheet).replace(/[^\d]/g, ''), start = +m[1];
    g.entries.forEach((e, i) => take(sheet, start + i, ENTRY[e] || [], g.name));
  }
}
/* 补充动作：用它自己写的依据（表28 举例的出处是套表；NSCA、同类变式、常见动作标成“应用补充”） */
for (const [id, e] of Object.entries(EX)) {
  if (out[id] || !e.basis) continue;
  out[id] = { name: e.n, joints: '', acts: [], muscles: [], plain: [], note: e.basis, kind: e.kind, kindName: e.kindName || '',
    src: e.kind === 'excel28' ? ((e.basis.match(/表28 第\d+行/) || ['表28'])[0]) : '' };
}

/* 合并整理好的动作要点和 UP 主干货 */
const read = f => fs.existsSync(path.join(__dirname, f)) ? JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')) : {};
const cues = read('tips-cues.json'), up = read('tips-up.json');
const tips = {};
for (const id of Object.keys(EX)) {
  const t = {};
  if (out[id]) t.excel = out[id];
  if (cues[id]) t.cues = cues[id];
  if (up[id] && up[id].up && up[id].up.length) t.up = up[id].up;
  if (up[id] && up[id].demos && up[id].demos.length) t.demos = up[id].demos;
  if (Object.keys(t).length) tips[id] = t;
}
const js = `/* 自动生成：node tools/build-tips.js —— 每个动作的要点。
 * excel：套表原文（表21-24 关节活动 → 表28 参与肌肉），带行号；
 * cues：动作做法和常见错误（应用补充，参考 free-exercise-db 公有领域说明和 NSCA 动作手册整理）；
 * up：B站 UP 主视频里的干货（自己的话转述，注明 UP 主、视频和时间点）；
 * demos：UP 主实际演示这个动作的片段（视频号和起止秒数，App 里用 B站 官方外链播放器从那一秒开始放，不转存视频）。 */
window.TIPS = ${JSON.stringify(tips)};
window.TIPS_UP = ${JSON.stringify(read('tips-up-meta.json'))};
`;
fs.writeFileSync(path.join(JS, 'data-tips.js'), js);
const n = k => Object.values(tips).filter(t => t[k]).length;
console.log(`动作 ${Object.keys(EX).length} 个：套表关节活动 ${n('excel')}，动作要点 ${n('cues')}，UP 主干货 ${n('up')}，UP 主演示 ${n('demos')}`);
