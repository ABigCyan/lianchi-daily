// 用法：node test/ext.test.js —— 检查补充动作、补充分化、个性化设置（器械/伤病/重点/时长/智能模式）、定制分化和补充资料
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const ctx = { console };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data-tables.js', 'data-rules.js', 'data-training.js', 'data-training-ext.js', 'data-splits-ext.js', 'data-kb-ext.js', 'holidays.js', 'engine.js']) vm.runInContext(fs.readFileSync(__dirname + '/../www/js/' + f, 'utf8'), ctx);
const E = ctx.Engine, EX = ctx.EX, SPLITS = ctx.SPLITS, K = ctx.KB_EXT;
let checks = 0;
const ok = (c, msg) => { checks++; assert.ok(c, msg); };

const ALL = { chest: true, back: true, shoulder: true, arm: true, legs: true, abs: true };
const base = { sex: 'M', age: 25, height: 175, weight: 70, waist: 78, goal: 'auto', lift: true, level: 'some', place: 'gym', split: 'auto', focus: 'auto', parts: ALL, schedMode: 'weekly',
  liftDays: [0, 2, 4], skipHolidays: true, liftTime: '18:00', cardio: [], wake: '07:30', breakfast: '08:00', lunch: '12:00', dinner: '19:00', sleep: '23:30', startDate: '2026-09-28' };
const sessions = (p, pl) => pl.training.days.flatMap(d => [0, 1].flatMap(r => [1, 3, 8].map(week => E.sessionPlan(p, d, { week, legRound: r, chestRound: r, choices: {} }))));
const EQ = ctx.EQUIP.map(e => e[0]);

// 1. 动作数据：每个动作都有两张图；补充动作写了依据、肌群和需要的器械
Object.values(EX).forEach(ex => {
  [0, 1].forEach(f => ok(fs.existsSync(path.join(__dirname, '../www/img/ex', ex.img, f + '.jpg')), `${ex.n} 缺图 ${f}`));
  (ex.need || []).forEach(t => t.split('|').forEach(x => ok(EQ.includes(x), `${ex.n} 器械代号 ${x}`)));
});
const ext = Object.values(EX).filter(e => e.ext);
ok(ext.length >= 60, '补充动作数量');
ext.forEach(ex => {
  ok(ex.kindName && ex.basis && ex.groups.length, `${ex.n} 依据/肌群`);
  if (ex.kind === 'excel28') ok(/表28/.test(ex.basis), `${ex.n} 表28 出处`);
  if (ex.kind === 'nsca') ok(/NSCA/.test(ex.basis), `${ex.n} NSCA 出处`);
  ex.groups.forEach(g => ok(ctx.PARTS.some(pt => pt.groups.includes(g)), `${ex.n} 肌群 ${g} 没有对应部位`));
});

// 2. 套表分化不变：原表肌群里只有原表动作；不设器械/伤病时，自动排出的动作全是原表动作
['three', 'four_sh', 'four_arm', 'home'].forEach(k => SPLITS[k].days.forEach(d => d.groups.forEach(g => g.entries.forEach(e => ctx.ENTRY[e].forEach(v => ok(!EX[v].ext, `${k} 混入了补充动作 ${v}`))))));
[{}, { place: 'home' }, { level: 'new' }, { sex: 'F' }, { liftDays: [0, 1, 3, 4] }].forEach(over => {
  const p = { ...base, ...over }, pl = E.build(p);
  ok(!pl.training.ext, '默认用套表分化');
  sessions(p, pl).forEach(items => items.forEach(it => ok(!it.ex.ext, `默认计划排了补充动作 ${it.ex.n}`)));
});

