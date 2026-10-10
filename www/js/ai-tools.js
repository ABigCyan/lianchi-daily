/*
 * 助手的工具：查套表、看计划和记录、改计划和训练、记饮食、记身体数据、AI 记忆。
 * 每个工具在这里定义一次，注册到 Harness（ai-harness.js）；云端助手按清单调用，离线助手的规则也调用同一份。
 * 修改类工具（write）执行前都会经过 ctx.confirm，在对话里弹出确认卡，用户点了才改。
 * 知识库 data-kb.js 由 tools/build-kb.py 从原表生成，第一次用到时才加载。
 */
window.AITools = (() => {
const { E, $, $$, esc, S, LS, today, DOW, toast, render, peek, rec, save, saveCustom, training, sessionInfo, sessionItems, LIB, dayInfo, tasksFor, setTaskTime, scoreDay, uid, TYPE,
  burnOf, intakeOf, targetOf, allDays } = C;
const { I } = Kit;

/* ---------- 知识库 ---------- */
let kbReady = null;
function loadKB() {
  if (window.KB) return Promise.resolve();
  if (!kbReady) kbReady = new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'js/data-kb.js'; s.onload = ok; s.onerror = () => { kbReady = null; bad(new Error('知识库加载失败')); }; document.head.appendChild(s); });
  return kbReady;
}
const sheetName = s => { const x = (window.KB.sheets || []).find(y => y.s === String(s)); return x ? x.n : ''; };
function srcOf(row) {
  const mine = S.plan && S.plan.sheet ? String(S.plan.sheet.sheet).replace('表', '') : '';
  const all = [row.s].concat(row.o ? row.o.split(',') : []);
  const s = all.includes(mine) ? mine : row.s;
  return `表${s} 第${row.r}行` + (all.length > 1 ? `（表${all.join('、')} 同一内容）` : '');
}
function terms(q) {
  const words = String(q || '').toLowerCase().split(/[\s,，。、？?！!；;：:（）()“”"'/]+/).filter(Boolean);
  const out = new Set(words.filter(w => w.length >= 1));
  words.forEach(w => { if (/[一-鿿]/.test(w) && w.length > 2) for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2)); });
  return [...out];
}
function searchExcel({ query, sheet }) {
  const ts = terms(query);
  if (!ts.length) return { error: '请给关键词' };
  const rows = window.KB.rows.filter(r => !sheet || r.s === String(sheet).replace(/[^\d]/g, '') || (r.o || '').split(',').includes(String(sheet).replace(/[^\d]/g, '')));
  const scored = rows.map(r => {
    const t = r.t.toLowerCase(); let sc = 0;
    ts.forEach(w => { if (t.includes(w)) sc += w.length >= 3 ? w.length * 2 : w.length; });
    return { r, sc };
  }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 8);
  if (!scored.length) return { results: [], note: '套表里没有找到相关内容，换个说法再搜一次；还是没有就告诉用户套表里没有写' };
  return { results: scored.map(({ r }) => ({ src: srcOf(r), sheet: `表${r.s} ${sheetName(r.s)}`, row: r.r, text: r.t.length > 700 ? r.t.slice(0, 700) + '…（用 read_excel_rows 读全文）' : r.t })) };
}
/* 补充资料（非套表）：同样按关键词打分；结果带上和套表的关系、套表对应出处、来源全称 */
function searchRefs({ query }) {
  const K = window.KB_EXT, ts = terms(query);
  if (!K) return { error: '补充资料没有加载' };
  if (!ts.length) return { error: '请给关键词' };
  const scored = K.rows.map(r => {
    const t = (r.topic + ' ' + r.t + ' ' + r.excel).toLowerCase(); let sc = 0;
    ts.forEach(w => { if (t.includes(w)) sc += (w.length >= 3 ? w.length * 2 : w.length) * (r.topic.toLowerCase().includes(w) ? 2 : 1); });
    return { r, sc };
  }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 5);
  if (!scored.length) return { results: [], note: '补充资料里也没有，告诉用户套表和补充资料都没有写' };
  return { results: scored.map(({ r }) => ({ id: r.id, relation_to_excel: r.rel, excel: r.excel, text: r.t,
    sources: r.refs.map(k => `${K.sources[k].short}：${K.sources[k].cite}`) })), note: '引用时写成（补充：来源简称），和套表有差异时两边都说，默认按套表' };
}
function readRows({ sheet, from_row, to_row }) {
  const s = String(sheet).replace(/[^\d]/g, ''), a = +from_row || 1, b = Math.min(+to_row || a + 10, a + 40);
  const rows = window.KB.rows.filter(r => (r.s === s || (r.o || '').split(',').includes(s)) && r.r >= a && r.r <= b);
  return { sheet: `表${s} ${sheetName(s)}`, rows: rows.map(r => ({ src: `表${s} 第${r.r}行`, text: r.t })), note: rows.length ? '' : '这几行没有文字' };
}

/* ---------- 读取：计划、今天、记录、动作库 ---------- */
function myPlan() {
  const p = S.profile, pl = S.plan, tr = pl.training;
  return {
    profile: { sex: p.sex === 'F' ? '女' : '男', age: p.age, height_cm: p.height, weight_kg: p.weight, waist_cm: p.waist || null, target_weight_kg: p.targetWeight || null,
      level: { new: '新手', some: '有基础', vet: '老手' }[p.level || 'new'], place: p.place === 'home' ? '居家' : '健身房', lift_days: (p.liftDays || []).map(i => '周' + DOW[i]), lift_time: p.liftTime,
      parts: window.PARTS.map(pt => `${pt.name}${(p.parts || {})[pt.id] === false ? '（不练）' : ''}`).join('、'), cardio: (p.cardio || []).filter(c => c.kind && c.kind !== '无').map(c => `${c.kind} ${c.minutes || ''}分钟 周${(c.days || []).map(i => DOW[i]).join('')}`),
      budget_mode: !!p.budget, goal_setting: p.goal, split_setting: p.split || 'auto', bmr_manual: p.bmrOverride || null,
      plan_mode: p.planMode === 'smart' ? '套表为主 + 补充' : '只按套表', session_max_minutes: +p.sessionMin || null,
      equipment: p.equip && p.equip.length ? p.equip.map(k => (window.EQUIP.find(e => e[0] === k) || [k, k])[1]) : '没设置（不按器械筛选）',
      focus_parts: (p.focusParts || []).map(id => (window.PARTS.find(pt => pt.id === id) || {}).name), avoid_joints: (p.avoid || []).map(j => (window.JOINTS.find(x => x[0] === j) || [j, j])[1]),
      custom_split: p.customSplit ? p.customSplit.name : null },
    goal: { value: pl.goal === 'cut' ? '减脂' : '增肌', reason: pl.goalWhy.reason, src: pl.goalWhy.src },
    energy: { bmr: pl.bmr, no_exercise_burn: pl.b, lift_burn: pl.c, cardio_burn_per_day: pl.d, eat_on_lift_day_kcal: pl.f1, eat_on_rest_day_kcal: pl.f2, src: '表5 G13-G19（增肌为表13）' },
    macros: { carbs_lift_day_g: pl.carbT, carbs_rest_day_g: pl.carbR, protein_g: pl.prot, fat_g: pl.fat, src: '表5 E22-L23' },
    diet_sheet: pl.sheet,
    meals_lift_day: (pl.meals.lift || []).map(m => `${m.time} ${m.name} 碳水${m.c}g 蛋白质${m.p}g`),
    meals_rest_day: pl.meals.rest.map(m => `${m.time} ${m.name} 碳水${m.c}g 蛋白质${m.p}g`),
    training: tr ? { split: tr.splitName, split_key: tr.split.key, supplementary: !!tr.ext, why: tr.split.why, src: tr.split.src, per_week: pl.perWeek, removed_parts: tr.removed,
      relation_to_excel: tr.splitMeta.rel || null, weekly_volume: Object.values(pl.volume || {}).filter(x => x.sets).map(x => `${x.name} 每周约${x.sets}组/${x.freq}次`),
      days: tr.days.map((d, i) => ({ day_index: i, name: d.name, table_title: d.tableName, src: d.src, groups: d.groups.map(g => ({ group_id: g.id, name: g.name, rule: g.text, src: g.src })) })) } : '不做力训（表8）',
    warnings: (pl.warnings || []).map(w => `${w.text}（${w.src}）`),
  };
}
function todayInfo({ date }) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : today();
  const info = dayInfo(d), r = peek(d) || { done: {} }, { tasks } = tasksFor(d);
  const out = { date: d, weekday: '周' + DOW[E.dow(d)], type: info.lift ? '力训日' : '休息日', holiday: info.h ? info.h.name + (info.h.off ? '（放假）' : '（补班）') : null,
    timeline: tasks.map(t => ({ item_id: t.id, time: t.time, title: t.title, done: !!r.done[t.id] })),
    meals: tasksFor(d).meals.map(m => ({ meal_key: m.key, name: m.name, time: m.time, carbs_g: m.c, protein_g: m.p, notes: m.notes || [] })),
    removed_items: hiddenOf(d), day_override: r.override || null, weight_kg: r.weight || null,
    intake: intakeOf(d), target: targetOf(d), burn_kcal: burnOf(d).total };
  if (S.plan.training && (info.lift || (r.done && r.done.lift))) {
    const { si, items } = sessionItems(d);
    out.training = { name: si.custom ? '自选部位' : si.day.name, day_index: si.dayIdx, recommended: !!si.recommended,
      exercises: items.map((it, i) => { const sg = C.suggestFor(it, d); const ld = C.loadOf(it.ex, it.v); return { order: i + 1, exercise_id: it.v, name: it.ex.n, group: it.group.name, weight_input: ld.mode === 'bar' ? `每边加片，杆 ${ld.bar}kg（记录里的重量是总重）` : C.LOADS[ld.mode], sets: it.sets, reps: it.reps, rest: it.rest, to_failure: !/不追求/.test(it.fail), customized: !!it.custom, suggested: sg ? `${sg.w ? sg.w + 'kg × ' : ''}${sg.r}（${sg.why}）` : null, src: it.group.src }; }) };
  }
  return out;
}
function hiddenOf(d) {
  const type = dayInfo(d).type, tpl = S.custom.timeline[type] || {}, day = (peek(d) || {}).tl || {};
  return [...new Set([...(tpl.hide || []), ...(day.hide || [])])].map(id => ({ item_id: id, scope: (day.hide || []).includes(id) ? 'day' : 'always' }));
}
function history({ days }) {
  const n = Math.max(1, Math.min(+days || 14, 60)), list = allDays().slice(-n);
  return { days: list.map(d => { const r = peek(d) || { done: {} }, i = intakeOf(d); return { date: d, weight: r.weight ? +r.weight : null, intake_kcal: Math.round(i.kcal), carbs: Math.round(i.c), protein: Math.round(i.p), burn_kcal: burnOf(d).total, lifted: !!(r.done && r.done.lift) }; }),
    note: '体重只比较 1-2 周的平均值（表17 B91）；减脂期记录到的摄入本来就会低于实际' };
}
function listExercises({ part, group_id, source, only_usable }) {
  const p = S.profile, eq = p.equip && p.equip.length ? p.equip : null;
  const all = Object.values(LIB).filter(x => (!part || x.part === part) && (!group_id || x.gid === group_id || (x.ex.groups || []).includes(group_id))
    && (!source || source === 'all' || (source === 'excel') === !x.ext) && (!only_usable || window.exUsable(x.ex, eq, p.avoid || [])));
  return { exercises: all.slice(0, 120).map(x => ({ exercise_id: x.v, name: x.ex.n, group: x.group, part: x.part, equipment: x.ex.eq, source: x.ext ? '补充：' + x.ex.kindName : '套表', src: x.src,
    usable_for_user: window.exUsable(x.ex, eq, p.avoid || []) })), note: '套表动作优先；补充动作要说明是补充' };
}
/* 肌群模板（定制分化用） */
function listGroups({ place }) {
  return { groups: Object.values(window.GROUP_TPL).filter(t => !place || t.place === place).map(t => ({ tpl: t.key, name: t.name, part: (window.PARTS.find(pt => pt.groups.includes(t.id)) || {}).name,
    excel_rule: t.from ? `${t.text}（${t.src}）` : '套表没有单列，只有补充动作', excel_exercises: t.entries.map(e => window.ENTRY[e].map(v => window.EX[v].n).join('/')), extra_exercises: t.ext.map(v => window.EX[v].n) })),
    note: '定制分化时：每周每个主要部位总组数尽量接近套表（胸约10、背12-16、腿12-16组），每次总组数 20 组上下、不超过约 30 组（表21 C10）；sets 写成 [下限, 上限]，新手前4周用下限' };
}

