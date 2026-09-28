/* 核心：存储、每天的卡片、训练、能量计算、奖励（界面文件共用） */
window.C = (() => {
const APP_VERSION = '1.1.0';
const REPO = 'ABigCyan/lianchi-daily';
const E = window.Engine;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => E.ds(new Date());
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
  custom: Object.assign({ timeline: {}, train: {} }, LS.get('custom') || {}),
  notify: LS.get('notify') || { on: false },
};
function month(ym) { if (!S.months[ym]) S.months[ym] = LS.get('m:' + ym) || {}; return S.months[ym]; }
function peek(d) { return month(d.slice(0, 7))[d]; }
function rec(d) { const m = month(d.slice(0, 7)); return m[d] || (m[d] = { done: {} }); }
const saveT = {};
function save(d) { const ym = d.slice(0, 7); clearTimeout(saveT[ym]); saveT[ym] = setTimeout(() => LS.set('m:' + ym, S.months[ym]), 200); }
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
  return { hide: new Set([...(tpl.hide || []), ...(day.hide || [])]), add: [...(tpl.add || []), ...(day.add || [])], tplAdd: new Set((tpl.add || []).map(a => a.id)) };
}
function tasksFor(d) {
  const info = dayInfo(d);
  const { T, meals } = baseTasks(d, info);
  const mods = tlMods(d, info.type);
  let tasks = T.filter(t => !mods.hide.has(t.id));
  mods.add.forEach(a => { if (!mods.hide.has(a.id)) tasks.push({ ...a, custom: true, tpl: mods.tplAdd.has(a.id) }); });
  const wake = E.tm(S.profile.wake);
  const key = t => { const m = E.tm(t); return m < wake - 60 ? m + 1440 : m; };
  tasks.sort((a, b) => key(a.time) - key(b.time));
  return { info, tasks, meals, key };
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
/* 动作库：所有分化里出现过的动作 → 所属肌群与部位 */
const LIB = (() => {
  const partOf = {}; window.PARTS.forEach(pt => pt.groups.forEach(g => partOf[g] = pt));
  const map = {};
  Object.values(window.SPLITS).forEach(sp => sp.days.forEach(day => day.groups.forEach(g => g.entries.forEach(e => window.ENTRY[e].forEach(v => {
    if (!map[v]) map[v] = { v, ex: window.EX[v], group: g.name, part: (partOf[g.id] || {}).name || '其他', src: g.src };
  })))));
  return map;
})();
function extraItem(v, sets) {
  const p = S.profile, ex = window.EX[v], F = p.sex === 'F';
  const g = { id: 'extra-' + v, name: (LIB[v] || {}).group || '添加的动作', text: '你自己添加的动作', src: (LIB[v] || {}).src || '', sheet: 'extra' };
  return { group: g, v, ex, sets: sets || 3, reps: F ? '10-15' : '8-12', repsSrc: F ? '表21 C14' : '表21 C12',
    rest: ex.multi ? '2-3 分钟' : '1-1.5 分钟', fail: ex.noFail ? '不追求完全力竭，提前 1-2 次停' : '可以做到力竭', alts: [], added: true };
}
function exMods(d, key) {
  const tpl = S.custom.train[key] || {};
  const day = (peek(d) || {}).ex || {};
  return { hide: new Set([...(tpl.hide || []), ...(day.hide || [])]), add: [...(tpl.add || []), ...(day.add || [])], sets: Object.assign({}, tpl.sets || {}, day.sets || {}) };
}
function sessionItems(d) {
  const tr = training(), si = sessionInfo(d), p = S.profile;
  const hasLeg = day => day && day.groups.some(g => ['quad', 'ham', 'glute'].includes(g.id));
  const hasChest = day => day && day.groups.some(g => g.id === 'mid_chest');
  const dayAt = s => tr.days[s.dayIdx % tr.days.length];
  const legRound = roundsBefore(d, s => !s.custom && hasLeg(dayAt(s)));
  const chestRound = roundsBefore(d, s => !s.custom && hasChest(dayAt(s)));
  const ctx = { week: weekOf(d), legRound, chestRound, choices: S.choices };
  let day;
  if (si.custom) {
    const groups = [];
    (si.groups || []).forEach(({ dayIdx, gid }) => { const dd = tr.days[dayIdx]; const g = dd && dd.groups.find(x => x.id === gid); if (g) groups.push(g); });
    day = { name: '自选部位', groups };
  } else day = si.day;
  let items = E.sessionPlan(p, day, ctx);
  const r = peek(d) || {};
  items = items.filter(it => !it.optional || (r.extra || {})[it.group.id]);
  const mods = exMods(d, si.key);
  items = items.filter(it => !mods.hide.has(it.v));
  mods.add.forEach(a => { if (!mods.hide.has(a.v) && !items.some(it => it.v === a.v)) items.push(extraItem(a.v, a.sets)); });
  items.forEach(it => { if (mods.sets[it.v]) it.sets = mods.sets[it.v]; });
  const optionalGroups = E.sessionPlan(p, day, ctx).filter(it => it.optional && !(r.extra || {})[it.group.id]).map(it => it.group).filter((g, i, a) => a.indexOf(g) === i);
  const femaleSkip = p.sex === 'F' && !si.custom && hasChest(day) && chestRound % 2 === 1;
  return { si, day, items, ctx, femaleSkip, optionalGroups };
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
function weights() { return allDays().map(d => ({ d, w: +(peek(d) || {}).weight || null })).filter(x => x.w); }
function badges() {
  const t = totals(), ws = weights(), p = S.profile, cut = S.plan.goal === 'cut';
  const w0 = +p.startWeight || +p.weight, wl = ws.length ? ws[ws.length - 1].w : w0;
  const B = [
    ['第一天', t.best >= 1], ['连续 3 天', t.best >= 3], ['连续 7 天', t.best >= 7], ['连续 14 天', t.best >= 14],
    ['连续 30 天', t.best >= 30], ['连续 100 天', t.best >= 100], ['7 个满分日', t.perfect >= 7], ['力训 10 次', t.lifts >= 10],
    ['力训 30 次', t.lifts >= 30], ['力训 60 次', t.lifts >= 60], ['跑满 50km', t.km >= 50], ['称重 30 天', t.weighs >= 30],
    ['记录 50 餐', t.meals >= 50],
  ];
  if (cut) B.push(['减掉 2kg', w0 - wl >= 2], ['减掉 5kg', w0 - wl >= 5], ['减掉 10kg', w0 - wl >= 10]);
  else B.push(['增重 1kg', wl - w0 >= 1], ['增重 3kg', wl - w0 >= 3]);
  if (+p.targetWeight) B.push(['到达目标', cut ? wl <= +p.targetWeight : wl >= +p.targetWeight]);
  return B.map(([name, got]) => ({ name, got }));
}
const LEVELS = ['新手', '入门', '坚持者', '自律者', '硬核', '铁人', '传奇'];
function levelOf(pts) { const lv = Math.min(LEVELS.length - 1, Math.floor(pts / 600)); return { lv, name: LEVELS[lv], into: pts - lv * 600, need: 600, max: lv === LEVELS.length - 1 }; }
function celebrate(before) { const after = badges().filter(b => b.got); if (after.length > before) { setTimeout(() => toast('解锁奖章：' + after[after.length - 1].name), 1200); confetti(); } }

/* ---------- 通用界面 ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2300); }
function sheet(html, onBind) {
  const m = $('#modal'); m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false;
  m.onclick = e => { if (e.target === m) close(); };
  if (onBind) onBind(m);
}
function close() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
/* 选择修改范围：只改今天 / 以后都这样 */
function askScope(label, cb) {
  sheet(`<h2>${esc(label)}</h2><div class="stack"><button class="btn ghost block" data-sc="day">只改今天</button><button class="btn primary block" data-sc="tpl">以后都这样</button><button class="textbtn" data-sc="x">取消</button></div>`, () => {
    $$('[data-sc]').forEach(b => b.onclick = () => { close(); if (b.dataset.sc !== 'x') cb(b.dataset.sc); });
  });
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('#confetti'), x = c.getContext('2d'); c.hidden = false; c.width = innerWidth; c.height = innerHeight;
  const cs = getComputedStyle(document.documentElement);
  const cols = ['--train', '--food', '--done', '--gold'].map(v => cs.getPropertyValue(v).trim());
  const P = [...Array(80)].map(() => ({ x: innerWidth / 2, y: innerHeight * .35, vx: (Math.random() - .5) * 12, vy: Math.random() * -12 - 3, s: Math.random() * 6 + 4, r: Math.random() * 6, c: cols[Math.floor(Math.random() * 4)] }));
  let f = 0;
  (function step() {
    x.clearRect(0, 0, c.width, c.height);
    P.forEach(p => { p.vy += .45; p.x += p.vx; p.y += p.vy; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (++f < 75) requestAnimationFrame(step); else { x.clearRect(0, 0, c.width, c.height); c.hidden = true; }
  })();
}
const imgUrl = (ex, f) => `img/ex/${ex.img}/${f || 0}.jpg`;
function dateLabel(d) { const x = E.pd(d); return `${x.getMonth() + 1}月${x.getDate()}日 周${DOW[E.dow(d)]}`; }
function head(title, d, right) {
  const nav = d ? `<div class="date"><button class="nav-arrow" data-nav="-1" aria-label="前一天" ${d <= S.profile.startDate ? 'disabled' : ''}>‹</button><span>${dateLabel(d)}</span><button class="nav-arrow" data-nav="1" aria-label="后一天">›</button></div>` : '';
  return `<div class="head"><div><h1>${title}</h1>${nav}</div>${right || ''}</div>`;
}
function bindHead() { $$('[data-nav]').forEach(b => b.onclick = () => { S.day = E.addDays(S.day, +b.dataset.nav); S.edit = false; render(); scrollTo(0, 0); }); }
function render() { window.__render(); }

return { APP_VERSION, REPO, E, $, $$, esc, today, DOW, uid, src, LS, S, month, peek, rec, save, saveCustom, allDays, ICON, holiday, dayInfo, TYPE,
  tasksFor, scoreDay, pctOf, training, sessionInfo, sessionItems, weekOf, LIB, extraItem, burnOf, intakeOf, targetOf, streaks, totals, weights,
  badges, levelOf, celebrate, toast, sheet, close, askScope, confetti, imgUrl, dateLabel, head, bindHead, render };
})();