// 3. 补充分化：每天都有动作；每个动作不超过 4 组；每次总组数不超过 30；每周胸背腿至少 9 组
const people = [{}, { sex: 'F' }, { level: 'new' }, { level: 'vet' }];
['full2', 'full3', 'ul4', 'five', 'home_full', 'home_ul'].forEach(k => people.forEach(over => {
  const sp = SPLITS[k], p = { ...base, ...over, split: k, place: sp.place, liftDays: [0, 1, 2, 3, 4, 5, 6].slice(0, sp.perWeek[0]) };
  const pl = E.build(p), tag = `【${sp.name} ${JSON.stringify(over)}】`;
  ok(pl.training.ext && pl.training.split.key === k, tag + '分化');
  ok(sp.refs.every(r => K.sources[r]), tag + '依据来源都在补充资料里');
  sessions(p, pl).forEach(items => {
    ok(items.length > 0, tag + '有动作');
    items.forEach(it => ok(it.sets >= 1 && it.sets <= 4, tag + it.ex.n + ' 组数 ' + it.sets));
    ok(items.filter(it => !it.optional).reduce((s, it) => s + it.sets, 0) <= 30, tag + '每次组数');
  });
  ['chest', 'back', 'legs'].forEach(pt => ok(pl.volume[pt].sets >= 9, `${tag}${pt} 每周 ${pl.volume[pt].sets} 组`));
  ['chest', 'back', 'legs', 'shoulder'].forEach(pt => ok(pl.volume[pt].freq >= (sp.perWeek[0] >= 2 && k !== 'five' ? 2 : 1), `${tag}${pt} 每周 ${pl.volume[pt].freq} 次`));
}));

// 4. 器械筛选：排出来的动作都用得上你有的器械；伤病：不排要避开的动作
const combos = [['db', 'bench'], ['db', 'band', 'bar'], ['machine', 'cable'], ['bb', 'bench'], ['band']];
const joints = [['knee'], ['lowback'], ['shoulder', 'elbow'], ['wrist']];
combos.forEach(equip => joints.forEach(avoid => ['three', 'four_sh', 'home', 'full3', 'ul4'].forEach(split => {
  const p = { ...base, split, equip, avoid }, pl = E.build(p);
  sessions(p, pl).forEach(items => items.forEach(it => {
    ok(ctx.exUsable(it.ex, equip, avoid), `器械 ${equip} 伤病 ${avoid}：排了 ${it.ex.n}`);
    it.alts.concat(it.extAlts).forEach(v => ok(ctx.exUsable(EX[v], equip, avoid), `备选里有不能做的 ${EX[v].n}`));
  }));
})));
// 只有弹力带 + 膝伤：练不了的肌群跳过，不硬排
{
  const p = { ...base, equip: ['band'], avoid: ['knee'], liftDays: [0, 2, 4] }, pl = E.build(p);
  const leg = pl.training.days.find(d => d.groups.some(g => g.id === 'quad'));
  const s = E.sessionPlan(p, leg, { week: 8, legRound: 0, choices: {} });
  ok(s.skipped.includes('股四头肌'), '弹力带 + 膝伤：股四头肌跳过');
}

// 5. 重点部位：排在最前面，组数取上限（新手前 4 周也一样）
{
  const p = { ...base, level: 'new', focusParts: ['shoulder'] }, pl = E.build(p);
  const d = pl.training.days.find(x => x.groups.some(g => g.id === 'side'));
  const s = E.sessionPlan(p, d, { week: 1, choices: {} }).filter(it => !it.optional);
  ok(['front', 'side', 'rear'].includes(s[0].group.id), '重点部位排第一');
  const side = d.groups.find(g => g.id === 'side');
  ok(s.filter(it => it.group.id === 'side').reduce((a, it) => a + it.sets, 0) === side.sets[1], '重点部位组数取上限');
}

// 6. 每次时长：压缩后不超时（或每个动作已经只剩 2 组）
[30, 45, 60, 75].forEach(cap => ['three', 'four_arm', 'full2', 'five'].forEach(split => {
  const p = { ...base, split, sessionMin: cap }, pl = E.build(p);
  sessions(p, pl).forEach(items => {
    const req = items.filter(it => !it.optional);
    ok(E.estMinutes(req) <= cap || req.length === 1, `${split} ${cap} 分钟：估算 ${E.estMinutes(req)}`);
    ok(req.every(it => it.sets >= 1), '压缩后每个动作至少 1 组');
  });
}));
// 套表三分化不限时，一次约 1-1.5 小时（表21 C10）
{
  const p = { ...base }, pl = E.build(p);
  pl.training.days.forEach(d => { const m = E.estMinutes(E.sessionPlan(p, d, { week: 8, legRound: 0, choices: {} }).filter(it => !it.optional)); ok(m >= 45 && m <= 95, '三分化时长 ' + m); });
}

