// 用法：node test/profiles.test.js —— 用很多种不同的身高、体重、性别、年龄、目标、经验、场地、训练日、部位组合跑一遍算法，
// 逐条对照套表的规则检查结果，最后打印一张汇总表。
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const ctx = { console };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data-rules.js', 'data-training.js', 'holidays.js', 'engine.js']) vm.runInContext(fs.readFileSync(__dirname + '/../www/js/' + f, 'utf8'), ctx);
const E = ctx.Engine, R = ctx.RULES, PARTS = ctx.PARTS;

const ALL = { chest: true, back: true, shoulder: true, arm: true, legs: true, abs: true };
const base = { age: 25, goal: 'auto', lift: true, level: 'new', place: 'gym', split: 'auto', focus: 'auto', parts: ALL, schedMode: 'weekly', liftDays: [0, 2, 4],
  skipHolidays: true, liftTime: '18:00', cardio: [], wake: '07:30', breakfast: '07:55', lunch: '12:00', dinner: '19:00', sleep: '23:30', eggsMilk: true, budget: false, startDate: '2026-09-28' };
const cases = [
  ['用户本人', { sex: 'M', age: 24, height: 172, weight: 80, waist: 80, parts: { ...ALL, legs: false }, liftTime: '17:15', cardio: [{ kind: '跑步', pace: 8, minutes: 60, days: [1, 3, 5] }], budget: true }],
  ['矮胖男新手', { sex: 'M', height: 160, weight: 85, waist: 95 }],
  ['高瘦男新手', { sex: 'M', height: 188, weight: 65, waist: 72 }],
  ['正常男有基础4练', { sex: 'M', height: 175, weight: 70, waist: 78, level: 'some', liftDays: [0, 1, 3, 4] }],
  ['正常男腰粗', { sex: 'M', height: 175, weight: 72, waist: 90 }],
  ['大体重男 130kg', { sex: 'M', height: 180, weight: 130, waist: 125 }],
  ['老手男5练手臂', { sex: 'M', height: 178, weight: 82, waist: 82, level: 'vet', liftDays: [0, 1, 2, 3, 4], focus: 'arm' }],
  ['中年男居家', { sex: 'M', age: 48, height: 170, weight: 78, waist: 92, place: 'home' }],
  ['瘦小女新手', { sex: 'F', height: 155, weight: 42, waist: 60 }],
  ['正常女', { sex: 'F', height: 162, weight: 55, waist: 68 }],
  ['偏胖女早上练', { sex: 'F', height: 165, weight: 72, waist: 86, liftTime: '07:00', wake: '06:30', breakfast: '06:45' }],
  ['女居家不练胸', { sex: 'F', height: 160, weight: 58, waist: 74, place: 'home', parts: { ...ALL, chest: false } }],
  ['只练上肢', { sex: 'M', height: 176, weight: 74, waist: 80, parts: { ...ALL, legs: false, abs: false } }],
  ['只练胸背', { sex: 'M', height: 176, weight: 74, waist: 80, parts: { chest: true, back: true, shoulder: false, arm: false, legs: false, abs: false } }],
  ['每周只练2次', { sex: 'M', height: 172, weight: 68, waist: 76, liftDays: [2, 5] }],
  ['每周练6次', { sex: 'M', height: 172, weight: 68, waist: 76, level: 'some', liftDays: [0, 1, 2, 3, 4, 5] }],
  ['不做力训', { sex: 'F', height: 158, weight: 60, waist: 78, lift: false }],
  ['手动增肌', { sex: 'M', height: 170, weight: 75, waist: 84, goal: 'bulk' }],
  ['手动基础代谢', { sex: 'M', height: 172, weight: 80, waist: 80, bmrOverride: 1900 }],
  ['夜里练', { sex: 'M', height: 173, weight: 66, waist: 74, liftTime: '21:30', sleep: '01:00' }],
  ['糖尿病', { sex: 'M', height: 170, weight: 90, waist: 100, diabetes: true }],
  ['60 岁女', { sex: 'F', age: 60, height: 158, weight: 62, waist: 84 }],
];

const bmiOf = p => p.weight / (p.height / 100) ** 2;
const LEG = ['quad', 'ham', 'glute', 'comp'];
const partOf = {}; PARTS.forEach(pt => pt.groups.forEach(g => partOf[g] = pt.id));
const rows = [];
let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };

