/* 核心：存储、每天的卡片、训练、能量计算、奖励（界面文件共用） */
window.C = (() => {
const APP_VERSION = '26.10.3';
const REPO = 'ABigCyan/lianchi-daily';
const E = window.Engine;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* 一天从凌晨 4 点开始：0:00-3:59 仍算前一天（熬夜、夜宵、半夜的提醒都归到前一天） */
const DAY_START = 4 * 60;
const today = () => E.ds(new Date(Date.now() - DAY_START * 60000));
/* 一天之内排序用的分钟数：4 点以前的时间排到最后 */
const dayMin = t => { const m = E.tm(t); return m < DAY_START ? m + 1440 : m; };
const DOW = ['一', '二', '三', '四', '五', '六', '日'];
const uid = () => Math.random().toString(36).slice(2, 9);
const src = (s, app) => s ? `<span class="src${app ? ' app' : ''}">${esc(s)}</span>` : '';

/* ---------- 存储 ---------- */
const LS = {
  get(k) { try { const v = localStorage.getItem('lcd:' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('lcd:' + k, JSON.stringify(v)); } catch (e) { toast('手机存储空间不足，数据没保存'); } },
  all() { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('lcd:')) o[k] = localStorage.getItem(k); } return o; },
};
const S = {
  profile: null, plan: null, tab: 'today', day: today(), months: {}, sub: null, edit: false, open: {},
  holidays: LS.get('holidays') || {},
  ai: LS.get('ai') || { preset: 'dashscope', type: 'openai', base: AI.PRESETS[0].base, key: '', model: '', models: [] },
  choices: LS.get('choices') || {},
  custom: Object.assign({ timeline: {}, train: {}, exCfg: {} }, LS.get('custom') || {}),
  notify: LS.get('notify') || { on: false },
};
function month(ym) { if (!S.months[ym]) S.months[ym] = LS.get('m:' + ym) || {}; return S.months[ym]; }
function peek(d) { return month(d.slice(0, 7))[d]; }
function rec(d) { const m = month(d.slice(0, 7)); return m[d] || (m[d] = { done: {} }); }
const saveT = {};
function save(d) { const ym = d.slice(0, 7); clearTimeout(saveT[ym]); saveT[ym] = setTimeout(() => { delete saveT[ym]; LS.set('m:' + ym, S.months[ym]); }, 200); }
// 切到后台 / 被关掉前，把还没写的立刻写进去（不然最后 0.2 秒内的改动会丢）
function flushSaves() { Object.keys(saveT).forEach(ym => { clearTimeout(saveT[ym]); delete saveT[ym]; LS.set('m:' + ym, S.months[ym]); }); }
addEventListener('pagehide', flushSaves); document.addEventListener('visibilitychange', () => { if (document.hidden) flushSaves(); });
function saveCustom() { LS.set('custom', S.custom); }
function allDays(to) { const out = []; const end = to || today(); for (let d = S.profile.startDate; d <= end; d = E.addDays(d, 1)) out.push(d); return out; }

/* ---------- 图标 ---------- */
const ICON = {
  train: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/></svg>',
  food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 11h16a8 8 0 0 1-16 0zM8 7c0-1 1-1.5 1-3M12 7c0-1 1-1.5 1-3M16 7c0-1 1-1.5 1-3"/></svg>',
  cardio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
  habit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9a4 4 0 0 1 6 0M12 9l1.5 2"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
};

/* ---------- 每一天 ---------- */
function holiday(d) { return E.holidayOf(d, S.holidays); }
function dayInfo(d) {
  const p = S.profile, r = peek(d) || {};
  const h = holiday(d);
  let lift = E.plannedLift(p, d, S.holidays);
  if (r.override === 'lift' && p.lift !== false) lift = true;
  if (r.override === 'rest') lift = false;
  const cardio = E.plannedCardio(p, d, S.holidays);
  const type = lift ? 'lift' : cardio.length ? 'cardio' : (h && h.off ? 'holiday' : 'rest');
  return { h, lift, cardio, type };
}
const TYPE = { lift: ['力训日', 'train'], cardio: ['有氧日', 'cardio'], rest: ['休息日', 'rest'], holiday: ['节假日', 'holiday'] };
function baseTasks(d, info) {
  const p = S.profile, T = [];
  const cardioStart = E.tm(p.cardioTime || '18:30');
  const cardioMin = info.cardio.reduce((s, a) => s + (+a.minutes || 0), 0);
  const meals = E.mealsFor(p, S.plan, info.lift, { cardioEnd: info.cardio.length && !info.lift ? cardioStart + cardioMin : 0 });
  T.push({ id: 'weigh', time: p.wake, title: '称体重', sub: '起床后、吃东西前', kind: 'habit', icon: 'scale' });
  meals.forEach(m => T.push({ id: 'meal-' + m.key, time: m.time, title: m.name, sub: `碳水 ${m.c}g · 蛋白质 ${m.p}g`, kind: 'food', meal: m, optional: m.optional }));
  if (info.lift) T.push({ id: 'lift', time: p.liftTime, title: '力训：' + sessionInfo(d).name, sub: '', kind: 'train' });
  info.cardio.forEach((a, i) => {
    const t = info.lift ? E.mt(E.tm(p.liftTime) + 90) : E.mt(cardioStart + info.cardio.slice(0, i).reduce((s, x) => s + (+x.minutes || 0), 0));
    const kcal = E.cardioPerHour(a, p.weight).kcal * (+a.minutes || 0) / 60;
    T.push({ id: 'cardio-' + i, time: t, title: a.kind, kind: 'cardio', act: a, kcal: Math.round(kcal),
      sub: `${a.kind === '跑步' ? a.pace + ' 分配速 · ' : ''}${info.lift ? '不超过 30 分钟' : a.minutes + ' 分钟'} · 约 ${Math.round(info.lift ? Math.min(kcal, kcal * 30 / (+a.minutes || 30)) : kcal)} kcal` });
  });
  T.push({ id: 'sleep', time: E.mt(E.tm(p.sleep) - 30), title: '准备睡觉', sub: `${p.sleep} 前睡着`, kind: 'habit', icon: 'moon' });
  return { T, meals };
}
/* 卡片修改：模板层（以后每天都这样，按日子类型）+ 当天层 */
function tlMods(d, type) {
  const tpl = S.custom.timeline[type] || { hide: [], add: [] };
  const day = (peek(d) || {}).tl || { hide: [], add: [] };
  return { hide: new Set([...(tpl.hide || []), ...(day.hide || [])]), add: [...(tpl.add || []), ...(day.add || [])], tplAdd: new Set((tpl.add || []).map(a => a.id)), time: Object.assign({}, tpl.time || {}, day.time || {}) };
}
function tasksFor(d) {
  const info = dayInfo(d);
  const { T, meals } = baseTasks(d, info);
  const mods = tlMods(d, info.type);
  let tasks = T.filter(t => !mods.hide.has(t.id));
  mods.add.forEach(a => { if (!mods.hide.has(a.id)) tasks.push({ ...a, custom: true, tpl: mods.tplAdd.has(a.id) }); });
  tasks.forEach(t => { if (mods.time[t.id]) { t.baseTime = t.time; t.time = mods.time[t.id]; } });
  // 排序：一天从凌晨 4 点开始，00:30 的夜宵算前一天的深夜，排在最后
  const key = dayMin;
  tasks.forEach((t, i) => t._i = i);
  tasks.sort((a, b) => key(a.time) - key(b.time) || (mods.time[b.id] ? 1 : 0) - (mods.time[a.id] ? 1 : 0) || a._i - b._i);
  // 饮食页和时间线用同一份餐次：删掉的餐不出现，改过的时间同步，分量按下面的规则调整
  const shown = adjustMeals(d, meals, mods, info);
  tasks.forEach(t => { if (t.kind === 'food' && t.meal) { const m = shown.find(x => x.key === t.meal.key); if (m) { m.time = t.time; t.meal = m; t.sub = `碳水 ${m.c}g · 蛋白质 ${m.p}g${m.adj ? ' · 已调整' : ''}`; } } });
  shown.sort((a, b) => key(a.time) - key(b.time));
  return { info, tasks, meals: shown, key };
}
/* 删掉的餐：分量并到其他餐。零食/夜宵按表5 B89“不吃的话，就在其他各餐多吃几口瘦肉或主食”；其他餐同样按比例并入（应用补充）。
   当天手动调整过的分量（助手或用户改的）最后覆盖，全天合计仍按计划。 */
function adjustMeals(d, meals, mods, info) {
  const keep = meals.filter(m => !mods.hide.has('meal-' + m.key)).map(m => ({ ...m, notes: [] }));
  const gone = meals.filter(m => mods.hide.has('meal-' + m.key));
  if (!keep.length) return keep;
  const spread = (k, amt, pick) => {
    const tgt = keep.filter(pick); const base = tgt.reduce((s, m) => s + m[k], 0);
    if (!tgt.length || !amt) return;
    let left = amt;
    tgt.forEach((m, i) => { const add = i === tgt.length - 1 ? left : Math.round(amt * (base ? m[k] / base : 1 / tgt.length)); m[k] += add; left -= add; });
  };
  gone.forEach(g => {
    spread('c', g.c, m => m.role !== 'snack');
    spread('p', g.p, m => m.p > 0 && m.role !== 'snack');
    keep.forEach(m => m.notes.push(g.role === 'snack' ? '含不吃零食/夜宵并入的分量（表5 B89）' : `含${g.name}并入的分量（应用补充）`));
    keep.forEach(m => m.adj = true);
  });
  const amt = (peek(d) || {}).mealAmt || {};
  keep.forEach(m => { const o = amt[m.key]; if (o) { if (o.c != null) m.c = Math.max(0, Math.round(+o.c)); if (o.p != null) m.p = Math.max(0, Math.round(+o.p)); if (o.note) m.notes.push(o.note); m.adj = true; } });
  keep.forEach(m => { if (m.adj) m.foods = E.foodsFor(m, S.profile, S.plan); });
  return keep;
}
function setTaskTime(d, id, time, scope) { // time 为 null 时恢复默认
  const set = o => { if (time) o[id] = time; else delete o[id]; };
  if (scope === 'tpl') {
    const type = dayInfo(d).type; const m = S.custom.timeline[type] || (S.custom.timeline[type] = { hide: [], add: [] }); m.time = m.time || {}; set(m.time); saveCustom();
    // 这一天单独改过的时间会盖住“以后都这样”，所以一并清掉
    const r = peek(d); if (r && r.tl && r.tl.time && id in r.tl.time) { delete r.tl.time[id]; save(d); }
  } else { const r = rec(d); r.tl = r.tl || { hide: [], add: [] }; r.tl.time = r.tl.time || {}; set(r.tl.time); save(d); }
}
function scoreDay(d) {
  const r = rec(d), { tasks } = tasksFor(d);
  const req = tasks.filter(t => !t.optional);
  r.score = { done: req.filter(t => r.done[t.id]).length, total: req.length };
  save(d);
}
function pctOf(r) { return r && r.score && r.score.total ? r.score.done / r.score.total : 0; }

/* ---------- 训练 ---------- */
function training() { return S.plan.training; }
function sessionInfo(d) {
  const tr = training(); const r = peek(d) || {};
  if (r.session) {
    if (r.session.custom) return { custom: true, name: '自选部位', groups: r.session.groups, key: 'custom' };
    const i = r.session.dayIdx % tr.days.length;
    return { dayIdx: i, name: tr.days[i].name, day: tr.days[i], key: tr.split.key + ':' + i };
  }
  const i = nextDayIdx(d);
  return { dayIdx: i, name: tr.days[i].name, day: tr.days[i], recommended: true, key: tr.split.key + ':' + i };
}
function nextDayIdx(d) {
  const tr = training(), n = tr.days.length;
  for (let x = E.addDays(d, -1), i = 0; i < 120 && x >= S.profile.startDate; i++, x = E.addDays(x, -1)) {
    const r = peek(x);
    if (r && r.done && r.done.lift && r.session && !r.session.custom && r.session.split === tr.split.key) return (r.session.dayIdx + 1) % n;
  }
  return 0;
}
function roundsBefore(d, pred) { let n = 0; allDays(E.addDays(d, -1)).forEach(x => { const r = peek(x); if (r && r.done && r.done.lift && r.session && pred(r.session)) n++; }); return n; }
function weekOf(d) { return Math.floor((E.pd(d) - E.pd(S.profile.startDate)) / 864e5 / 7) + 1; }
/* 动作库：套表分化里出现过的动作 → 所属肌群与部位（原表出处）；再加上补充动作（标明依据） */
const LIB = (() => {
  const partOf = {}; window.PARTS.forEach(pt => pt.groups.forEach(g => partOf[g] = pt));
  const map = {}, gname = {};
  Object.values(window.SPLITS).filter(sp => !sp.ext).forEach(sp => sp.days.forEach(day => day.groups.forEach(g => { gname[g.id] = gname[g.id] || g.name; g.entries.forEach(e => window.ENTRY[e].forEach(v => {
    if (!map[v]) map[v] = { v, ex: window.EX[v], group: g.name, gid: g.id, part: (partOf[g.id] || {}).name || '其他', src: g.src };
  })); })));
  Object.entries(window.NEW_GROUPS || {}).forEach(([gid, [, n]]) => gname[gid] = n);
  (window.EXT_IDS || []).forEach(v => { const ex = window.EX[v], gid = ex.groups[0];
    map[v] = { v, ex, group: gname[gid] || gid, gid, part: (partOf[gid] || {}).name || '其他', src: `补充（${ex.kindName}）：${ex.basis}`, ext: true }; });
  return map;
})();
function extraItem(v, sets) {
  const p = S.profile, ex = window.EX[v], F = p.sex === 'F';
  const g = { id: 'extra-' + v, name: (LIB[v] || {}).group || '添加的动作', text: '你自己添加的动作', src: (LIB[v] || {}).src || '', sheet: 'extra' };
  return { group: g, v, ex, sets: sets || 3, reps: ex.timed ? '30-60 秒' : F ? '10-15' : '8-12', repsSrc: ex.timed ? '计时动作（应用补充）' : F ? '表21 C14' : '表21 C12',
    rest: ex.multi ? '2-3 分钟' : '1-1.5 分钟', fail: ex.noFail ? '不追求完全力竭，提前 1-2 次停' : '可以做到力竭', alts: [], added: true };
}
function exMods(d, key) {
  const tpl = S.custom.train[key] || {};
  const day = (peek(d) || {}).ex || {};
  // 两层：“以后都这样”（tpl）和“只改今天”（day）。今天加回来的动作，不受“以后都这样”里删掉的影响
  const dayAdd = new Set((day.add || []).map(a => a.v));
  return { hide: new Set([...(tpl.hide || []).filter(v => !dayAdd.has(v)), ...(day.hide || [])]), add: [...(tpl.add || []), ...(day.add || [])], sets: Object.assign({}, tpl.sets || {}, day.sets || {}),
    order: day.order || tpl.order || null, swap: Object.assign({}, tpl.swap || {}, day.swap || {}) };
}
/* 换动作：记在“以后都这样”里（原动作 → 新动作），换回原动作就去掉这条 */
function swapExercise(d, si, from, to) {
  const m = S.custom.train[si.key] || (S.custom.train[si.key] = {});
  m.swap = m.swap || {};
  const orig = Object.keys(m.swap).find(k => m.swap[k] === from) || from;
  if (to === orig) delete m.swap[orig]; else m.swap[orig] = to;
  replaceInOrder(d, si.key, from, to);
  saveCustom();
}
/* 加动作：两层的“删掉”里都去掉它，免得加不回来 */
function addExercises(d, si, scope, list, sets) {
  const r = peek(d), t = S.custom.train[si.key];
  [t, r && r.ex].forEach(m => { if (m && m.hide) m.hide = m.hide.filter(v => !list.includes(v)); });
  const layer = scope === 'tpl' || scope === 'always' ? (S.custom.train[si.key] || (S.custom.train[si.key] = {})) : (() => { const rr = rec(d); rr.ex = rr.ex || {}; if (!rr.session) rr.session = si.custom ? { custom: true, split: training().split.key, groups: si.groups } : { split: training().split.key, dayIdx: si.dayIdx }; return rr.ex; })();
  layer.add = (layer.add || []).filter(a => !list.includes(a.v)).concat(list.map(v => ({ v, sets: sets || 3 })));
  saveCustom(); save(d);
}
// 换动作后，排过的顺序里把旧动作换成新动作（新动作占旧动作的位置）
function replaceInOrder(d, key, from, to) {
  const ms = [S.custom.train[key], (peek(d) || {}).ex];
  ms.forEach(m => { if (m && m.order) m.order = m.order.map(v => v === from ? to : v); });
  saveCustom(); if (peek(d)) save(d);
}
/* ---------- 训练记录（用户数据）：每个动作以前练过的组，用来给出这次的建议重量 ---------- */
// 某个动作在某天之前最近一次有重量或次数的记录
function lastSession(v, before) {
  const days = allDays(E.addDays(before, -1));
  for (let i = days.length - 1; i >= 0; i--) {
    const s = ((peek(days[i]) || {}).sets || {})[v];
    const ok = (s || []).filter(x => x && (+x.w > 0 || +x.r > 0));
    if (ok.length) return { d: days[i], sets: ok.map(x => ({ w: +x.w || 0, r: +x.r || 0 })) };
  }
  return null;
}
// 以前做过哪些动作（打过勾或填过重量、次数），以及一共练过几次
function trainedBefore(d) {
  const seen = new Set(); let n = 0;
  allDays(E.addDays(d, -1)).forEach(x => { const r = peek(x); if (!r) return; if (r.done && r.done.lift) n++; Object.entries(r.sets || {}).forEach(([v, s]) => { if ((s || []).some(y => y && (y.done || +y.w > 0 || +y.r > 0))) seen.add(v); }); });
  return { seen, n };
}
/* 重量怎么记（每个动作可以在“调整”里改）：
   bar 杠铃类：填每边加的片，杆重另算（杠铃 20kg、EZ 杠 10kg、史密斯 15kg，可改），总重 = 杆 + 片 × 2；
   db 单只：哑铃、壶铃、杠铃片填单只的重量；stack 配重：器械、龙门架填插销那格的重量；none 自重：卷腹、平板支撑这类只记次数（或秒） */
const LOADS = { bar: '杆 + 片', db: '单只', stack: '配重', none: '自重' };
/* 杆重统一设置一次：所有杠铃类动作共用（卧推、深蹲、划船……），每组只填单边的片 */
const BAR_KINDS = [['bar', '杠铃杆', 20], ['ez', 'EZ 曲杆', 10], ['smith', '史密斯杆', 15]];
function barsOf() { const v = LS.get('bars') || {}; return Object.fromEntries(BAR_KINDS.map(([k, , d]) => [k, v[k] != null ? +v[k] : d])); }
function setBars(v) { LS.set('bars', Object.assign(barsOf(), v)); }
function loadOf(ex, v) {
  const c = (S.custom.exCfg || {})[v] || {}, e = ex.eq || '';
  let mode = c.load;
  if (!mode) mode = ex.timed || /徒手|瑜伽垫|健腹轮|平凳或|罗马椅|GHR|瑜伽球|弹力带/.test(e) || /^(单杠|双杠)/.test(e) ? 'none'
    : /杠铃片/.test(e) ? 'db' : /EZ|史密斯|杠铃/.test(e) ? 'bar' : /哑铃|壶铃/.test(e) ? 'db' : 'stack';
  const kind = /EZ/.test(e) ? 'ez' : /史密斯/.test(e) ? 'smith' : 'bar', bar = c.bar != null ? +c.bar : barsOf()[kind];
  return { mode, bar, label: { bar: `每边片 kg · 杆 ${bar}`, db: /杠铃片/.test(e) ? '杠铃片 kg' : '单只 kg', stack: '配重 kg', none: '自重，只记次数' }[mode] };
}
// 配重加减的幅度（应用补充：常见器械的最小加重档）
function stepKg(ex) { const e = ex.eq || ''; return /哑铃|壶铃/.test(e) ? 2 : /自重|徒手|单杠|双杠|弹力带|瑜伽球|健腹轮|垫|罗马椅|平凳或|GHR/.test(e) || !e ? 0 : 2.5; }
/* 这次的建议：按上次的重量和次数。表21 C12：配重要选“能做 8-12 次会力竭”的——
   上次每组都做到了次数上限 → 加一档；有一组没做到下限 → 减一档；否则不变 */
function suggestFor(it, d) {
  const last = lastSession(it.v, d);
  if (!last || it.ex.timed) return null;
  const m = String(it.reps).match(/(\d+)\s*-\s*(\d+)/), lo = m ? +m[1] : 8, hi = m ? +m[2] : 12;
  const reps = last.sets.map(x => x.r).filter(Boolean), st = stepKg(it.ex), w0 = Math.max(...last.sets.map(x => x.w));
  let w = w0, why = '和上次一样';
  if (reps.length && reps.every(r => r >= hi) && w0 > 0 && st) { w = w0 + st; why = `上次每组都做到 ${hi} 次，按表21 C12 加 ${st}kg`; }
  else if (reps.length && reps.some(r => r < lo) && w0 > st && st) { w = w0 - st; why = `上次有一组不到 ${lo} 次，按表21 C12 减 ${st}kg`; }
  else if (reps.length && reps.every(r => r >= hi) && !st) why = `上次每组都做到 ${hi} 次，可以放慢速度或加次数`;
  const r = w === w0 ? Math.min(hi, Math.max(lo, Math.round(reps.reduce((a, b) => a + b, 0) / (reps.length || 1)) || lo)) : (w > w0 ? lo : hi);
  const ld = loadOf(it.ex, it.v), wt = Math.round(w * 4) / 4;
  if (ld.mode === 'none') return { w: 0, r, why: reps.every(x => x >= hi) ? `上次每组都做到 ${hi} 次，可以放慢速度或加次数` : '和上次一样', last, lastText: last.sets.map(x => `${x.r || '?'}次`).join('  '), load: ld };
  return { w: wt, side: ld.mode === 'bar' ? Math.max(0, Math.round((wt - ld.bar) / 2 * 4) / 4) : null, r, why, last, lastText: last.sets.map(x => `${x.w || '-'}×${x.r || '?'}`).join('  '), load: ld };
}
function sessionItems(d) {
  const tr = training(), si = sessionInfo(d), p = S.profile;
  const hasLeg = day => day && day.groups.some(g => ['quad', 'ham', 'glute'].includes(g.id));
  const hasChest = day => day && day.groups.some(g => g.id === 'mid_chest');
  const dayAt = s => tr.days[s.dayIdx % tr.days.length];
  const legRound = roundsBefore(d, s => !s.custom && hasLeg(dayAt(s)));
  const chestRound = roundsBefore(d, s => !s.custom && hasChest(dayAt(s)));
  const hist = trainedBefore(d);
  // 练过 3 次以上才区分“新动作”（新手前两周本来就全部用 12-15 次）
  const ctx = { week: weekOf(d), legRound, chestRound, choices: S.choices, fresh: hist.n >= 3 && hist.seen.size ? new Set(Object.keys(window.EX).filter(v => !hist.seen.has(v))) : null };
  let day;
  if (si.custom) {
    const groups = [];
    (si.groups || []).forEach(({ dayIdx, gid }) => { const dd = tr.days[dayIdx]; const g = dd && dd.groups.find(x => x.id === gid); if (g) groups.push(g); });
    day = { name: '自选部位', groups };
  } else day = si.day;
  const planned = E.sessionPlan(p, day, ctx);
  const r = peek(d) || {};
  let items = planned.filter(it => !it.optional || (r.extra || {})[it.group.id]);
  const mods = exMods(d, si.key);
  items = items.filter(it => !mods.hide.has(it.v));
  mods.add.forEach(a => { if (!mods.hide.has(a.v) && !items.some(it => it.v === a.v)) items.push(extraItem(a.v, a.sets)); });
  // 换过的动作：原位置、原组数不变，换成新动作，次数/休息/力竭按新动作重新算（不再借用“同一格的备选”，避免换不掉或变成多加一个）
  const rulesCtx = { firstTwo: (p.level || 'new') === 'new' && ctx.week <= 2, F: p.sex === 'F', fresh: ctx.fresh };
  items = items.map(it => {
    let nv = it.v, guard = 0;
    while (mods.swap[nv] && window.EX[mods.swap[nv]] && guard++ < 5) nv = mods.swap[nv];
    if (nv === it.v) return it;
    const ex = window.EX[nv];
    return { ...it, v: nv, ex, ...E.itemRules(ex, it.group, nv, rulesCtx), swappedFrom: it.v, note: `换掉了原来的“${it.ex.n}”`,
      alts: [it.v].concat((it.alts || []).filter(x => x !== nv)), extAlts: (it.extAlts || []).filter(x => x !== nv) };
  }).filter((it, i, a) => a.findIndex(x => x.v === it.v) === i);
  items.forEach(it => { if (mods.sets[it.v]) it.sets = mods.sets[it.v]; });
  // 自己（或助手）改过的次数、休息、是否力竭：对这个动作一直有效
  items.forEach(it => { it.def = { reps: it.reps, rest: it.rest, fail: it.fail, repsSrc: it.repsSrc, restSrc: it.restSrc, failSrc: it.failSrc }; });
  items.forEach(it => { const c = (S.custom.exCfg || {})[it.v]; if (!c) return;
    if (c.reps) { it.reps = c.reps; it.repsSrc = '你改的'; } if (c.rest) { it.rest = c.rest; it.restSrc = '你改的'; }
    if (c.fail != null) { it.fail = c.fail ? '可以做到力竭' : '不追求完全力竭，提前 1-2 次停'; it.failSrc = '你改的'; } it.custom = true; });
  // 动作顺序：拖动排过的按排好的顺序（这一天单独排的优先），新加的动作排在后面
  if (mods.order) { const pos = v => { const i = mods.order.indexOf(v); return i < 0 ? 1e3 : i; }; items = items.map((it, i) => ({ it, i })).sort((a, b) => pos(a.it.v) - pos(b.it.v) || a.i - b.i).map(x => x.it); }
  const optionalGroups = planned.filter(it => it.optional && !(r.extra || {})[it.group.id]).map(it => it.group).filter((g, i, a) => a.indexOf(g) === i);
  // 女性隔轮跳过胸日是套表三分化的规则（表21 C14），补充分化不用
  const femaleSkip = p.sex === 'F' && !si.custom && !tr.ext && hasChest(day) && chestRound % 2 === 1;
  return { si, day, items, ctx, femaleSkip, optionalGroups, trimNote: planned.trimNote || '', skipped: planned.skipped || [] };
}

/* ---------- 能量：消耗与摄入 ---------- */
function burnOf(d) {
  const p = S.profile, pl = S.plan, r = peek(d) || { done: {} }, info = dayInfo(d);
  const items = [{ name: '基础消耗（基础代谢 ÷ 0.7）', kcal: pl.b, src: pl.bmrManual ? '手动基础代谢' : '表5 D14' }];
  if (r.done && r.done.lift && pl.c) items.push({ name: '力量训练', kcal: pl.c, src: '表5 G15' });
  const { tasks } = tasksFor(d);
  tasks.filter(t => t.kind === 'cardio' && r.done && r.done[t.id] && t.act).forEach(t => {
    let min = info.lift ? Math.min(30, +t.act.minutes || 30) : (+t.act.minutes || 0);
    if (t.act.kind === '跑步' && +r.km > 0) min = +r.km * (+t.act.pace || 8);
    items.push({ name: t.act.kind + (min ? ` ${Math.round(min)} 分钟` : ''), kcal: Math.round(E.cardioPerHour(t.act, p.weight).kcal * min / 60), src: '表16' });
  });
  (r.burns || []).forEach(b => items.push({ name: b.name, kcal: +b.kcal || 0, src: '手动添加', id: b.id }));
  return { items, total: items.reduce((s, x) => s + x.kcal, 0) };
}
function intakeOf(d) {
  const r = peek(d) || {};
  return (r.food || []).reduce((s, e) => ({ c: s.c + (+e.total.carbs_g || 0), p: s.p + (+e.total.protein_g || 0), f: s.f + (+e.total.fat_g || 0), kcal: s.kcal + (+e.total.kcal || 0) }), { c: 0, p: 0, f: 0, kcal: 0 });
}
function targetOf(d) {
  const info = dayInfo(d), pl = S.plan, lift = info.lift && !pl.noLift;
  return { c: lift ? pl.carbT : pl.carbR, p: pl.prot, f: pl.fat, kcal: lift ? pl.f1 : pl.f2 };
}

/* ---------- 连续、奖章 ---------- */
function isNeutral(d) { const h = holiday(d); return h && h.off && pctOf(peek(d)) < 0.8; }
function streaks() {
  let best = 0, run = 0;
  allDays().forEach(d => { if (isNeutral(d)) return; if (pctOf(peek(d)) >= 0.8) { run++; best = Math.max(best, run); } else if (d !== today()) run = 0; });
  let cur = 0, d = today();
  if (pctOf(peek(d)) < 0.8) d = E.addDays(d, -1);
  while (d >= S.profile.startDate) { if (isNeutral(d)) { d = E.addDays(d, -1); continue; } if (pctOf(peek(d)) >= 0.8) { cur++; d = E.addDays(d, -1); } else break; }
  return { cur, best: Math.max(best, cur) };
}
function totals() {
  let lifts = 0, km = 0, weighs = 0, perfect = 0, points = 0, meals = 0;
  allDays().forEach(d => {
    const r = peek(d); if (!r) return;
    if (r.done && r.done.lift) lifts++;
    km += +r.km || 0; if (r.weight) weighs++; meals += (r.food || []).length;
    if (r.score) { points += r.score.done * 10; if (r.score.total && r.score.done === r.score.total) { perfect++; points += 20; } }
  });
  const st = streaks(); points += Math.floor(st.best / 7) * 50;
  return { lifts, km: Math.round(km * 10) / 10, weighs, perfect, points, meals, ...st };
}
/* ---------- 每日身体数据：体重必记，腰围等可选（我的 → 每日记录） ---------- */
const METRICS = [
  { id: 'weight', name: '体重', unit: 'kg', min: 20, max: 300, note: '只比较 1-2 周的平均值（表17 B91）' },
  { id: 'waist', name: '腰围', unit: 'cm', min: 40, max: 200, note: '空腹量肚脐一圈，同一时间量' },
  { id: 'hip', name: '臀围', unit: 'cm', min: 50, max: 200 },
  { id: 'chest', name: '胸围', unit: 'cm', min: 50, max: 200 },
  { id: 'arm', name: '臂围', unit: 'cm', min: 15, max: 80 },
  { id: 'thigh', name: '大腿围', unit: 'cm', min: 25, max: 120 },
  { id: 'fat', name: '体脂率', unit: '%', min: 3, max: 70, note: '体测仪短期误差很大，只看长期趋势（表17 B88）' },
];
function metricsOn() { const t = Array.isArray(S.profile.track) ? S.profile.track : []; return METRICS.filter(m => m.id === 'weight' || t.includes(m.id)); }
function metricSeries(id) { return allDays().map(d => ({ d, w: +(peek(d) || {})[id] || null })).filter(x => x.w); }
function weights() { return allDays().map(d => ({ d, w: +(peek(d) || {}).weight || null })).filter(x => x.w); }
/* 奖章：每种一组台阶（铜 → 银 → 金 → 白金），带进度。kind 决定图标 */
function badges() {
  const t = totals(), ws = weights(), p = S.profile, cut = S.plan.goal === 'cut';
  const w0 = +p.startWeight || +p.weight, wl = ws.length ? ws[ws.length - 1].w : w0, lost = Math.round((w0 - wl) * 10) / 10, gained = -lost;
  const B = [];
  const tiers = (kind, cur, list, name, desc) => list.forEach((need, i) => B.push({ kind, cur, need, tier: kind === 'first' ? 1 : Math.max(1, 4 - (list.length - 1 - i)) /* 最高一档是白金，往下依次金、银、铜 */, name: name(need), desc: desc(need) }));
  tiers('first', t.best, [1], () => '第一天', () => '完成第一天的安排');
  tiers('streak', t.best, [3, 7, 30, 100], n => `连续 ${n} 天`, n => `连续 ${n} 天完成当天八成以上的安排`);
  tiers('perfect', t.perfect, [7, 30], n => `${n} 个满分日`, n => `累计 ${n} 天把当天的安排全部完成`);
  tiers('lift', t.lifts, [10, 30, 60, 100], n => `力训 ${n} 次`, n => `累计完成 ${n} 次力量训练`);
  tiers('run', t.km, [50, 200], n => `跑满 ${n}km`, n => `跑步累计 ${n} 公里`);
  tiers('scale', t.weighs, [30, 100], n => `称重 ${n} 天`, n => `累计 ${n} 天记录体重`);
  tiers('meal', t.meals, [50, 200], n => `记录 ${n} 餐`, n => `累计记录 ${n} 餐饮食`);
  if (cut) tiers('down', Math.max(0, lost), [2, 5, 10], n => `减掉 ${n}kg`, n => `比开始时轻 ${n}kg`);
  else tiers('up', Math.max(0, gained), [1, 3, 5], n => `增重 ${n}kg`, n => `比开始时重 ${n}kg`);
  if (+p.targetWeight) B.push({ kind: 'target', tier: 4, cur: (cut ? wl <= +p.targetWeight : wl >= +p.targetWeight) ? 1 : 0, need: 1, name: '到达目标', desc: `体重到达目标 ${p.targetWeight}kg` });
  B.forEach(b => { b.got = b.cur >= b.need; b.pct = Math.max(0, Math.min(1, b.cur / b.need)); });
  return B;
}
const LEVELS = ['新手', '入门', '坚持者', '自律者', '硬核', '铁人', '传奇'];
function levelOf(pts) { const lv = Math.min(LEVELS.length - 1, Math.floor(pts / 600)); return { lv, name: LEVELS[lv], into: pts - lv * 600, need: 600, max: lv === LEVELS.length - 1 }; }
function celebrate(before) { const after = badges().filter(b => b.got); if (after.length > before) { setTimeout(() => toast('解锁奖章：' + after[after.length - 1].name), 1200); confetti(); } }

/* ---------- 通用界面（HIG 风格：顶部胶囊提示、底部面板、操作表） ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; t.style.animation = 'none'; t.offsetHeight; t.style.animation = ''; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2200); }
let closeT = 0;
/* 底部面板。结构：#modal > .scrim（变暗 + 高斯模糊的背景）+ .sheet（面板：横条、圆角、位移）> .sheet-in（滚动、上下渐隐）。
   面板的位置只用 transform（只在合成层动，不重新排版），由 JS 直接写在面板自己身上：
   位移 = 下拉的距离 + 给键盘让的距离（lift，负数）。不用 CSS 变量，免得每帧整块内容重新算样式 */
let lift = 0, onClosed = null;
const place = (sh, drag) => { sh.style.transform = `translateY(${(drag || 0) + lift}px)`; };
const sheetMax = kb => `calc(88vh - ${kb}px)`;
function sheet(html, onBind, afterClose) {
  clearTimeout(closeT);
  const m = $('#modal');
  m.innerHTML = `<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true"><span class="grab" aria-hidden="true"></span><div class="sheet-in">${html}</div></div>`;
  m.hidden = false; m.classList.remove('closing'); onClosed = null;
  m.onclick = e => { if (e.target === m || e.target.classList.contains('scrim')) close(); };
  const sh = m.querySelector('.sheet');
  lift = -Kit.kbHeight(); sh.style.maxHeight = sheetMax(Kit.kbHeight()); place(sh, 0);
  if (onBind) onBind(m);
  onClosed = afterClose || null;   // 面板关掉以后要做的事（比如刷新后面的页面），点空白、下拉、返回键关都会执行
  dragToClose(m, sh);
  edgeFade(sh.querySelector('.sheet-in'));
}
/* 键盘弹出/收起：面板跟着键盘一起平滑上移，只动 transform 和裁切（clip-path），不在动画中途重新排版。
   - 面板放得下：直接整体上移键盘的高度；
   - 面板太高要变矮（弹出时）：动画中保持原高度、只上移到顶边该在的位置，同时用带圆角的裁切把底下那截一起往上收，
     圆角底边全程贴着键盘顶上走；键盘停稳后再真的把高度上限改小、去掉裁切（看起来一模一样）；
   - 面板可以变高（收起时）：先改高度上限，用位移把顶边钉在原处、用裁切把多出来的一截藏住，再一起动画到终点。
   键盘开着时一直带着这个裁切（顶上留出阴影的位置），收起后去掉 */
let kbT = 0;
const radiusOf = sh => parseFloat(getComputedStyle(sh).borderBottomLeftRadius) || 32;
const clipAt = (sh, x) => { sh.style.clipPath = `inset(-90px 0 ${Math.max(0, x)}px 0 round ${radiusOf(sh)}px)`; };
Kit.onKeyboard((h, dur) => {
  const m = $('#modal'), sh = m && !m.hidden && !m.classList.contains('closing') && m.querySelector('.sheet');
  lift = -h; clearTimeout(kbT);
  if (!sh || sh.classList.contains('dragging')) { if (sh) sh.style.maxHeight = sheetMax(h); return; }
  const D = dur || 200, H = sh.offsetHeight, avail = innerHeight * .88 - h;
  const done = fn => { kbT = setTimeout(() => { sh.classList.add('snap'); if (fn) fn(); void sh.offsetHeight; sh.classList.remove('snap'); sh.style.transitionDuration = ''; }, D + 20); };
  if (H > avail + 1) {
    const d = H - avail;
    if (!sh.style.clipPath) { sh.classList.add('snap'); clipAt(sh, 0); void sh.offsetHeight; sh.classList.remove('snap'); }
    sh.style.transitionDuration = D + 'ms';
    sh.style.transform = `translateY(${-(h - d)}px)`; clipAt(sh, d);
    done(() => { sh.style.maxHeight = sheetMax(h); place(sh, 0); clipAt(sh, 0); });
    return;
  }
  const top0 = sh.getBoundingClientRect().top;
  sh.classList.add('snap');
  sh.style.maxHeight = sheetMax(h);
  sh.style.transform = 'none';
  const H1 = sh.offsetHeight;
  sh.style.transform = `translateY(${top0 - sh.getBoundingClientRect().top}px)`;   // 新高度下顶边留在原处
  clipAt(sh, H1 - H);                                                            // 变高多出来的一截先藏住
  void sh.offsetHeight;
  sh.classList.remove('snap');
  sh.style.transitionDuration = D + 'ms';
  place(sh, 0); clipAt(sh, 0);
  done(() => { if (!h) sh.style.clipPath = ''; });
});
/* 背景的模糊程度：k = 1 全模糊（和底部胶囊一样），0 完全清楚。改的是模糊半径和暗度，不是透明度 */
function scrimAt(scrim, k) {
  if (!scrim) return;
  k = Math.max(0, Math.min(1, k));
  scrim.style.backgroundColor = `rgba(14,16,19,${(.2 * k).toFixed(3)})`;
  if (document.documentElement.hasAttribute('data-lite')) return;   // 省电模式不模糊
  const r = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--blur')) || 26;
  scrim.style.webkitBackdropFilter = scrim.style.backdropFilter = `blur(${(r * k).toFixed(1)}px) saturate(${(1 + .4 * k).toFixed(2)})`;
}
/* 关闭：面板往下滑出、背景的模糊同时慢慢退掉，动画完再真正关掉（点空白处、下拉、返回键都走这里）。
   动画期间又打开了别的面板，就不关了 */
function close() {
  const m = $('#modal'), sh = m.querySelector('.sheet'), scrim = m.querySelector('.scrim');
  if (m.hidden) return;
  if (!sh || matchMedia('(prefers-reduced-motion: reduce)').matches) { finishClose(); return; }
  if (m.classList.contains('closing')) return;
  m.classList.add('closing');
  const ae = document.activeElement; if (ae && sh.contains(ae)) ae.blur();   // 收起键盘
  sh.classList.remove('dragging', 'spring'); sh.classList.add('leaving');
  const cur = new DOMMatrixReadOnly(getComputedStyle(sh).transform).m42 || 0;   // 现在的位置（可能正在弹回、正在跟着键盘动）
  sh.style.transform = `translateY(${cur + innerHeight - sh.getBoundingClientRect().top + 20}px)`;
  if (scrim) { scrim.classList.remove('dragging'); scrimAt(scrim, 0); }   // 模糊慢慢退掉
  clearTimeout(closeT); closeT = setTimeout(finishClose, 300);
}
function finishClose() { const m = $('#modal'); clearTimeout(closeT); m.hidden = true; m.innerHTML = ''; m.classList.remove('closing'); const f = onClosed; onClosed = null; if (f) f(); }
/* 内容可以滚动时，上下边缘渐隐（只在那一边还有内容时）；正在输入时不渐隐，免得把输入框盖住 */
function edgeFade(sh) {
  if (!sh) return;
  let raf = 0;
  const upd = () => { raf = 0; sh.classList.toggle('fade-t', sh.scrollTop > 2); sh.classList.toggle('fade-b', sh.scrollTop + sh.clientHeight < sh.scrollHeight - 2); };
  sh.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true }); upd(); setTimeout(upd, 400);
}
/* 下拉关闭：只有按住顶部的横条才能拖（内容区照常上下滚动）。拖动跟手，每帧最多改一次位移；
   松手时拖过三分之一（或者往下甩得够快）就补完滑出的动画，拖得少（可能是误触）就弹回 */