// 7. 智能模式：只在每周 1-2 次时换全身训练，其他情况和套表一样
ok(E.build({ ...base, planMode: 'smart', liftDays: [1, 4] }).training.split.key === 'full2', '智能 2 次 → 全身两练');
ok(E.build({ ...base, planMode: 'smart', place: 'home', liftDays: [3] }).training.split.key === 'home_full', '智能居家 1 次 → 居家全身');
[[0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4, 5]].forEach(days => ['new', 'some'].forEach(level => ['gym', 'home'].forEach(place => {
  const a = E.build({ ...base, liftDays: days, level, place }), b = E.build({ ...base, liftDays: days, level, place, planMode: 'smart' });
  ok(a.training.split.key === b.training.split.key, `智能模式 ${days.length} 次 ${level} ${place} 应和套表一样`);
})));
// 手动选的分化优先
ok(E.build({ ...base, planMode: 'smart', liftDays: [1, 4], split: 'three' }).training.split.key === 'three', '手动选择优先');

// 8. 定制分化：校验 + 生效
{
  const good = { name: '上下肢', days: [{ name: '上', groups: [{ tpl: 'gym:mid_chest', sets: [4, 5], pick: [1, 2] }, { tpl: 'gym:row', sets: 4 }] }, { name: '下', groups: [{ tpl: 'gym:quad', sets: [3, 4] }, { tpl: 'gym:calf', sets: 3 }] }] };
  const c = ctx.customSplit(good);
  ok(!c.errs.length && c.split.days.length === 2, '定制分化通过');
  const pl = E.build({ ...base, split: 'mine', customSplit: good });
  ok(pl.training.split.key === 'mine' && pl.training.days.map(d => d.name).join() === '上,下', '定制分化生效');
  ok(pl.warnings.some(w => w.app), '定制分化低于约 10 组的部位有提醒');
  ok(ctx.customSplit({ days: [] }).errs.length, '没有天');
  ok(ctx.customSplit({ days: [{ groups: [{ tpl: 'gym:nope', sets: 3 }] }] }).errs.length, '模板不存在');
  ok(ctx.customSplit({ days: [{ groups: [{ tpl: 'gym:quad', sets: [5, 20] }] }] }).errs.length, '组数太多');
  ok(ctx.customSplit({ days: [{ groups: Array(8).fill({ tpl: 'gym:quad', sets: 5 }) }] }).errs.length, '一天总组数太多');
  ok(E.build({ ...base, split: 'mine' }).training.split.key === 'three', '没有定制内容时按套表');
}

// 9. 补充资料：编号唯一、来源都存在、写了和套表的关系
{
  const ids = new Set();
  K.rows.forEach(r => {
    ok(!ids.has(r.id), '重复编号 ' + r.id); ids.add(r.id);
    ok(['一致', '补充', '有差异', '说明'].includes(r.rel), r.id + ' 关系');
    ok(r.excel && r.t.length > 20 && r.topic, r.id + ' 内容');
    r.refs.forEach(k => ok(K.sources[k], `${r.id} 来源 ${k} 不存在`));
  });
  Object.entries(K.sources).forEach(([k, s]) => ok(s.cite && s.short && s.kind, k + ' 来源信息'));
}

console.log(`补充：${ext.length} 个补充动作，${Object.keys(SPLITS).filter(k => SPLITS[k].ext).length} 个补充分化，${K.rows.length} 条补充资料（${Object.keys(K.sources).length} 个来源），${checks} 项检查全部通过`);