/* ---------- 修改（都要用户确认） ---------- */
const PARTS_IDS = ['chest', 'back', 'shoulder', 'arm', 'legs', 'abs'];
const LABEL = { goal: '目标', weight: '体重', targetWeight: '目标体重', waist: '腰围', level: '训练经验', place: '训练地点', split: '分化', focus: '四分化重点', liftDays: '力训日', liftTime: '开始训练时间', parts: '想练的部位', lift: '做力训', budget: '省钱模式', bmrOverride: '手动基础代谢',
  planMode: '计划依据', sessionMin: '每次最多', equip: '器械', focusParts: '重点部位', avoid: '伤病避开' };
function show(k, v) {
  if (k === 'equip' && !(v && v.length)) return '不筛选';
  if (v == null || v === '') return '（空）';
  if (k === 'goal') return { auto: '自动判断', cut: '减脂', bulk: '增肌' }[v] || v;
  if (k === 'level') return { new: '新手', some: '有基础', vet: '老手' }[v] || v;
  if (k === 'place') return v === 'home' ? '居家' : '健身房';
  if (k === 'split') return v === 'mine' ? (S.profile.customSplit ? S.profile.customSplit.name : '我的分化') + '（定制）' : (window.SPLIT_CHOICES.find(x => x[0] === v) || [v, v])[1];
  if (k === 'planMode') return v === 'smart' ? '套表为主 + 补充' : '只按套表';
  if (k === 'sessionMin') return +v ? v + ' 分钟' : '不限';
  if (k === 'equip') return v && v.length ? v.map(x => (window.EQUIP.find(e => e[0] === x) || [x, x])[1]).join('、') : '不筛选';
  if (k === 'focusParts') return v.length ? v.map(id => (window.PARTS.find(pt => pt.id === id) || {}).name).join('、') : '无';
  if (k === 'avoid') return v.length ? v.map(j => (window.JOINTS.find(x => x[0] === j) || [j, j])[1]).join('、') : '无';
  if (k === 'focus') return v === 'arm' ? '手臂' : '肩';
  if (k === 'liftDays') return v.map(i => '周' + DOW[i]).join('、');
  if (k === 'parts') return window.PARTS.filter(pt => v[pt.id] !== false).map(pt => pt.name).join('、');
  if (typeof v === 'boolean') return v ? '是' : '否';
  return String(v);
}
function cleanChanges(ch) {
  const out = {}, errs = [];
  const num = (k, lo, hi) => { if (ch[k] == null) return; const v = +ch[k]; if (v >= lo && v <= hi) out[k] = Math.round(v * 10) / 10; else errs.push(`${LABEL[k]}要在 ${lo}-${hi} 之间`); };
  if (ch.goal != null) { if (['auto', 'cut', 'bulk'].includes(ch.goal)) out.goal = ch.goal; else errs.push('目标只能是 auto/cut/bulk'); }
  num('weight', 35, 200); num('targetWeight', 35, 200); num('waist', 40, 160); num('bmrOverride', 800, 4000);
  if (ch.level != null) { if (['new', 'some', 'vet'].includes(ch.level)) out.level = ch.level; else errs.push('经验只能是 new/some/vet'); }
  if (ch.place != null) { if (['gym', 'home'].includes(ch.place)) out.place = ch.place; else errs.push('地点只能是 gym/home'); }
  if (ch.split != null) { if (window.SPLIT_CHOICES.some(x => x[0] === ch.split) || (ch.split === 'mine' && S.profile.customSplit)) out.split = ch.split; else errs.push('分化不认识（定制分化用 create_custom_split）'); }
  if (ch.planMode != null) out.planMode = ch.planMode === 'smart' ? 'smart' : 'excel';
  if (ch.sessionMin != null) { const v = +ch.sessionMin; if (v === 0 || (v >= 30 && v <= 120)) out.sessionMin = Math.round(v); else errs.push('每次最多要在 30-120 分钟，0 表示不限'); }
  if (ch.equip !== undefined) { if (ch.equip === null || (Array.isArray(ch.equip) && !ch.equip.length)) out.equip = null; else { const v = [...new Set(ch.equip.filter(k => window.EQUIP.some(e => e[0] === k)))]; if (v.length) out.equip = v; else errs.push('器械代号不认识'); } }
  if (ch.focusParts != null) out.focusParts = [...new Set((ch.focusParts || []).filter(id => PARTS_IDS.includes(id)))];
  if (ch.avoid != null) out.avoid = [...new Set((ch.avoid || []).filter(j => window.JOINTS.some(x => x[0] === j)))];
  if (ch.focus != null) out.focus = ch.focus === 'arm' ? 'arm' : 'auto';
  if (ch.liftDays != null) { const v = [...new Set((ch.liftDays || []).map(Number).filter(i => i >= 0 && i <= 6))].sort(); if (v.length) out.liftDays = v; else errs.push('至少一天力训'); }
  if (ch.liftTime != null) { if (/^\d{1,2}:\d{2}$/.test(ch.liftTime)) out.liftTime = ch.liftTime.padStart(5, '0'); else errs.push('时间格式要是 HH:MM'); }
  if (ch.parts != null && typeof ch.parts === 'object') { const v = Object.assign({}, S.profile.parts); PARTS_IDS.forEach(id => { if (ch.parts[id] != null) v[id] = !!ch.parts[id]; }); if (Object.values(v).some(Boolean)) out.parts = v; else errs.push('至少保留一个部位'); }
  if (ch.lift != null) out.lift = !!ch.lift;
  if (ch.budget != null) out.budget = !!ch.budget;
  return { out, errs };
}
function applyProfile(out) {
  const p = Object.assign({}, S.profile, out);
  if (out.liftDays) p.schedMode = 'weekly';
  if (p.goal === 'bulk' && p.lift === false) throw new Error('增肌必须做力训（表13 E24）');
  S.profile = p; LS.set('profile', p); S.plan = E.build(p);
  if (window.Me && Me.scheduleNotifs) Me.scheduleNotifs();
}