for (const [name, over] of cases) {
  const p = { ...base, ...over };
  const pl = E.build(p);
  const M = p.sex === 'M', bmi = bmiOf(p);
  const tag = `【${name}】`;

  // 表5 G13 基础代谢（Mifflin-St Jeor），可手动覆盖
  const formula = Math.round(p.weight * 9.99 + p.height * 6.25 - p.age * 4.92 + (M ? 5 : -161));
  ok(pl.bmr === (p.bmrOverride ? p.bmrOverride : formula), tag + '基础代谢');
  // 表5 D14 无运动消耗 = BMR / 0.7
  ok(pl.b === Math.round(pl.bmr / 0.7), tag + '无运动消耗');
  // 表5 G15 力训消耗
  ok(pl.c === (p.lift === false ? 0 : R.liftBurn[M ? 'M' : 'F'][p.level]), tag + '力训消耗');
  // 目标：表18 B60 / 表17 B36 / 表5 C10 / 表8
  let goal;
  if (p.lift === false) goal = 'cut';
  else if (p.goal !== 'auto') goal = p.goal;
  else if (bmi > (M ? 24 : 22)) goal = 'cut';
  else if (bmi < (M ? 23 : 21)) goal = 'bulk';
  else goal = +p.waist > (M ? 85 : 80) ? 'cut' : 'bulk';
  ok(pl.goal === goal, tag + '减脂/增肌判断 ' + pl.goal + ' vs ' + goal);
  // 表5 D19（×0.64）/ 表13 D19（×0.84）
  const factor = goal === 'cut' ? 0.64 : 0.84;
  ok(pl.f2 === Math.round((pl.b + pl.d) * factor), tag + '休息日热量');
  if (p.lift !== false) ok(pl.f1 === Math.round((pl.b + pl.c + pl.d) * factor), tag + '力训日热量');
  // 分餐加起来 = 全天配额
  const sum = (m, k) => m.reduce((s, x) => s + x[k], 0);
  if (pl.meals.lift) { ok(sum(pl.meals.lift, 'c') === pl.carbT, tag + '力训日碳水分餐'); ok(sum(pl.meals.lift, 'p') === pl.prot, tag + '力训日蛋白分餐'); }
  ok(sum(pl.meals.rest, 'c') === pl.carbR, tag + '休息日碳水分餐'); ok(sum(pl.meals.rest, 'p') === pl.prot, tag + '休息日蛋白分餐');
  // 热量闭合：碳水×4 + 蛋白×4 + 脂肪×9 ≈ 应吃热量（四舍五入误差 < 2%）
  const kcal = pl.carbT * 4 + pl.prot * 4 + pl.fat * 9;
  ok(Math.abs(kcal - pl.f1) / pl.f1 < 0.02, tag + `三大营养素合计 ${kcal} 与应吃 ${pl.f1} 不符`);
  ok(pl.carbR >= 0 && pl.carbT >= pl.carbR, tag + '碳水');
  // 饮食表：按训练时间选表1-7 / 9-15，不力训用表8
  if (p.lift === false) ok(pl.sheet.sheet === '表8', tag + '表8');
  else { const n = +pl.sheet.sheet.replace('表', ''); ok(goal === 'cut' ? n >= 1 && n <= 7 : n >= 9 && n <= 15, tag + '饮食表编号 ' + pl.sheet.sheet); }
  // 训练：分化选择（表5 E96/E97），只包含选了的部位，名称由保留的肌群得出
  if (p.lift !== false) {
    const tr = pl.training, n = p.liftDays.length;
    const want = p.place === 'home' ? 'home' : p.level === 'new' ? 'three' : n >= 4 ? (p.focus === 'arm' ? 'four_arm' : 'four_sh') : 'three';
    ok(tr.split.key === want, tag + '分化 ' + tr.split.key + ' vs ' + want);
    ok(tr.days.length >= 1, tag + '至少一天');
    tr.days.forEach(d => {
      ok(d.groups.length > 0, tag + d.name + ' 为空');
      d.groups.forEach(g => ok(p.parts[partOf[g.id]] !== false, tag + d.name + ' 含没选的部位 ' + g.id));
      ok(d.name === E.dayName(d.groups), tag + '名称');
      // 每个肌群的组数、动作都来自原表，并带出处
      d.groups.forEach(g => ok(/^表2[1-4] C\d+/.test(g.src), tag + '出处 ' + g.src));
    });
    if (p.parts.legs === false) ok(!tr.days.some(d => d.groups.some(g => LEG.includes(g.id))), tag + '不练腿却有腿');
    // 第 1 周和第 6 周的具体安排：组数随周数增加（表21 C10 新手先少做），每个动作都有备选且来自同一肌群
    tr.days.forEach((d, i) => {
      const s1 = E.sessionPlan(p, d, { week: 1, legRound: i, chestRound: i, choices: {} });
      const s6 = E.sessionPlan(p, d, { week: 6, legRound: i, chestRound: i, choices: {} });
      ok(s1.length > 0, tag + d.name + ' 第1周没有动作');
      const t1 = s1.filter(x => !x.optional).reduce((a, x) => a + x.sets, 0), t6 = s6.filter(x => !x.optional).reduce((a, x) => a + x.sets, 0);
      ok(t6 >= t1, tag + d.name + ' 组数第6周应不少于第1周');
      s1.forEach(x => ok(x.reps === (x.repsSrc.includes('C14') ? '10-15' : x.reps), tag + '女性次数'));
    });
  }
  // 警告：每周 <3 次 / ≥6 次（表21 C8）
  if (p.lift !== false && p.liftDays.length < 3) ok(pl.warnings.some(w => /低于 3 次/.test(w.text)), tag + '少于3次警告');
  if (p.lift !== false && p.liftDays.length >= 6) ok(pl.warnings.some(w => /6 次/.test(w.text)), tag + '6次警告');

  rows.push([name, `${p.sex === 'M' ? '男' : '女'}${p.age} ${p.height}/${p.weight}`, bmi.toFixed(1), goal === 'cut' ? '减脂' : '增肌', pl.bmr, `${pl.f1}/${pl.f2}`, `${pl.carbT}/${pl.carbR}`, pl.prot, pl.fat, pl.sheet.sheet,
    pl.training ? pl.training.splitName.replace('健身房', '') + '：' + pl.training.days.map(d => d.name.replace(/ /g, '')).join(' | ') : '不力训']);
}
const head = ['情形', '资料', 'BMI', '目标', 'BMR', '热量 练/休', '碳水 练/休', '蛋白', '脂肪', '饮食表', '训练安排'];
console.log([head, ...rows].map(r => r.join('\t')).join('\n'));
console.log(`\n${cases.length} 种情形，${checks} 项检查全部通过`);
