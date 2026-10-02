// 用法：node test/engine.test.js —— 用几组典型资料检查算法输出
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const ctx = { window: {}, console };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data-tables.js', 'data-rules.js', 'data-training.js', 'data-training-ext.js', 'data-splits-ext.js', 'holidays.js', 'engine.js']) vm.runInContext(fs.readFileSync(__dirname + '/../www/js/' + f, 'utf8'), ctx);
const E = ctx.Engine;
const base = { sex: 'M', age: 24, height: 172, weight: 80, waist: 80, goal: 'auto', lift: true, level: 'new', place: 'gym', split: 'auto',
  parts: { chest: true, back: true, shoulder: true, arm: true, legs: false, abs: true }, schedMode: 'weekly', liftDays: [0, 2, 4], skipHolidays: true,
  liftTime: '17:15', cardio: [{ kind: '跑步', pace: 8, minutes: 60, days: [1, 3, 5] }], cardioTime: '18:00',
  wake: '08:15', breakfast: '08:40', lunch: '12:00', dinner: '19:00', sleep: '00:00', eggsMilk: true, budget: true, lunchCost: 30, startDate: '2026-09-28' };
const p = E.build(base);
console.log('目标', p.goal, p.goalWhy.reason, '|', p.goalWhy.src);
console.log('热量', { bmr: p.bmr, b: p.b, c: p.c, d: p.d, f1: p.f1, f2: p.f2 }, '宏量', { fat: p.fat, prot: p.prot, carbT: p.carbT, carbR: p.carbR });
console.log('饮食表', p.sheet);
console.log('力训日分餐', p.meals.lift.map(m => `${m.time} ${m.name} c${m.c} p${m.p}`).join(' | '));
console.log('休息日分餐', p.meals.rest.map(m => `${m.time} ${m.name} c${m.c} p${m.p}`).join(' | '));
console.log('分化', p.training.splitName, p.training.split.why, p.training.days.map(d => d.name + ':' + d.groups.map(g => g.id).join(',')).join(' / '));
assert.strictEqual(p.goal, 'cut'); assert.strictEqual(p.bmr, 1761); assert.strictEqual(p.b, 2516); assert.strictEqual(p.c, 150);
assert.strictEqual(p.sheet.sheet, '表5');
const sumC = m => m.reduce((s, x) => s + x.c, 0), sumP = m => m.reduce((s, x) => s + x.p, 0);
assert.strictEqual(sumC(p.meals.lift), p.carbT); assert.strictEqual(sumP(p.meals.lift), p.prot);
assert.strictEqual(sumC(p.meals.rest), p.carbR); assert.strictEqual(sumP(p.meals.rest), p.prot);
const day = p.training.days[0];
const s = E.sessionPlan(base, day, { week: 1, legRound: 0, chestRound: 0, choices: {} });
console.log('Day1 第1周', s.map(x => `${x.ex.n} ${x.sets}×${x.reps} [${x.group.src}] 备选${x.alts.length}`).join('\n  '));
const s2 = E.sessionPlan(base, p.training.days[1], { week: 6, legRound: 0, chestRound: 1, choices: {} });
console.log('Day2 第6周', s2.map(x => `${x.ex.n} ${x.sets}×${x.reps}${x.optional ? '(可选)' : ''}`).join(' | '));
// 节假日：国庆 10/1(周四) 放假、10/10(周六) 补班
assert.strictEqual(E.plannedLift(base, '2026-10-02', {}), false);
assert.strictEqual(E.plannedLift({ ...base, schedMode: 'workdays' }, '2026-10-10', {}), true);
assert.strictEqual(E.plannedLift(base, '2026-10-12', {}), true);
// 各种训练时间 → 饮食表
const sheetFor = t => E.build({ ...base, liftTime: t }).sheet;
for (const t of ['09:00', '07:00', '10:30', '13:00', '17:15', '19:30', '21:30']) { const sh = sheetFor(t); console.log(t, '→', sh.sheet, sh.name); }
// 增肌女性、居家、四分化
const f = E.build({ ...base, sex: 'F', age: 28, height: 162, weight: 50, waist: 66, level: 'some', place: 'home', liftDays: [0, 1, 3, 4], parts: { chest: true, back: true, shoulder: true, arm: true, legs: true, abs: true }, cardio: [], budget: false });
console.log('女增肌', f.goal, f.goalWhy.reason, f.f1, f.f2, f.fat, f.prot, f.carbT, f.carbR, f.training.splitName, f.sheet.sheet);
assert.strictEqual(f.goal, 'bulk'); assert.strictEqual(f.fat, 70); assert.strictEqual(f.sheet.sheet, '表13');
const g4 = E.build({ ...base, level: 'some', liftDays: [0, 1, 3, 4], parts: { chest: true, back: true, shoulder: true, arm: true, legs: true, abs: true }, focus: 'arm' });
console.log('有基础四分化', g4.training.splitName, g4.training.days.map(d => d.name).join(' / '));
const nl = E.build({ ...base, lift: false });
console.log('无力训', nl.sheet, nl.f1, nl.carbT, nl.prot);
assert.strictEqual(nl.c, 0);
console.log('\n全部断言通过');