/* ---------- 工具清单 ---------- */
/* ---------- 记饮食（云端 log_food 和离线规则共用）：表19 能查到的按表算，查不到的用估算值并标明 ---------- */
function foodItems(foods) {
  const items = [], bad = [];
  (foods || []).forEach(x => {
    const unit = String(x.unit || '').trim(), amt = +x.amount;
    let f = FoodDB.byName(String(x.name || '').trim());
    if (!f) { const r = FoodDB.parse(`${amt > 0 ? amt + (unit || '') : ''}${x.name}`); if (r.items.length === 1) { f = r.items[0].f; if (!(amt > 0) && r.items[0].amt) x.amount = r.items[0].amt; } }
    if (f) {
      let a = +x.amount;
      if (!(a > 0)) a = f.unit === 'g' ? NaN : 1;
      if (f.unit !== 'g' && /^(g|克)$/.test(unit)) { bad.push(`${f.n} 是按${f.unit}算的，请给个数`); return; }
      if (!(a > 0)) { bad.push(`${f.n} 要写克数`); return; }
      items.push(FoodDB.item(f, a));
    } else if (x.carbs_g != null || x.protein_g != null || x.fat_g != null) {
      const c = Math.round(+x.carbs_g || 0), p = Math.round(+x.protein_g || 0), fat = Math.round(+x.fat_g || 0);
      items.push({ name: `${x.name}${amt > 0 ? ' ' + amt + (unit || '') : ''}`, grams: /^(g|克)$/.test(unit) ? amt : 0, carbs_g: c, protein_g: p, fat_g: fat, kcal: c * 4 + p * 4 + fat * 9, category: '其他', note: '估算（不在表19）', est: true });
    } else bad.push(`表19 里没有“${x.name}”`);
  });
  return { items, bad };
}
async function logFood(a, ctx) {
  const viaLocal = ctx && ctx.via === 'local' ? ctx.q : '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : today();
  if (d > today()) return { ok: false, error: '不能记以后的饮食' };
  const meals = tasksFor(d).meals, meal = meals.find(m => m.key === a.meal_key) || (a.meal_key === 'extra' ? { key: 'extra', name: '加餐' } : null);
  if (!meal) return { ok: false, error: `这一天没有这一餐，可选：${meals.map(m => m.key + ' ' + m.name).join('、')}、extra 加餐` };
  const { items, bad } = foodItems(a.foods);
  if (!items.length) return { ok: false, error: bad.join('；') || '没有可记的食物' };
  const r0 = peek(d) || {}, old = (r0.food || []).filter(f => f.meal === meal.key);
  const sum = items.reduce((t, x) => ({ c: t.c + x.carbs_g, p: t.p + x.protein_g, f: t.f + x.fat_g, k: t.k + x.kcal }), { c: 0, p: 0, f: 0, k: 0 });
  const lines = items.map(x => `${x.name}：碳水 ${x.carbs_g}g · 蛋白质 ${x.protein_g}g · ${x.kcal} kcal${x.est ? '（估算）' : ''}`)
    .concat([`合计 ${sum.k} kcal（碳水 ${sum.c}g、蛋白质 ${sum.p}g、脂肪 ${sum.f}g）；这一餐目标 碳水 ${meal.c || 0}g、蛋白质 ${meal.p || 0}g`])
    .concat(a.replace && old.length ? [`替换${meal.name}已记的 ${old.length} 条`] : [])
    .concat(meal.key !== 'extra' ? [`${meal.name}标记为完成`] : [])
    .concat(bad.length ? ['没记上：' + bad.join('；')] : []);
  if (!await ctx.confirm(`记饮食 · ${d === today() ? '今天' : d} ${meal.name.replace(/（.*）/, '')}`, lines, a.reason || (viaLocal ? '按你的话记：' + String(viaLocal).slice(0, 40) : ''), '记上')) return { ok: false, error: '用户取消了' };
  const r = rec(d); r.food = r.food || [];
  if (a.replace) r.food = r.food.filter(f => f.meal !== meal.key);
  const now = new Date(), entry = { id: uid(), meal: meal.key, mealName: meal.name, time: E.mt(now.getHours() * 60 + now.getMinutes()), items, source: items.some(x => x.est) ? 'ai' : 'manual', flags: [], advice: '',
    total: { carbs_g: sum.c, protein_g: sum.p, fat_g: sum.f, kcal: sum.k } };
  r.food.push(entry);
  if (meal.key !== 'extra' && tasksFor(d).tasks.some(t => t.id === 'meal-' + meal.key)) r.done['meal-' + meal.key] = true;
  save(d); scoreDay(d);
  const e = intakeOf(d), t = targetOf(d);
  return { ok: true, done: `${meal.name}记了 ${items.length} 项，共 ${sum.k} kcal`, day_total: `今天已吃 ${e.kcal}/${t.kcal} kcal，碳水 ${e.c}/${t.c}g，蛋白质 ${e.p}/${t.p}g`, not_logged: bad };
}