function dragToClose(m, sh) {
  const grab = sh && sh.querySelector('.grab'); if (!grab) return;
  const scrim = m.querySelector('.scrim');
  let y0 = 0, dy = 0, last = [], active = false, raf = 0, h = 1;
  const paint = () => { raf = 0; place(sh, dy); scrimAt(scrim, 1 - dy / h); };   // 背景跟着手指慢慢变清楚
  grab.addEventListener('pointerdown', e => {
    try { grab.setPointerCapture(e.pointerId); } catch (_) { /* 合成事件没有真的指针 */ }
    y0 = e.clientY; dy = 0; last = [[e.timeStamp, e.clientY]]; active = true; h = sh.offsetHeight || 1;
    sh.classList.remove('spring'); sh.classList.add('dragging'); if (scrim) scrim.classList.add('dragging');
  });
  grab.addEventListener('pointermove', e => {
    if (!active) return;
    dy = Math.max(0, e.clientY - y0);
    last.push([e.timeStamp, e.clientY]); if (last.length > 6) last.shift();
    if (!raf) raf = requestAnimationFrame(paint);
  });
  const end = () => {
    if (!active) return; active = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; paint(); }
    // 松手前最后一小段的速度（像素/毫秒）
    const [t1, y1] = last[0], [t2, y2] = last[last.length - 1], v = (y2 - y1) / Math.max(1, t2 - t1);
    sh.classList.remove('dragging'); if (scrim) scrim.classList.remove('dragging');
    if ((dy > h / 3 && v > -0.2) || (v > .6 && dy > 40)) { Kit.haptic('light'); close(); }
    else if (dy > 0) {
      sh.classList.add('spring'); void sh.offsetHeight;
      place(sh, 0); scrimAt(scrim, 1);
      setTimeout(() => sh.classList.remove('spring'), 380);
    }
    dy = 0;
  };
  grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
}
/* 操作表：只改今天 / 以后都这样 */
function askScope(label, cb) {
  sheet(`<h2>${esc(label)}</h2><div class="list"><button class="row" data-sc="day" style="grid-template-columns:1fr"><span class="row-title" style="text-align:center;color:var(--blue)">只改今天</span></button><button class="row" data-sc="tpl" style="grid-template-columns:1fr"><span class="row-title" style="text-align:center;color:var(--blue);font-weight:600">以后都这样</span></button></div><button class="pill glass wide" data-sc="x">取消</button>`, () => {
    $$('[data-sc]').forEach(b => b.onclick = () => { close(); if (b.dataset.sc !== 'x') cb(b.dataset.sc); });
  });
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('#confetti'), x = c.getContext('2d'); c.hidden = false; c.width = innerWidth; c.height = innerHeight;
  const cs = getComputedStyle(document.documentElement);
  const cols = ['--blue', '--orange', '--green', '--pink', '--yellow'].map(v => cs.getPropertyValue(v).trim());
  const P = [...Array(80)].map(() => ({ x: innerWidth / 2, y: innerHeight * .3, vx: (Math.random() - .5) * 12, vy: Math.random() * -12 - 3, s: Math.random() * 6 + 4, r: Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)] }));
  let f = 0;
  (function step() {
    x.clearRect(0, 0, c.width, c.height);
    P.forEach(p => { p.vy += .45; p.x += p.vx; p.y += p.vy; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (++f < 75) requestAnimationFrame(step); else { x.clearRect(0, 0, c.width, c.height); c.hidden = true; }
  })();
}
const imgUrl = (ex, f) => `img/ex/${ex.img}/${f || 0}.jpg`;
function dateLabel(d) { const x = E.pd(d); return `${x.getMonth() + 1}月${x.getDate()}日 星期${DOW[E.dow(d)]}`; }
/* 大标题 + 日期切换（玻璃胶囊） */
function head(title, d, trailing) {
  const busy = window.Assistant && Assistant.busy();   // 助手正在回答：按钮外面转一圈光
  const ai = `<button class="ai-btn glass ${busy ? 'busy' : ''}" data-ai aria-label="${busy ? '助手（正在回答）' : '助手'}">${Kit.I.sparkles}</button>`;
  const cap = ai + (d ? `<div class="gcap glass"><button class="gbtn" data-nav="-1" aria-label="前一天" ${d <= S.profile.startDate ? 'disabled' : ''}>${Kit.I.left}</button><button class="gbtn" data-nav="1" aria-label="后一天">${Kit.I.right}</button></div>` : '');
  return Kit.largeTitle(title, d ? dateLabel(d) + (trailing ? ' · ' + trailing : '') : (trailing || ''), `<div class="head-r">${cap}</div>`);
}
function bindHead() { $$('[data-ai]').forEach(b => b.onclick = () => { Kit.haptic('light'); Assistant.open(); }); $$('[data-nav]').forEach(b => b.onclick = () => { S.day = E.addDays(S.day, +b.dataset.nav); S.edit = false; Kit.haptic('light'); render(); scrollTo(0, 0); }); }
function render() { window.__render(); }

return { APP_VERSION, REPO, E, $, $$, esc, today, DAY_START, dayMin, DOW, uid, src, LS, S, month, peek, rec, save, saveCustom, allDays, ICON, holiday, dayInfo, TYPE,
  tasksFor, setTaskTime, scoreDay, pctOf, training, sessionInfo, sessionItems, weekOf, LIB, extraItem, replaceInOrder, swapExercise, addExercises, LOADS, loadOf, BAR_KINDS, barsOf, setBars, lastSession, suggestFor, trainedBefore, METRICS, metricsOn, metricSeries, burnOf, intakeOf, targetOf, streaks, totals, weights,
  badges, levelOf, celebrate, toast, sheet, close, askScope, confetti, imgUrl, dateLabel, head, bindHead, render };
})();