/* ---------- 工具清单 ---------- */
const TOOLS = [
  { name: 'search_excel', description: '在《健身Excel超级套表》原文里搜索（饮食表、减脂/增肌问答、有氧消耗、食物营养率、训练计划、解剖总结）。回答任何方法、原则问题前都要先搜。返回原文和出处。', parameters: { type: 'object', properties: { query: { type: 'string', description: '关键词，空格分开，例如“体重不掉 调整”“蛋白质 鸡蛋”' }, sheet: { type: 'string', description: '可选，只搜某张表，填表号，例如 "17"' } }, required: ['query'] } },
  { name: 'read_excel_rows', description: '读套表某张表的连续几行原文（最多 40 行），用来看问答的完整回答或上下文。', parameters: { type: 'object', properties: { sheet: { type: 'string', description: '表号，例如 "17"' }, from_row: { type: 'integer' }, to_row: { type: 'integer' } }, required: ['sheet', 'from_row', 'to_row'] } },
  { name: 'search_refs', description: '在补充资料（非套表）里搜索：WHO/ACSM/中国指南、立场声明、Meta 分析、NSCA 教材的共识，例如热身、动作速度、老年人、睡眠、每周组数、频率、蛋白质 g/kg。只有套表没写、用户要求对照、或要定制计划时才用；每条结果带和套表的关系（一致/补充/有差异）。', parameters: { type: 'object', properties: { query: { type: 'string', description: '关键词，空格分开' } }, required: ['query'] } },
  { name: 'get_my_plan', description: '读取用户资料和 App 按套表算出的计划：减脂/增肌及理由、热量、碳水蛋白质脂肪、饮食表、每餐分量、训练分化和每天练的肌群（含 group_id、day_index）、警告。', parameters: { type: 'object', properties: {} } },
  { name: 'get_today', description: '读取某一天（默认今天）的安排：是否力训日、时间线、训练动作（含 exercise_id）、已吃的碳水蛋白质热量、目标、消耗。', parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD，可选' } } } },
  { name: 'get_history', description: '读取最近几天的体重、摄入、消耗、是否力训。', parameters: { type: 'object', properties: { days: { type: 'integer', description: '天数，默认 14，最多 60' } } } },
  { name: 'list_exercises', description: '列出动作库：套表表21-24 的动作 + 补充动作（标明依据）。可按部位、肌群、来源筛选，usable_for_user 表示按用户的器械和伤病设置能不能做。', parameters: { type: 'object', properties: {
    part: { type: 'string', enum: ['胸', '背', '肩', '手臂', '腿臀', '腹'] }, group_id: { type: 'string', description: '肌群 id，如 pull、row、mid_chest、quad、calf、core' }, source: { type: 'string', enum: ['all', 'excel', 'extra'] }, only_usable: { type: 'boolean' } } } },
  { name: 'list_groups', description: '列出可以用来定制分化的肌群模板（tpl），每个模板带套表规则和动作。用 create_custom_split 之前先调用。', parameters: { type: 'object', properties: { place: { type: 'string', enum: ['gym', 'home'] } } } },
  { name: 'create_custom_split', description: '按用户情况定制训练分化（套表的 4 种分化和补充分化都不合适时才用）。days 里每天列出肌群模板 tpl（来自 list_groups）、组数 sets=[下限,上限]、动作数 pick=[下限,上限]。App 会算出每周每个部位的组数给用户看，用户确认后改用这个分化。会先让用户确认。', parameters: { type: 'object', properties: {
    name: { type: 'string', description: '分化名称，例如“上下肢+手臂”' },
    days: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, groups: { type: 'array', items: { type: 'object', properties: { tpl: { type: 'string' }, sets: { type: 'array', items: { type: 'integer' } }, pick: { type: 'array', items: { type: 'integer' } }, optional: { type: 'boolean' } }, required: ['tpl', 'sets'] } } }, required: ['name', 'groups'] } },
    reason: { type: 'string', description: '为什么这样排：用户的情况 + 依据（套表出处 / 补充资料出处）' } }, required: ['name', 'days', 'reason'] } },
  { name: 'update_profile', description: '修改用户资料或训练目标，改完会按套表重新计算整套计划。会先让用户确认。liftDays 用 0=周一 … 6=周日。parts 的键：chest 胸、back 背、shoulder 肩、arm 手臂、legs 腿臀、abs 腹。', parameters: { type: 'object', properties: {
    changes: { type: 'object', properties: {
      goal: { type: 'string', enum: ['auto', 'cut', 'bulk'] }, weight: { type: 'number' }, targetWeight: { type: 'number' }, waist: { type: 'number' },
      level: { type: 'string', enum: ['new', 'some', 'vet'] }, place: { type: 'string', enum: ['gym', 'home'] },
      split: { type: 'string', enum: ['auto', 'three', 'four_sh', 'four_arm', 'home', 'full2', 'full3', 'ul4', 'five', 'home_full', 'home_ul', 'mine'], description: '前 5 个是套表；full2/full3/ul4/five/home_full/home_ul 是补充分化；mine 是已定制的分化' },
      planMode: { type: 'string', enum: ['excel', 'smart'], description: 'smart：每周只能练 1-2 次时自动用全身训练，其余按套表' }, sessionMin: { type: 'integer', description: '每次最多练多少分钟，0 不限' },
      equip: { type: 'array', items: { type: 'string', enum: ['bb', 'db', 'bench', 'cable', 'machine', 'smith', 'bar', 'dip', 'band', 'kb', 'ball', 'roller'] }, description: '用户有的器械：bb 杠铃 db 哑铃 bench 训练凳 cable 龙门架 machine 固定器械 smith 史密斯 bar 单杠 dip 双杠 band 弹力带 kb 壶铃 ball 瑜伽球 roller 健腹轮；空数组表示不按器械筛选' },
      focusParts: { type: 'array', items: { type: 'string', enum: ['chest', 'back', 'shoulder', 'arm', 'legs', 'abs'] } }, avoid: { type: 'array', items: { type: 'string', enum: ['shoulder', 'elbow', 'wrist', 'lowback', 'knee'] }, description: '伤病避开的关节' },
      focus: { type: 'string', enum: ['auto', 'arm'] }, liftDays: { type: 'array', items: { type: 'integer' } }, liftTime: { type: 'string' },
      parts: { type: 'object', properties: { chest: { type: 'boolean' }, back: { type: 'boolean' }, shoulder: { type: 'boolean' }, arm: { type: 'boolean' }, legs: { type: 'boolean' }, abs: { type: 'boolean' } } },
      lift: { type: 'boolean' }, budget: { type: 'boolean' }, bmrOverride: { type: 'number' } } },
    reason: { type: 'string', description: '为什么这样改，引用套表出处' } }, required: ['changes', 'reason'] } },
  { name: 'edit_training', description: '增加、删除动作或修改组数。scope=today 只改今天，always 以后这一天都这样。exercise_id 从 get_today 或 list_exercises 取；add 时可以用 exercise_ids 一次加好几个。换动作用 swap_exercise，调顺序用 reorder_training，改次数/休息/力竭用 set_exercise_params。会先让用户确认。', parameters: { type: 'object', properties: {
    action: { type: 'string', enum: ['add', 'remove', 'set_sets'] }, exercise_id: { type: 'string' }, exercise_ids: { type: 'array', items: { type: 'string' }, description: 'action=add 时一次加多个' }, sets: { type: 'integer' }, scope: { type: 'string', enum: ['today', 'always'] }, reason: { type: 'string' } }, required: ['action', 'scope', 'reason'] } },
  { name: 'edit_timeline', description: '改某一天（可以是今天或以后的日期）的时间线安排：remove 删掉一项（item_id 从 get_today 取，饮食页会同步去掉，分量并到其他餐），restore 恢复删掉的项，set_time 改时间（会自动按时间排序），add 加一张卡片（title、time、note）。scope=day 只改这一天，always 以后同类日（力训日/休息日/有氧日/节假日）都这样。会先让用户确认。', parameters: { type: 'object', properties: {
    date: { type: 'string', description: 'YYYY-MM-DD，默认今天' }, action: { type: 'string', enum: ['remove', 'restore', 'set_time', 'add'] }, item_id: { type: 'string' }, time: { type: 'string', description: 'HH:MM' }, title: { type: 'string' }, note: { type: 'string' },
    scope: { type: 'string', enum: ['day', 'always'] }, reason: { type: 'string' } }, required: ['action', 'reason'] } },
  { name: 'set_meal_amounts', description: '调整某一天各餐的碳水、蛋白质克数（比如午饭吃不了挪到晚饭、聚餐前后调整）。全天合计应和计划一致（表5 E22-L23 的配额），不一致会提醒。meal_key 从 get_today 的 meals 取。会先让用户确认。', parameters: { type: 'object', properties: {
    date: { type: 'string' }, meals: { type: 'array', items: { type: 'object', properties: { meal_key: { type: 'string' }, carbs_g: { type: 'number' }, protein_g: { type: 'number' } }, required: ['meal_key'] } }, reset: { type: 'boolean', description: 'true 表示恢复这一天按计划的分量' }, reason: { type: 'string' } }, required: ['reason'] } },
  { name: 'set_day_training', description: '设某一天练不练：lift 这天加练、rest 这天不练、auto 恢复按计划（节假日自动跳过）。可以用来安排节假日回来、临时有事等。会先让用户确认。', parameters: { type: 'object', properties: {
    date: { type: 'string' }, type: { type: 'string', enum: ['lift', 'rest', 'auto'] }, reason: { type: 'string' } }, required: ['date', 'type', 'reason'] } },
  { name: 'exercise_info', description: '查一个动作或器械：动作名、用的器械、是否多关节、是否要避免力竭、所属肌群和套表出处、同组可替换的动作，以及 B站 教程搜索链接。可以按 exercise_id 或名称查。', parameters: { type: 'object', properties: { exercise_id: { type: 'string' }, name: { type: 'string' } } } },
  { name: 'video_links', description: '给出教程视频链接：套表里提到的 B站 视频（带出处），以及按关键词搜 B站 的链接（表21 C4：动作教程在 B站 搜动作名称即可）。', parameters: { type: 'object', properties: { topic: { type: 'string', description: '动作名或主题，例如“高位下拉”“饮食定量”' } }, required: ['topic'] } },
  { name: 'search_foods', description: '在表19（食物营养率）和表17 第5问（固定重量食物）里找食物，返回每100g或每个的碳水、蛋白质、脂肪、热量和出处。记饮食、算热量前先查。', parameters: { type: 'object', properties: { query: { type: 'string', description: '食物名，例如“香蕉”“鸡胸肉”“米饭”' } }, required: ['query'] } },
  { name: 'log_food', description: '帮用户记一餐吃了什么（饮食页同步，并把这一餐标成完成）。foods 里每项：name 用 search_foods 查到的表19 名称 + amount 分量（unit 为 g 时是克数，否则是个数）；表19 没有的菜（比如黄焖鸡）可以自己估算 carbs_g、protein_g、fat_g，并设 estimated=true。replace=true 表示替换这一餐已经记的（用户说“改成”时）。会先让用户确认。', parameters: { type: 'object', properties: {
    date: { type: 'string', description: 'YYYY-MM-DD，默认今天' }, meal_key: { type: 'string', description: 'get_today 的 meals 里的 meal_key（breakfast/lunch/dinner/pre/post/snack），加餐用 extra' },
    foods: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'number' }, unit: { type: 'string', description: 'g、个、盒、片' }, carbs_g: { type: 'number' }, protein_g: { type: 'number' }, fat_g: { type: 'number' }, estimated: { type: 'boolean' } }, required: ['name'] } },
    replace: { type: 'boolean' }, reason: { type: 'string' } }, required: ['meal_key', 'foods'] } },
  { name: 'set_today_training', description: '换今天练哪一天（day_index 来自 get_my_plan），或者用 group_ids 自选几个肌群。会先让用户确认。', parameters: { type: 'object', properties: { day_index: { type: 'integer' }, group_ids: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' } } } },
];
const WRITE = new Set(['log_food', 'reorder_training', 'set_exercise_params', 'swap_exercise', 'log_body', 'remember', 'forget', 'update_profile', 'edit_training', 'set_today_training', 'edit_timeline', 'set_meal_amounts', 'set_day_training', 'create_custom_split']);
const STEP_TEXT = { search_foods: a => `查表19：${a.query || ''}`, log_food: () => '准备记饮食', search_refs: a => `查补充资料：${a.query || ''}`, list_groups: () => '查肌群模板', create_custom_split: a => `准备定制分化：${a.name || ''}`, search_excel: a => `查套表：${a.query || ''}${a.sheet ? '（表' + a.sheet + '）' : ''}`, read_excel_rows: a => `读原文：表${a.sheet} 第${a.from_row}-${a.to_row}行`, get_my_plan: () => '看你的计划', get_today: a => `看${a.date || '今天'}的安排`, get_history: a => `看最近 ${a.days || 14} 天记录`, list_exercises: a => `查动作库${a.part ? '：' + a.part : ''}`, update_profile: () => '准备修改计划', edit_training: () => '准备修改训练动作', set_today_training: () => '准备换今天的训练', edit_timeline: a => `准备修改${a.date || '今天'}的安排`, set_meal_amounts: a => `准备调整${a.date || '今天'}各餐分量`, set_day_training: a => `准备设置 ${a.date} 练不练`, exercise_info: a => `查动作：${a.name || a.exercise_id || ''}`, video_links: a => `找视频：${a.topic || ''}`, describe_image: () => '看图片' };
const RUN = {
  async search_excel(a, ctx) { return searchExcel(a); },
  async read_excel_rows(a, ctx) { return readRows(a); },
  async get_my_plan(a, ctx) { return myPlan(); },
  async get_today(a, ctx) { return todayInfo(a); },
  async get_history(a, ctx) { return history(a); },
  async list_exercises(a, ctx) { return listExercises(a); },
  async search_refs(a, ctx) { return searchRefs(a); },
  async list_groups(a, ctx) { return listGroups(a); },
  async search_foods(a, ctx) {
    const hits = FoodDB.search(a.query || '').slice(0, 8);
    if (!hits.length) return { results: [], note: '表19 里没有这个食物。可以按常见做法估算碳水、蛋白质、脂肪，用 log_food 记的时候设 estimated=true，并告诉用户是估算' };
    return { results: hits.map(f => { const u = f.unit === 'g' ? 100 : 1, m = FoodDB.calc(f, u); return { name: f.n, unit: f.unit, [`per_${f.unit === 'g' ? '100g' : f.unit}`]: { carbs_g: m.c, protein_g: m.p, fat_g: m.f, kcal: m.kcal }, src: f.src }; }) };
  },
  async log_food(a, ctx) { return logFood(a, ctx); },
  async create_custom_split(a, ctx) {
    if (S.profile.lift === false) return { ok: false, error: '现在设置的是不做力训' };
    const spec = { name: String(a.name || '我的分化'), why: String(a.reason || '').slice(0, 200), days: (a.days || []).map(d => ({ name: d.name, groups: (d.groups || []).map(g => ({ tpl: g.tpl, sets: g.sets, pick: g.pick, optional: !!g.optional })) })) };
    const c = window.customSplit(spec);
    if (c.errs.length) return { ok: false, error: c.errs.join('；') };
    const np = Object.assign({}, S.profile, { split: 'mine', customSplit: spec }), plan = E.build(np);
    const vol = Object.values(plan.volume).filter(x => x.sets).map(x => `${x.name}${x.sets}组/${x.freq}次`).join('、');
    const lines = c.split.days.map(d => `${d.name}：${d.groups.map(g => `${g.name} ${g.sets[0] === g.sets[1] ? g.sets[0] : g.sets.join('-')}组`).join('、')}`)
      .concat([`每周（按每周 ${plan.perWeek} 次）：${vol}`]).concat(plan.warnings.filter(w => w.app).map(w => w.text));
    if (!await ctx.confirm('定制分化：' + c.split.name, lines, a.reason)) return { ok: false, error: '用户取消了' };
    applyProfile({ split: 'mine', customSplit: spec });
    return { ok: true, split: S.plan.training.splitName, days: S.plan.training.days.map(d => d.name), weekly_volume: vol, warnings: S.plan.warnings.map(w => w.text) };
  },
  async update_profile(a, ctx) {
    const { out, errs } = cleanChanges(a.changes || {});
    if (errs.length) return { ok: false, error: errs.join('；') };
    const keys = Object.keys(out).filter(k => JSON.stringify(out[k]) !== JSON.stringify(S.profile[k]));
    if (!keys.length) return { ok: false, error: '和现在的设置一样，不用改' };
    const before = { f1: S.plan.f1, goal: S.plan.goal, split: S.plan.training && S.plan.training.splitName };
    const lines = keys.map(k => `${LABEL[k]}：${show(k, S.profile[k])} → ${show(k, out[k])}`);
    if (!await ctx.confirm('修改计划', lines, a.reason)) return { ok: false, error: '用户取消了修改' };
    applyProfile(out);
    const pl = S.plan;
    return { ok: true, changed: lines, new_plan: { goal: pl.goal === 'cut' ? '减脂' : '增肌', eat_on_lift_day_kcal: pl.f1, eat_on_rest_day_kcal: pl.f2, carbs_lift_day_g: pl.carbT, protein_g: pl.prot, split: pl.training ? pl.training.splitName : '不做力训', days: pl.training ? pl.training.days.map(d => d.name) : [] }, before };
  },
  async edit_training(a, ctx) {
    if (!S.plan.training) return { ok: false, error: '现在设置的是不做力训' };
    if (a.action === 'add' && Array.isArray(a.exercise_ids) && a.exercise_ids.length) {
      const d = today(), { si, items } = sessionItems(d), sets = Math.max(1, Math.min(+a.sets || 3, 8));
      const list = [...new Set(a.exercise_ids)].filter(v => window.EX[v] && !items.some(it => it.v === v));
      if (!list.length) return { ok: false, error: '这些动作都不存在或者今天已经有了' };
      if (!await ctx.confirm('添加动作', list.map(v => `添加 ${window.EX[v].n}（${sets} 组）`).concat([`范围：${scopeLabel(si, a.scope)}`]), a.reason)) return { ok: false, error: '用户取消了' };
      C.addExercises(today(), si, a.scope, list, sets);
      return { ok: true, done: `加了 ${list.length} 个动作`, today_exercises: sessionItems(d).items.map(it => `${it.ex.n} ${it.sets}组`) };
    }
    if (!a.exercise_id) return { ok: false, error: '缺少 exercise_id' };
    const d = today(), { si, items } = sessionItems(d), v = a.exercise_id, ex = window.EX[v];
    if (!ex) return { ok: false, error: '没有这个 exercise_id，请先用 list_exercises 查' };
    const sets = Math.max(1, Math.min(+a.sets || 3, 8));
    const inToday = items.some(it => it.v === v);
    if (a.action === 'remove' && !inToday) return { ok: false, error: '今天的训练里没有这个动作' };
    if (a.action === 'set_sets' && !inToday) return { ok: false, error: '今天的训练里没有这个动作，先 add' };
    const what = a.action === 'add' ? `添加 ${ex.n}（${sets} 组）` : a.action === 'remove' ? `删除 ${ex.n}` : `${ex.n} 改成 ${sets} 组`;
    if (!await ctx.confirm('修改训练', [what, `范围：${a.scope === 'always' ? `以后每次练“${si.custom ? '自选部位' : si.day.name}”都这样` : '只改今天'}`], a.reason)) return { ok: false, error: '用户取消了' };
    const apply = m => {
      m.hide = m.hide || []; m.add = m.add || []; m.sets = m.sets || {};
      if (a.action === 'remove') { if (!m.hide.includes(v)) m.hide.push(v); m.add = m.add.filter(x => x.v !== v); }
      if (a.action === 'add') { [S.custom.train[si.key], (peek(d) || {}).ex].forEach(x => { if (x && x.hide) x.hide = x.hide.filter(y => y !== v); }); m.hide = m.hide.filter(x => x !== v); if (!m.add.some(x => x.v === v)) m.add.push({ v, sets }); }
      if (a.action === 'set_sets') m.sets[v] = sets;
    };
    if (a.scope === 'always') { S.custom.train[si.key] = S.custom.train[si.key] || {}; apply(S.custom.train[si.key]); saveCustom(); }
    else { const r = rec(d); r.ex = r.ex || {}; if (!r.session) r.session = si.custom ? { custom: true, split: training().split.key, groups: si.groups } : { split: training().split.key, dayIdx: si.dayIdx }; apply(r.ex); save(d); }
    return { ok: true, done: what, today_exercises: sessionItems(d).items.map(it => `${it.ex.n} ${it.sets}组`) };
  },
  async set_today_training(a, ctx) {
    const tr = training(); if (!tr) return { ok: false, error: '现在设置的是不做力训' };
    const d = today();
    if (Array.isArray(a.group_ids) && a.group_ids.length) {
      const groups = [];
      tr.days.forEach((dd, di) => dd.groups.forEach(g => { if (a.group_ids.includes(g.id) && !groups.some(x => x.gid === g.id)) groups.push({ dayIdx: di, gid: g.id }); }));
      if (!groups.length) return { ok: false, error: 'group_ids 不在当前分化里，先 get_my_plan 看有哪些' };
      const names = groups.map(x => tr.days[x.dayIdx].groups.find(g => g.id === x.gid).name);
      if (!await ctx.confirm('换今天的训练', [`自选：${names.join('、')}`], a.reason)) return { ok: false, error: '用户取消了' };
      rec(d).session = { custom: true, split: tr.split.key, groups }; save(d);
    } else {
      const i = +a.day_index;
      if (!(i >= 0 && i < tr.days.length)) return { ok: false, error: `day_index 要在 0-${tr.days.length - 1}` };
      if (!await ctx.confirm('换今天的训练', [`今天练：${tr.days[i].name}`], a.reason)) return { ok: false, error: '用户取消了' };
      rec(d).session = { split: tr.split.key, dayIdx: i }; save(d);
    }
    return { ok: true, today: todayInfo({}).training };
  },
  async exercise_info(a, ctx) {
    let v = a.exercise_id && window.EX[a.exercise_id] ? a.exercise_id : null;
    if (!v && a.name) { const q = String(a.name); v = Object.keys(window.EX).find(k => window.EX[k].n === q) || Object.keys(window.EX).find(k => window.EX[k].n.includes(q) || q.includes(window.EX[k].n)); }
    if (!v) return { error: '动作库里没有找到，先用 list_exercises 看有哪些' };
    const ex = window.EX[v], lib = LIB[v] || {};
    const extra = ex.ext ? { source: `补充动作（${ex.kindName}）`, basis: ex.basis } : { source: '套表' };
    const usableNow = window.exUsable(ex, S.profile.equip && S.profile.equip.length ? S.profile.equip : null, S.profile.avoid || []);
    const alts = Object.values(window.ENTRY || {}).find(list => list.includes(v)) || [];
    return { exercise_id: v, name: ex.n, ...extra, usable_for_user: usableNow, equipment: ex.eq, multi_joint: !!ex.multi, avoid_failure: !!ex.noFail, group: lib.group, part: lib.part, src: lib.src,
      extra_alternatives: (window.EXT_ALTS[lib.gid] || []).filter(x => x !== v).map(x => window.EX[x].n),
      alternatives_same_entry: alts.filter(x => x !== v).map(x => window.EX[x] ? window.EX[x].n : x),
      rest_rule: ex.multi ? '多关节动作组间休息 2-3 分钟（表21 C11）' : '单关节动作组间休息 1-1.5 分钟（表21 C11）',
      failure_rule: ex.noFail ? '自由卧推/深蹲/推举这类可能砸伤的动作不追求完全力竭，提前一两个停（表21 C13）' : '无危险动作可以做到力竭（表21 C13）',
      bilibili_search: 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(ex.n + ' 教程') };
  },
  async video_links(a, ctx) {
    const topic = String(a.topic || '').trim(), rows = window.KB.rows.filter(r => /BV[0-9A-Za-z]{10}/.test(r.t));
    const seen = new Set(), vids = [];
    rows.forEach(r => (r.t.match(/[^｜/。；]*?BV[0-9A-Za-z]{10}[^｜/。；]*/g) || []).forEach(seg => { const bv = seg.match(/BV[0-9A-Za-z]{10}/)[0]; if (!seen.has(bv + seg.slice(0, 20))) { seen.add(bv + seg.slice(0, 20)); vids.push({ url: 'https://www.bilibili.com/video/' + bv, context: seg.trim().slice(0, 120), src: srcOf(r) }); } }));
    const tw = terms(topic);
    vids.forEach(x => x.score = tw.reduce((sc, w) => sc + (x.context.includes(w) ? w.length : 0), 0));
    vids.sort((p, q) => q.score - p.score);
    return { excel_videos: vids.slice(0, 5), bilibili_search: topic ? 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(topic + ' 教程') : null,
      note: '套表作者的视频有：新手完全训练手册 BV1Hk4y187jF、骨肌解剖与健身运用 BV1mM6JY6Ei9、饮食配套视频 BV1zu4m1N76R（表21 C4、表17 第32行）；具体动作教程按表21 C4 在 B站 搜动作名称' };
  },
  async edit_timeline(a, ctx) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : today(), info = dayInfo(d), scope = a.scope === 'always' ? 'tpl' : 'day';
    const { tasks } = tasksFor(d), t = tasks.find(x => x.id === a.item_id), label = scope === 'tpl' ? `以后每个${TYPE[info.type][0]}` : d;
    let line;
    if (a.action === 'remove') { if (!t) return { ok: false, error: '这一天没有这个 item_id，先 get_today' }; line = `删掉“${t.title}”`; }
    else if (a.action === 'restore') { if (!hiddenOf(d).some(x => x.item_id === a.item_id)) return { ok: false, error: '这一项没有被删掉' }; line = `恢复 ${a.item_id}`; }
    else if (a.action === 'set_time') { if (!t || !/^\d{1,2}:\d{2}$/.test(a.time || '')) return { ok: false, error: '需要有效的 item_id 和 HH:MM 时间' }; line = `“${t.title}” ${t.time} → ${a.time.padStart(5, '0')}`; }
    else if (a.action === 'add') { if (!a.title || !/^\d{1,2}:\d{2}$/.test(a.time || '')) return { ok: false, error: '需要 title 和 HH:MM 时间' }; line = `在 ${a.time.padStart(5, '0')} 加“${a.title}”`; }
    else return { ok: false, error: 'action 不认识' };
    if (!await ctx.confirm('修改安排', [line, `范围：${label}`], a.reason)) return { ok: false, error: '用户取消了' };
    const layer = () => { if (scope === 'tpl') return S.custom.timeline[info.type] || (S.custom.timeline[info.type] = { hide: [], add: [] }); const r = rec(d); return r.tl || (r.tl = { hide: [], add: [] }); };
    const L = layer(); L.hide = L.hide || []; L.add = L.add || [];
    if (a.action === 'remove') { if (t.custom && L.add.some(x => x.id === t.id)) L.add = L.add.filter(x => x.id !== t.id); else if (!L.hide.includes(t.id)) L.hide.push(t.id); }
    if (a.action === 'restore') { [S.custom.timeline[info.type], (peek(d) || {}).tl].forEach(x => { if (x && x.hide) x.hide = x.hide.filter(id => id !== a.item_id); }); }
    if (a.action === 'set_time') setTaskTime(d, t.id, a.time.padStart(5, '0'), scope);
    if (a.action === 'add') L.add.push({ id: 'c-' + uid(), time: a.time.padStart(5, '0'), title: a.title, note: a.note || '', sub: a.note || '', kind: 'habit', optional: false });
    if (scope === 'tpl') saveCustom(); save(d); scoreDay(d);
    if (window.Me && Me.scheduleNotifs) Me.scheduleNotifs();
    return { ok: true, done: line, now: todayInfo({ date: d }).timeline.map(x => `${x.time} ${x.title}`), meals: todayInfo({ date: d }).meals };
  },
  async set_meal_amounts(a, ctx) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : today();
    if (a.reset) {
      if (!await ctx.confirm('调整分量', [`${d} 各餐恢复按计划的分量`], a.reason)) return { ok: false, error: '用户取消了' };
      const r = rec(d); delete r.mealAmt; save(d); return { ok: true, meals: todayInfo({ date: d }).meals };
    }
    const cur = tasksFor(d).meals, list = (a.meals || []).filter(x => cur.some(m => m.key === x.meal_key));
    if (!list.length) return { ok: false, error: 'meal_key 不对，先 get_today 看 meals' };
    const after = cur.map(m => { const x = list.find(y => y.meal_key === m.key); return { m, c: x && x.carbs_g != null ? Math.round(x.carbs_g) : m.c, p: x && x.protein_g != null ? Math.round(x.protein_g) : m.p }; });
    const sumC = after.reduce((t, x) => t + x.c, 0), sumP = after.reduce((t, x) => t + x.p, 0), tc = cur.reduce((t, m) => t + m.c, 0), tp = cur.reduce((t, m) => t + m.p, 0);
    const lines = after.filter(x => x.c !== x.m.c || x.p !== x.m.p).map(x => `${x.m.name}：碳水 ${x.m.c}→${x.c}g，蛋白质 ${x.m.p}→${x.p}g`);
    if (!lines.length) return { ok: false, error: '分量没有变化' };
    const warn = Math.abs(sumC - tc) > tc * 0.05 || Math.abs(sumP - tp) > tp * 0.05 ? `注意：全天合计变成碳水 ${sumC}g（计划 ${tc}g）、蛋白质 ${sumP}g（计划 ${tp}g），和套表配额不一致` : '';
    if (!await ctx.confirm('调整分量', lines.concat(warn ? [warn] : []), a.reason)) return { ok: false, error: '用户取消了' };
    const r = rec(d); r.mealAmt = r.mealAmt || {};
    after.forEach(x => { if (x.c !== x.m.c || x.p !== x.m.p) r.mealAmt[x.m.key] = { c: x.c, p: x.p, note: '当天调整过：' + String(a.reason || '').slice(0, 40) }; });
    save(d);
    return { ok: true, changed: lines, warning: warn || null, meals: todayInfo({ date: d }).meals };
  },
  async set_day_training(a, ctx) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : '';
    if (!d) return { ok: false, error: 'date 要是 YYYY-MM-DD' };
    if (a.type === 'lift' && S.profile.lift === false) return { ok: false, error: '现在设置的是不做力训' };
    const before = dayInfo(d).lift ? '力训日' : '休息日';
    const what = a.type === 'lift' ? '这天加练' : a.type === 'rest' ? '这天不练' : '恢复按计划';
    if (!await ctx.confirm('安排训练日', [`${d}（周${DOW[E.dow(d)]}）：${before} → ${what}`], a.reason)) return { ok: false, error: '用户取消了' };
    const r = rec(d); if (a.type === 'auto') delete r.override; else r.override = a.type; save(d); scoreDay(d);
    if (window.Me && Me.scheduleNotifs) Me.scheduleNotifs();
    return { ok: true, date: d, now: dayInfo(d).lift ? '力训日' : '休息日', eat_kcal: C.targetOf(d).kcal };
  },
};

/* ---------- 训练：顺序、每个动作的参数、换动作；训练记录（AI 的训练记忆）；身体数据；AI 记忆 ---------- */
const scopeLabel = (si, scope) => scope === 'always' ? `以后每次练“${si.custom ? '自选部位' : si.day.name}”都这样` : '只改今天';
function applyMods(d, si, scope, fn) {
  if (scope === 'always') { S.custom.train[si.key] = S.custom.train[si.key] || {}; fn(S.custom.train[si.key]); saveCustom(); return; }
  const r = rec(d); r.ex = r.ex || {};
  if (!r.session) r.session = si.custom ? { custom: true, split: training().split.key, groups: si.groups } : { split: training().split.key, dayIdx: si.dayIdx };
  fn(r.ex); save(d);
}
function trainingLog(a) {
  const n = Math.max(7, Math.min(+a.days || 60, 365)), from = E.addDays(today(), -n), by = {};
  allDays().filter(d => d >= from).forEach(d => {
    const r = peek(d); if (!r || !r.sets) return;
    Object.entries(r.sets).forEach(([v, sets]) => {
      const ok = (sets || []).filter(x => x && (+x.w > 0 || +x.r > 0)); if (!ok.length) return;
      (by[v] = by[v] || []).push({ date: d, sets: ok.map(x => `${+x.w || 0}kg×${+x.r || '?'}`).join('，'), top_kg: Math.max(...ok.map(x => +x.w || 0)) });
    });
  });
  if (a.exercise_id) {
    const v = a.exercise_id; if (!window.EX[v]) return { ok: false, error: '没有这个 exercise_id' };
    const it = sessionItems(today()).items.find(x => x.v === v) || C.extraItem(v), sg = C.suggestFor(it, today());
    return { exercise: window.EX[v].n, rep_range: it.reps, sessions: (by[v] || []).slice(-10),
      next_suggestion: sg ? `${sg.w ? sg.w + 'kg × ' : ''}${sg.r} 次（${sg.why}）` : '没有记录：先用能做 12-15 次的配重适应（表21 C12）' };
  }
  const list = Object.entries(by).map(([v, x]) => ({ exercise_id: v, name: window.EX[v] ? window.EX[v].n : v, times: x.length, last: x[x.length - 1], best_kg: Math.max(...x.map(y => y.top_kg)) }));
  return { days: n, exercises: list, note: list.length ? '建议重量的规则：上次每组都做到次数上限就加一档，有一组不到下限就减一档（表21 C12：配重选能做 8-12 次力竭的）' : '这段时间还没有记录重量' };
}
const DEFS_MORE = [
  { name: 'get_training_log', description: '读取用户练过的重量和次数（训练记录）：不给 exercise_id 时列出每个动作最近一次和最重的一组；给了就列出这个动作最近几次的每一组和下次的建议重量。', parameters: { type: 'object', properties: { exercise_id: { type: 'string' }, days: { type: 'integer', description: '看多少天，默认 60' } } } },
  { name: 'reorder_training', description: '调整今天训练动作的顺序：order 给出完整的 exercise_id 顺序；或者 exercise_id + position（从 1 开始）把一个动作挪到第几个。scope=today 只改今天，always 以后练这一天都这样。会先让用户确认。', parameters: { type: 'object', properties: {
    order: { type: 'array', items: { type: 'string' } }, exercise_id: { type: 'string' }, position: { type: 'integer' }, scope: { type: 'string', enum: ['today', 'always'] }, reason: { type: 'string' } }, required: ['scope'] } },
  { name: 'set_exercise_params', description: '调整一个动作的每组次数、组间休息、要不要做到力竭、重量怎么记（杠铃填每边的片/单只/配重/自重）和杆重（对这个动作一直有效），reset=true 恢复套表默认。套表规则：配重选能做 8-12 次力竭的、女性 10-15、适应新动作 12-15（表21 C12/C14），多关节组间休息 2-3 分钟、单关节 1-1.5 分钟（表21 C11），自由卧推/深蹲/推举不做到完全力竭（表21 C13）；和套表不同时在 reason 里说明。会先让用户确认。', parameters: { type: 'object', properties: {
    exercise_id: { type: 'string' }, reps: { type: 'string', description: '例如 "10-12"' }, rest: { type: 'string', description: '例如 "90 秒"、"2-3 分钟"' }, to_failure: { type: 'boolean' },
    load: { type: 'string', enum: ['bar', 'db', 'stack', 'none'], description: '重量怎么记：bar 杠铃类（填每边的片，杆重另算）、db 单只、stack 器械配重、none 自重只记次数' }, bar_kg: { type: 'number', description: 'load=bar 时的杆重' },
    reset: { type: 'boolean' }, reason: { type: 'string' } }, required: ['exercise_id'] } },
  { name: 'swap_exercise', description: '把今天训练里的一个动作换成另一个（最好是 exercise_info 里同一肌群的备选），以后练这一天也用新动作。会先让用户确认。', parameters: { type: 'object', properties: { from_id: { type: 'string' }, to_id: { type: 'string' }, reason: { type: 'string' } }, required: ['from_id', 'to_id'] } },
  { name: 'log_body', description: '记某天（默认今天）的身体数据：weight 体重 kg、waist 腰围、hip 臀围、chest 胸围、arm 臂围、thigh 大腿围（cm）、fat 体脂率 %。会先让用户确认。', parameters: { type: 'object', properties: {
    date: { type: 'string' }, weight: { type: 'number' }, waist: { type: 'number' }, hip: { type: 'number' }, chest: { type: 'number' }, arm: { type: 'number' }, thigh: { type: 'number' }, fat: { type: 'number' }, reason: { type: 'string' } } } },
  { name: 'remember', description: '记住用户长期有效的信息（伤病、器械、作息、饮食习惯、目标、偏好……），以后回答都会带上。用户说“记住…”或者透露了这类信息时调用，一次一条，写成简短的陈述句（例如“左膝半月板受过伤，不做深蹲”）。不用确认。', parameters: { type: 'object', properties: { text: { type: 'string' }, tag: { type: 'string', enum: ['health', 'gear', 'time', 'food', 'goal', 'other'] } }, required: ['text'] } },
  { name: 'forget', description: '删除 AI 记忆（用户说“忘掉…”“这个不对了”时）。id 从记忆列表里取，或者给 text 按内容找。', parameters: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } } } },
  { name: 'list_memory', description: '列出所有 AI 记忆。', parameters: { type: 'object', properties: {} } },
];
Object.assign(STEP_TEXT, { get_training_log: a => `看训练记录${a.exercise_id && window.EX[a.exercise_id] ? '：' + window.EX[a.exercise_id].n : ''}`, reorder_training: () => '准备调整动作顺序', set_exercise_params: a => `准备调整动作：${window.EX[a.exercise_id] ? window.EX[a.exercise_id].n : ''}`,
  swap_exercise: () => '准备换动作', log_body: () => '准备记身体数据', remember: a => `记住：${String(a.text || '').slice(0, 30)}`, forget: () => '删除记忆', list_memory: () => '看记忆' });
Object.assign(RUN, {
  async get_training_log(a) { return trainingLog(a); },
  async reorder_training(a, ctx) {
    if (!S.plan.training) return { ok: false, error: '现在设置的是不做力训' };
    const d = today(), { si, items } = sessionItems(d), ids = items.map(x => x.v);
    let order;
    if (Array.isArray(a.order) && a.order.length) { const known = [...new Set(a.order.filter(v => ids.includes(v)))]; if (!known.length) return { ok: false, error: 'order 里的动作都不在今天的训练里，先 get_today' }; order = known.concat(ids.filter(v => !known.includes(v))); }
    else if (a.exercise_id && a.position) { if (!ids.includes(a.exercise_id)) return { ok: false, error: '今天的训练里没有这个动作' }; order = ids.filter(v => v !== a.exercise_id); order.splice(Math.max(0, Math.min(order.length, a.position - 1)), 0, a.exercise_id); }
    else return { ok: false, error: '给 order，或者 exercise_id + position' };
    if (order.join() === ids.join()) return { ok: false, error: '顺序没有变化' };
    if (!await ctx.confirm('调整动作顺序', order.map((v, i) => `${i + 1}. ${window.EX[v].n}`).concat([`范围：${scopeLabel(si, a.scope)}`]), a.reason)) return { ok: false, error: '用户取消了' };
    applyMods(d, si, a.scope, m => { m.order = order; });
    return { ok: true, done: '顺序已调整', today_exercises: sessionItems(d).items.map(x => x.ex.n) };
  },
  async set_exercise_params(a, ctx) {
    const v = a.exercise_id, ex = window.EX[v]; if (!ex) return { ok: false, error: '没有这个 exercise_id' };
    const it = sessionItems(today()).items.find(x => x.v === v) || C.extraItem(v), def = it.def || it, cur = Object.assign({}, (S.custom.exCfg || {})[v] || {});
    S.custom.exCfg = S.custom.exCfg || {};
    if (a.reset) {
      if (!S.custom.exCfg[v]) return { ok: false, error: '这个动作没有改过' };
      if (!await ctx.confirm('调整动作：' + ex.n, [`恢复套表默认：${def.reps} 次，休息 ${def.rest}，${def.fail}`], a.reason)) return { ok: false, error: '用户取消了' };
      delete S.custom.exCfg[v]; saveCustom(); return { ok: true, done: '已恢复套表默认' };
    }
    const cfg = Object.assign({}, cur), lines = [];
    if (a.reps != null) { const m = String(a.reps).match(/^(\d+)\s*[-~到至]\s*(\d+)$/); if (!m || +m[1] < 1 || +m[2] < +m[1] || +m[2] > 50) return { ok: false, error: 'reps 要写成 "8-12"' }; cfg.reps = `${m[1]}-${m[2]}`; if (cfg.reps !== it.reps) lines.push(`每组次数：${it.reps} → ${cfg.reps}`); }
    if (a.rest != null && String(a.rest).trim()) { cfg.rest = String(a.rest).trim().slice(0, 20); if (cfg.rest !== it.rest) lines.push(`组间休息：${it.rest} → ${cfg.rest}`); }
    if (a.to_failure != null) { cfg.fail = !!a.to_failure; const was = !/不追求/.test(it.fail); if (cfg.fail !== was) lines.push(`做到力竭：${was ? '是' : '否'} → ${cfg.fail ? '是' : '否'}`); }
    if (a.load != null) { const was = C.loadOf(ex, v); cfg.load = a.load; if (a.load !== was.mode) lines.push(`重量怎么记：${C.LOADS[was.mode]} → ${C.LOADS[a.load]}`); }
    if (a.bar_kg != null && +a.bar_kg >= 0 && +a.bar_kg <= 60) { const was = C.loadOf(ex, v).bar; cfg.bar = +a.bar_kg; if (+a.bar_kg !== was) lines.push(`杆重：${was}kg → ${a.bar_kg}kg`); }
    if (!lines.length) return { ok: false, error: '和现在一样，不用改' };
    if (ex.noFail && cfg.fail) lines.push('注意：套表建议这个动作不要做到完全力竭，提前 1-2 次停（表21 C13）');
    lines.push(`套表默认：${def.reps} 次、休息 ${def.rest}`);
    if (!await ctx.confirm('调整动作：' + ex.n, lines, a.reason)) return { ok: false, error: '用户取消了' };
    S.custom.exCfg[v] = cfg; saveCustom();
    const now = sessionItems(today()).items.find(x => x.v === v) || it;
    return { ok: true, done: lines.slice(0, -1).join('；'), now: { reps: now.reps, rest: now.rest, fail: now.fail } };
  },
  async swap_exercise(a, ctx) {
    if (!S.plan.training) return { ok: false, error: '现在设置的是不做力训' };
    const d = today(), { si, items } = sessionItems(d), it = items.find(x => x.v === a.from_id), to = window.EX[a.to_id];
    if (!it) return { ok: false, error: '今天的训练里没有 from_id 这个动作，先 get_today' };
    if (!to) return { ok: false, error: '没有 to_id 这个动作，先 list_exercises' };
    if (items.some(x => x.v === a.to_id)) return { ok: false, error: `${to.n} 今天已经有了` };
    if (!await ctx.confirm('换动作', [`${it.ex.n} → ${to.n}`, `${it.sets} 组；${scopeLabel(si, 'always')}`], a.reason)) return { ok: false, error: '用户取消了' };
    C.swapExercise(d, si, it.v, a.to_id);
    return { ok: true, done: `${it.ex.n} 换成了 ${to.n}`, today_exercises: sessionItems(d).items.map(x => x.ex.n) };
  },
  async log_body(a, ctx) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : today();
    if (d > today()) return { ok: false, error: '不能记以后的数据' };
    const vals = {}, lines = [], errs = [], r0 = peek(d) || {};
    C.METRICS.forEach(m => { if (a[m.id] == null || a[m.id] === '') return; const v = +a[m.id]; if (!(v >= m.min && v <= m.max)) { errs.push(`${m.name}要在 ${m.min}-${m.max} 之间`); return; } vals[m.id] = String(Math.round(v * 10) / 10); lines.push(`${m.name}：${r0[m.id] || '—'} → ${vals[m.id]} ${m.unit}`); });
    if (errs.length) return { ok: false, error: errs.join('；') };
    if (!lines.length) return { ok: false, error: '没有要记的数' };
    if (!await ctx.confirm('记身体数据 · ' + (d === today() ? '今天' : d), lines, a.reason, '记上')) return { ok: false, error: '用户取消了' };
    const r = rec(d); Object.assign(r, vals); if (vals.weight) r.done.weigh = true; save(d); scoreDay(d);
    // 记了没在“每日记录”里勾的项：顺手勾上，数据页能看到曲线
    const extra = Object.keys(vals).filter(k => k !== 'weight' && !(S.profile.track || []).includes(k));
    if (extra.length) { S.profile = Object.assign({}, S.profile, { track: (S.profile.track || []).concat(extra) }); LS.set('profile', S.profile); }
    return { ok: true, done: lines.join('；') };
  },
  async remember(a) { const it = Memory.add(a.text, a.tag, 'ai'); return it ? { ok: true, id: it.id, saved: it.text } : { ok: false, error: '内容太短' }; },
  async forget(a) {
    if (a.id) return Memory.remove(a.id) ? { ok: true, done: '已删除' } : { ok: false, error: '没有这条记忆' };
    const hit = Memory.forget(a.text || ''); return hit.length ? { ok: true, removed: hit.map(x => x.text) } : { ok: false, error: '没找到相关的记忆' };
  },
  async list_memory() { return { items: Memory.list().map(x => ({ id: x.id, tag: Memory.TAGS[x.tag] || '其他', text: x.text, date: new Date(x.ts).toISOString().slice(0, 10) })) }; },
});
TOOLS.push(...DEFS_MORE);
// 注册到 harness：查询类工具先确保知识库已经加载
TOOLS.forEach(t => Harness.define({ ...t, write: WRITE.has(t.name), step: STEP_TEXT[t.name], run: async (a, ctx) => { if (!WRITE.has(t.name)) await loadKB().catch(() => {}); return RUN[t.name](a, ctx); } }));

return { loadKB, terms, srcOf, todayInfo, hiddenOf, myPlan, logFood, trainingLog, LABEL, show };
})();
