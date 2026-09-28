/* 练吃日课：界面与数据（全部保存在手机本地） */
(() => {
const APP_VERSION = '1.0.1';
const REPO = 'ABigCyan/lianchi-daily';
const E = window.Engine;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => E.ds(new Date());
const DOW = ['一', '二', '三', '四', '五', '六', '日'];
const src = (s, app) => s ? `<span class="src${app ? ' app' : ''}">${esc(s)}</span>` : '';
const APPSRC = '应用补充';
const render = () => window.__render();

/* ============ 本地存储 ============ */
const LS = {
  get(k) { try { const v = localStorage.getItem('lcd:' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('lcd:' + k, JSON.stringify(v)); } catch (e) { toast('手机存储空间不足，数据没保存'); } },
  all() { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('lcd:')) o[k] = localStorage.getItem(k); } return o; },
};
const S = {
  profile: null, plan: null, tab: 'today', day: today(), months: {},
  holidays: LS.get('holidays') || {}, ai: LS.get('ai') || { preset: 'dashscope', type: 'openai', base: AI.PRESETS[0].base, key: '', model: '', models: [] },
  choices: LS.get('choices') || {}, planDay: 'lift', notify: LS.get('notify') || { on: false },
};
function month(ym) { if (!S.months[ym]) S.months[ym] = LS.get('m:' + ym) || {}; return S.months[ym]; }
function peek(d) { return month(d.slice(0, 7))[d]; }
function rec(d) { const m = month(d.slice(0, 7)); return m[d] || (m[d] = { done: {} }); }
const saveT = {};
function save(d) { const ym = d.slice(0, 7); clearTimeout(saveT[ym]); saveT[ym] = setTimeout(() => LS.set('m:' + ym, S.months[ym]), 250); }
function allDays(to) {
  const out = []; const end = to || today();
  for (let d = S.profile.startDate; d <= end; d = E.addDays(d, 1)) out.push(d);
  return out;
}

/* ============ 每天：类型、任务、打分 ============ */
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
const TYPE = { lift: '力训日', cardio: '有氧日', rest: '休息日', holiday: '节假日' };
function tasksFor(d) {
  const p = S.profile, info = dayInfo(d), T = [];
  const cardioStart = E.tm(p.cardioTime || '18:30');
  const cardioMin = info.cardio.reduce((s, a) => s + (+a.minutes || 0), 0);
  const meals = E.mealsFor(p, S.plan, info.lift, { cardioEnd: info.cardio.length && !info.lift ? cardioStart + cardioMin : 0 });
  T.push({ id: 'weigh', time: p.wake, title: '起床称体重', detail: '上完厕所、吃东西前称，填在下面的记录里（只比较 1-2 周的平均值，表17 B91）', kind: 'habit' });
  meals.forEach(m => T.push({ id: 'meal-' + m.key, time: m.time, title: m.name, kind: 'meal', meal: m, optional: m.optional }));
  if (info.lift) {
    const s = sessionInfo(d);
    T.push({ id: 'lift', time: p.liftTime, title: '力训：' + s.name, detail: '点这里去“训练”页看动作、换动作、记录每组重量', kind: 'lift' });
  }
  info.cardio.forEach((a, i) => {
    const t = info.lift ? E.mt(E.tm(p.liftTime) + 90) : E.mt(cardioStart + info.cardio.slice(0, i).reduce((s, x) => s + (+x.minutes || 0), 0));
    const pace = a.kind === '跑步' ? `${a.pace} 分配速，` : '';
    T.push({ id: 'cardio-' + i, time: t, title: a.kind, kind: 'cardio',
      detail: info.lift ? '力训后有氧不超过 30 分钟；长有氧放休息日（表5 E103）' : `${pace}${a.minutes} 分钟，心率约 120（表5 E102）；不要刚吃完饭就做` });
  });
  T.push({ id: 'sleep', time: E.mt(E.tm(p.sleep) - 30), title: '准备睡觉', detail: `${p.sleep} 前睡着`, kind: 'habit' });
  const wake = E.tm(p.wake);
  const key = t => { const m = E.tm(t); return m < wake - 60 ? m + 1440 : m; };
  T.sort((a, b) => key(a.time) - key(b.time));
  return { info, tasks: T, meals };
}
function scoreDay(d) {
  const r = rec(d), { tasks } = tasksFor(d);
  const req = tasks.filter(t => !t.optional);
  r.score = { done: req.filter(t => r.done[t.id]).length, total: req.length };
  save(d);
}
function pctOf(r) { return r && r.score && r.score.total ? r.score.done / r.score.total : 0; }

/* ============ 训练轮换 ============ */
function training() { return S.plan.training; }
function sessionInfo(d) {
  const tr = training(); const r = peek(d) || {};
  if (r.session) {
    if (r.session.custom) return { custom: true, name: '自选部位', groups: r.session.groups };
    const day = tr.days[r.session.dayIdx % tr.days.length];
    return { dayIdx: r.session.dayIdx % tr.days.length, name: day.name, day, chosen: true };
  }
  const idx = nextDayIdx(d);
  return { dayIdx: idx, name: tr.days[idx].name, day: tr.days[idx], recommended: true };
}
function nextDayIdx(d) {
  const tr = training(), n = tr.days.length;
  for (let x = E.addDays(d, -1), i = 0; i < 120 && x >= S.profile.startDate; i++, x = E.addDays(x, -1)) {
    const r = peek(x);
    if (r && r.done && r.done.lift && r.session && !r.session.custom && r.session.split === tr.split.key) return (r.session.dayIdx + 1) % n;
  }
  return 0;
}
function roundsBefore(d, pred) {
  let n = 0;
  allDays(E.addDays(d, -1)).forEach(x => { const r = peek(x); if (r && r.done && r.done.lift && r.session && pred(r.session)) n++; });
  return n;
}
function weekOf(d) { return Math.floor((E.pd(d) - E.pd(S.profile.startDate)) / 864e5 / 7) + 1; }
function sessionItems(d) {
  const tr = training(), si = sessionInfo(d), p = S.profile;
  const hasLeg = day => day.groups.some(g => ['quad', 'ham', 'glute'].includes(g.id));
  const hasChest = day => day.groups.some(g => g.id === 'mid_chest');
  const legRound = roundsBefore(d, s => !s.custom && tr.days[s.dayIdx % tr.days.length] && hasLeg(tr.days[s.dayIdx % tr.days.length]));
  const chestRound = roundsBefore(d, s => !s.custom && tr.days[s.dayIdx % tr.days.length] && hasChest(tr.days[s.dayIdx % tr.days.length]));
  const ctx = { week: weekOf(d), legRound, chestRound, choices: S.choices };
  let day;
  if (si.custom) {
    const groups = [];
    (si.groups || []).forEach(({ dayIdx, gid }) => { const dd = tr.days[dayIdx]; const g = dd && dd.groups.find(x => x.id === gid); if (g) groups.push(g); });
    day = { name: '自选部位', groups };
  } else day = si.day;
  const items = E.sessionPlan(p, day, ctx);
  const femaleSkip = p.sex === 'F' && !si.custom && hasChest(day) && chestRound % 2 === 1;
  return { si, day, items, ctx, femaleSkip };
}

/* ============ 通用组件 ============ */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2400); }
function showModal(html, onBind) {
  const m = $('#modal'); m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false;
  m.onclick = e => { if (e.target === m) hideModal(); };
  if (onBind) onBind(m);
}
function hideModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('#confetti'), x = c.getContext('2d'); c.hidden = false; c.width = innerWidth; c.height = innerHeight;
  const cs = getComputedStyle(document.documentElement);
  const cols = ['--lift', '--run', '--done', '--gold'].map(v => cs.getPropertyValue(v).trim());
  const P = [...Array(90)].map(() => ({ x: innerWidth / 2, y: innerHeight * .35, vx: (Math.random() - .5) * 12, vy: Math.random() * -12 - 3, s: Math.random() * 6 + 4, r: Math.random() * 6, c: cols[Math.floor(Math.random() * 4)] }));
  let f = 0;
  (function step() {
    x.clearRect(0, 0, c.width, c.height);
    P.forEach(p => { p.vy += .45; p.x += p.vx; p.y += p.vy; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (++f < 80) requestAnimationFrame(step); else { x.clearRect(0, 0, c.width, c.height); c.hidden = true; }
  })();
}
function ring(pct) {
  const R = 32, C = 2 * Math.PI * R, off = C * (1 - pct);
  return `<svg class="ring" viewBox="0 0 80 80" role="img" aria-label="完成 ${Math.round(pct * 100)}%"><circle cx="40" cy="40" r="${R}" fill="none" stroke="var(--sunk)" stroke-width="8"/><circle cx="40" cy="40" r="${R}" fill="none" stroke="${pct >= 1 ? 'var(--done)' : 'var(--lift)'}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 40 40)"/><text x="40" y="45" text-anchor="middle" font-size="16">${Math.round(pct * 100)}%</text></svg>`;
}
const imgUrl = (ex, f) => `img/ex/${ex.img}/${f || 0}.jpg`;
function dateLabel(d) { const x = E.pd(d); return `${x.getMonth() + 1}月${x.getDate()}日 周${DOW[E.dow(d)]}`; }
function dateNav(d, title) {
  return `<div class="datenav"><button class="iconbtn" data-nav="-1" aria-label="前一天" ${d <= S.profile.startDate ? 'disabled' : ''}>‹</button><div><h1>${title}</h1><div class="xs muted">${dateLabel(d)} · 第 ${weekOf(d)} 周</div></div><button class="iconbtn" data-nav="1" aria-label="后一天">›</button></div>`;
}
function bindNav() { $$('[data-nav]').forEach(b => b.onclick = () => { S.day = E.addDays(S.day, +b.dataset.nav); render(); scrollTo(0, 0); }); }

/* ============ 连续、奖章 ============ */
function isNeutral(d) { const h = holiday(d); const r = peek(d); return h && h.off && pctOf(r) < 0.8; }
function streaks() {
  let best = 0, run = 0;
  allDays().forEach(d => { if (isNeutral(d)) return; if (pctOf(peek(d)) >= 0.8) { run++; best = Math.max(best, run); } else if (d !== today()) run = 0; });
  let cur = 0, d = today();
  if (pctOf(peek(d)) < 0.8) d = E.addDays(d, -1);
  while (d >= S.profile.startDate) { if (isNeutral(d)) { d = E.addDays(d, -1); continue; } if (pctOf(peek(d)) >= 0.8) { cur++; d = E.addDays(d, -1); } else break; }
  return { cur, best: Math.max(best, cur) };
}
function totals() {
  let lifts = 0, km = 0, weighs = 0, perfect = 0, points = 0, photos = 0;
  allDays().forEach(d => {
    const r = peek(d); if (!r) return;
    if (r.done && r.done.lift) lifts++;
    km += +r.km || 0; if (r.weight) weighs++; photos += (r.food || []).length;
    if (r.score) { points += r.score.done * 10; if (r.score.total && r.score.done === r.score.total) { perfect++; points += 20; } }
  });
  const st = streaks(); points += Math.floor(st.best / 7) * 50;
  return { lifts, km: Math.round(km * 10) / 10, weighs, perfect, points, photos, ...st };
}
function weights() { return allDays().map(d => ({ d, w: +(peek(d) || {}).weight || null })).filter(x => x.w); }
function badges() {
  const t = totals(), ws = weights(), p = S.profile, cut = S.plan.goal === 'cut';
  const w0 = +p.startWeight || +p.weight, wl = ws.length ? ws[ws.length - 1].w : w0;
  const B = [
    ['第一天', '单日完成 80% 以上', t.best >= 1], ['三天不断', '连续达标 3 天', t.best >= 3], ['一周全勤', '连续达标 7 天', t.best >= 7],
    ['两周习惯', '连续达标 14 天', t.best >= 14], ['一个月', '连续达标 30 天', t.best >= 30], ['六十天', '连续达标 60 天', t.best >= 60],
    ['百日', '连续达标 100 天', t.best >= 100], ['七个满分日', '累计 7 天全部完成', t.perfect >= 7], ['十次力训', '累计 10 次力训', t.lifts >= 10],
    ['三十次力训', '累计 30 次力训', t.lifts >= 30], ['六十次力训', '累计 60 次力训', t.lifts >= 60], ['跑满 50 公里', '累计记录 50 km', t.km >= 50],
    ['天天称重', '累计称重 30 天', t.weighs >= 30], ['拍照记账', '拍照记录 20 餐', t.photos >= 20],
  ];
  if (cut) B.push(['减掉 2kg', '比起始轻 2kg', w0 - wl >= 2], ['减掉 5kg', '比起始轻 5kg', w0 - wl >= 5], ['减掉 10kg', '比起始轻 10kg', w0 - wl >= 10]);
  else B.push(['稳步增重 1kg', '比起始重 1kg', wl - w0 >= 1], ['增重 3kg', '比起始重 3kg', wl - w0 >= 3]);
  if (+p.targetWeight) B.push(['到达目标', `体重到 ${p.targetWeight}kg`, cut ? wl <= +p.targetWeight : wl >= +p.targetWeight]);
  return B.map(([name, desc, got]) => ({ name, desc, got }));
}
const LEVELS = ['新手', '入门', '坚持者', '自律者', '硬核', '铁人', '传奇'];
function levelOf(pts) { const lv = Math.min(LEVELS.length - 1, Math.floor(pts / 600)); return { lv, name: LEVELS[lv], into: pts - lv * 600, need: 600 }; }
function celebrate(before) {
  const after = badges().filter(b => b.got);
  if (after.length > before) { const nb = after[after.length - 1]; setTimeout(() => toast('解锁奖章：' + nb.name), 1300); confetti(); }
}

/* ============ 今天 ============ */
function viewToday() {
  const p = S.profile, d = S.day, { info, tasks, meals } = tasksFor(d), r = peek(d) || { done: {} };
  const req = tasks.filter(t => !t.optional), done = req.filter(t => r.done && r.done[t.id]).length;
  const pct = req.length ? done / req.length : 0, st = streaks(), isToday = d === today(), future = d > today();
  let h = `<div class="topbar">${dateNav(d, isToday ? '今天' : dateLabel(d).split(' ')[0])}<span class="pill ${info.type}">${TYPE[info.type]}${info.h ? ' · ' + esc(info.h.name) + (info.h.off ? '' : '补班') : ''}</span></div>`;
  h += `<div class="card"><div class="dayhead">${ring(pct)}<div class="stack" style="gap:4px"><div><b class="num">${done}</b> / <span class="num">${req.length}</span> 项完成${pct >= 0.8 ? ' <span class="pill done">今日达标</span>' : ''}</div><div class="streakline"><span>连续达标 <b>${st.cur}</b> 天</span><span>最长 <b>${st.best}</b> 天</span><span>等级 <b>${levelOf(totals().points).name}</b></span></div><div class="xs muted">完成 80% 以上算达标；节假日没打卡不会中断连续记录。</div></div></div></div>`;
  if (isToday) h += '<div id="nowBox"></div>';
  if (p.lift !== false && !future) {
    h += `<div class="row between small"><span class="muted">${info.lift ? '今天安排了力训' : info.h && info.h.off ? `今天是${esc(info.h.name)}，已自动跳过力训` : '今天没有安排力训'}</span>${info.lift ? '<button class="linkbtn" data-ov="rest">今天不练</button>' : '<button class="linkbtn" data-ov="lift">今天加练</button>'}</div>`;
  }
  h += '<div class="card"><h2>时间线</h2><div class="tasks">';
  tasks.forEach(t => {
    const ck = !!(r.done && r.done[t.id]);
    let det = '';
    if (t.kind === 'meal') {
      const m = t.meal, f = m.foods;
      det = `<div class="macro">碳水 ${m.c}g · 蛋白质 ${m.p}g</div>`;
      if (f.c.length) det += `<ul class="foods"><li>主食选一：${f.c.map(esc).join(' / ')}</li>${f.p.length ? `<li>蛋白质选一：${f.p.map(esc).join(' / ')}</li>` : ''}</ul>`;
      else if (f.p.length) det += `<ul class="foods"><li>${f.p.map(esc).join(' / ')}</li></ul>`;
      f.notes.forEach(n => det += `<div class="detail">${esc(n)}</div>`);
    } else det = `<div class="detail">${esc(t.detail)}</div>`;
    const title = t.kind === 'lift' ? `<button class="linkbtn" data-go="train" style="font-size:15px">${esc(t.title)} ›</button>` : `<label for="ck-${t.id}">${esc(t.title)}</label>`;
    h += `<div class="task ${ck ? 'is-done' : ''}" data-tid="${t.id}"><span class="t">${t.time}</span><input type="checkbox" class="check" id="ck-${t.id}" data-id="${t.id}" ${ck ? 'checked' : ''} ${future ? 'disabled' : ''} aria-label="${esc(t.title)}"><div class="body"><div class="title">${title}${t.optional ? '<span class="opt">可选</span>' : ''}</div>${det}</div></div>`;
  });
  h += '</div></div>';
  h += foodCard(d, meals, info, future);
  h += `<div class="card"><h2>今天的数据</h2><div class="logs">
    ${logField('weight', '体重 kg', r.weight, lastWeight() || p.weight, future)}
    ${logField('waist', '腰围 cm', r.waist, '可选', future)}
    ${logField('sleep', '睡眠 小时', r.sleep, '7.5', future)}
    ${logField('km', '跑步 km', r.km, '0', future)}
    <div class="field" style="grid-column:span 2"><label>饥饿感（1 不饿，5 很饿）</label><div class="hunger">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-h="${i}" aria-pressed="${+r.hunger === i}" ${future ? 'disabled' : ''}>${i}</button>`).join('')}</div></div>
  </div><div class="field"><label for="lg-note">备注</label><textarea class="in" id="lg-note" data-k="note" placeholder="吃了什么特别的、身体感觉如何" ${future ? 'disabled' : ''}>${esc(r.note || '')}</textarea></div>
  <p class="xs muted">常饿可以：选饱腹感高的主食、多吃蔬菜、把瘦肉吃够，或加有氧换碳水（表17 第16问）。体脂秤数据不可信，看体重、腰围和外观（表17 B88）。</p></div>`;
  return h;
}
function logField(k, label, v, ph, dis) {
  return `<div class="field"><label for="lg-${k}">${label}</label><input class="in num" id="lg-${k}" data-k="${k}" inputmode="decimal" value="${esc(v || '')}" placeholder="${esc(ph)}" ${dis ? 'disabled' : ''}></div>`;
}
function lastWeight() { const ws = weights(); return ws.length ? ws[ws.length - 1].w : ''; }
function dayTarget(info) {
  const lift = info.lift && !S.plan.noLift;
  return { c: lift ? S.plan.carbT : S.plan.carbR, p: S.plan.prot, f: S.plan.fat, kcal: lift ? S.plan.f1 : S.plan.f2 };
}
function eaten(d) {
  const r = peek(d) || {};
  return (r.food || []).reduce((s, e) => ({ c: s.c + e.total.carbs_g, p: s.p + e.total.protein_g, f: s.f + e.total.fat_g, kcal: s.kcal + e.total.kcal }), { c: 0, p: 0, f: 0, kcal: 0 });
}
function bar(label, v, t, unit) {
  const pct = t ? Math.min(100, Math.round(v / t * 100)) : 0;
  return `<div class="bar ${v > t * 1.1 ? 'over' : ''}"><div class="lbl"><span>${label}</span><span class="num">${Math.round(v)} / ${t}${unit}</span></div><div class="track"><i style="width:${pct}%"></i></div></div>`;
}
function foodCard(d, meals, info, future) {
  const r = peek(d) || {}, t = dayTarget(info), e = eaten(d);
  let h = `<div class="card"><div class="row between"><h2>饮食记录</h2>${future ? '' : '<button class="btn small" id="photoBtn">拍照记录</button>'}</div>`;
  if ((r.food || []).length) {
    h += `<div class="bars">${bar('碳水', e.c, t.c, 'g')}${bar('蛋白质', e.p, t.p, 'g')}${bar('热量（参考）', e.kcal, t.kcal, ' kcal')}</div>`;
    h += '<div class="stack">' + r.food.map((f, i) => `<div class="row between small"><span><b>${esc(f.mealName)}</b> <span class="muted">${esc(f.items.map(x => x.name).join('、'))}</span></span><span class="num muted">${f.total.carbs_g}c · ${f.total.protein_g}p <button class="linkbtn" data-food="${i}">详情</button></span></div>`).join('') + '</div>';
    h += '<p class="xs muted">热量由大模型看照片估算，只做参考；套表的执行重点是碳水和蛋白质定量、脂肪按规则吃（表5 M22）。</p>';
  } else h += '<p class="small muted">拍一张餐食照片，大模型会按表19 的营养率估算碳水、蛋白质和热量，并按套表规则提醒高脂肉、糖油混合物。需要先在“设置 → 拍照识别”里填好接口。</p>';
  return h + '</div>';
}
function bindToday() {
  bindNav();
  $$('[data-go]').forEach(b => b.onclick = () => { S.tab = b.dataset.go; render(); scrollTo(0, 0); });
  $$('[data-ov]').forEach(b => b.onclick = () => { const r = rec(S.day); r.override = b.dataset.ov; scoreDay(S.day); render(); });
  $$('.check').forEach(c => c.onchange = () => {
    const d = S.day, r = rec(d), before = badges().filter(b => b.got).length, was = pctOf(r);
    if (c.checked) r.done[c.dataset.id] = true; else delete r.done[c.dataset.id];
    scoreDay(d);
    const y = scrollY; render(); scrollTo(0, y);
    if (c.checked) toast('+10 能量');
    if (pctOf(r) >= 1 && was < 1) { toast('今天全部完成，+20 能量'); confetti(); }
    celebrate(before);
  });
  $$('.logs input.in, #lg-note').forEach(i => i.oninput = () => { const r = rec(S.day); r[i.dataset.k] = i.value.trim(); if (!r.score) scoreDay(S.day); save(S.day); });
  $$('.hunger button').forEach(b => b.onclick = () => { const r = rec(S.day); r.hunger = +b.dataset.h; save(S.day); $$('.hunger button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  const pb = $('#photoBtn'); if (pb) pb.onclick = startPhoto;
  $$('[data-food]').forEach(b => b.onclick = () => showFood(peek(S.day).food[+b.dataset.food], +b.dataset.food));
  updateNow();
}
function updateNow() {
  const box = $('#nowBox'); if (!box || S.day !== today()) return;
  const { tasks } = tasksFor(S.day), r = peek(S.day) || { done: {} };
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), wake = E.tm(S.profile.wake);
  const key = t => { const m = E.tm(t); return m < wake - 60 ? m + 1440 : m; };
  const cur = nm < wake - 60 ? nm + 1440 : nm;
  const open = tasks.filter(t => !t.optional && !(r.done && r.done[t.id]));
  $$('.task.is-next').forEach(e => e.classList.remove('is-next'));
  if (!open.length) { box.innerHTML = '<div class="now alldone"><span class="lab">今日全部完成</span><b>今天的任务都完成了，明天继续。</b></div>'; return; }
  const late = open.filter(t => key(t.time) <= cur);
  const t = late.length ? late[late.length - 1] : open[0];
  const diff = key(t.time) - cur;
  const el = document.querySelector(`.task[data-tid="${t.id}"]`); if (el) el.classList.add('is-next');
  box.innerHTML = late.length
    ? `<div class="now late"><span class="lab">该做了 · ${t.time}</span><b>${esc(t.title)}</b>${late.length > 1 ? `<span class="xs muted">还有 ${late.length - 1} 项已到时间没打勾</span>` : ''}</div>`
    : `<div class="now"><span class="lab">下一项 · ${diff >= 60 ? Math.floor(diff / 60) + ' 小时 ' : ''}${diff % 60} 分钟后</span><b>${t.time} ${esc(t.title)}</b></div>`;
}

/* ============ 拍照识别 ============ */
function startPhoto() {
  const { meals } = tasksFor(S.day);
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  let best = meals[0];
  meals.forEach(m => { if (Math.abs(E.tm(m.time) - nowM) < Math.abs(E.tm(best.time) - nowM)) best = m; });
  showModal(`<h2>拍照记录一餐</h2>
    <div class="field"><label for="pm-meal">这是哪一餐</label><select class="in" id="pm-meal">${meals.map(m => `<option value="${m.key}" ${m === best ? 'selected' : ''}>${esc(m.name)}（碳水 ${m.c}g，蛋白质 ${m.p}g）</option>`).join('')}</select></div>
    <div class="field"><label for="pm-note">补充说明（可选）</label><input class="in" id="pm-note" placeholder="比如：米饭只吃了一半、鸡腿去皮了"></div>
    <div class="row"><button class="btn" id="pm-go">拍照 / 选照片</button><button class="btn ghost" id="pm-cancel">取消</button></div>
    <p class="xs muted">照片会发送给你在设置里填的大模型接口，只用来这次识别，App 不保存照片。</p>`, () => {
    $('#pm-cancel').onclick = hideModal;
    $('#pm-go').onclick = () => {
      if (!S.ai.key || !S.ai.model) { hideModal(); toast('请先在“设置 → 拍照识别”里填好接口并选择模型'); S.tab = 'me'; render(); return; }
      const mealKey = $('#pm-meal').value, note = $('#pm-note').value.trim();
      const inp = $('#photoInput'); inp.value = '';
      inp.onchange = async () => { const f = inp.files && inp.files[0]; if (f) runPhoto(f, meals.find(m => m.key === mealKey), note); };
      inp.click();
    };
  });
}
async function runPhoto(file, meal, note) {
  showModal('<h2>正在识别…</h2><p class="small muted">大模型正在看照片、估算分量，一般需要 5-30 秒。</p>');
  try {
    const dataUrl = await AI.compress(file);
    const info = dayInfo(S.day), t = dayTarget(info), e = eaten(S.day);
    const result = await AI.analyze(S.ai, dataUrl, { meal: meal.name, goal: S.plan.goal, target: { c: meal.c, p: meal.p }, eaten: e, day: t, note });
    result.meal = meal.key; result.mealName = meal.name; result.time = E.mt(new Date().getHours() * 60 + new Date().getMinutes()); result.model = S.ai.model;
    showFood(result, -1, dataUrl);
  } catch (err) {
    showModal(`<h2>识别失败</h2><p class="small">${esc(err.message || err)}</p><div class="row"><button class="btn ghost" id="fx">关闭</button></div>`, () => $('#fx').onclick = hideModal);
  }
}
function showFood(f, idx, dataUrl) {
  const isNew = idx < 0;
  const draw = () => {
    const rows = f.items.map((it, i) => `<tr><td>${esc(it.name)}<br><span class="xs muted">${esc(it.category)}${it.note ? ' · ' + esc(it.note) : ''}</span></td><td class="n"><input class="in num" style="width:72px;padding:4px 6px" data-g="${i}" value="${it.grams}" inputmode="decimal"></td><td class="n">${it.carbs_g}</td><td class="n">${it.protein_g}</td><td class="n">${it.fat_g}</td></tr>`).join('');
    showModal(`<div class="row between"><h2>${esc(f.mealName)}</h2><span class="xs muted">把握度 ${Math.round(f.confidence * 100)}%</span></div>
      ${dataUrl ? `<img class="bigimg" src="${dataUrl}" alt="餐食照片">` : ''}
      <div class="tbl"><table><thead><tr><th>食物</th><th class="n">克</th><th class="n">碳水</th><th class="n">蛋白</th><th class="n">脂肪</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">没有识别到食物</td></tr>'}</tbody></table></div>
      <div class="row small"><b>合计</b><span class="num">碳水 ${f.total.carbs_g}g · 蛋白质 ${f.total.protein_g}g · 脂肪 ${f.total.fat_g}g · ${f.total.kcal} kcal</span></div>
      ${f.flags.length ? `<div class="stack">${f.flags.map(x => `<div class="pill warn" style="white-space:normal">${esc(x)}</div>`).join('')}</div>` : ''}
      ${f.advice ? `<p class="advice small">${esc(f.advice)}</p>` : ''}
      <p class="xs muted">改克数会按比例重算。估算依据：表19 营养率、表17 第1问（混合菜拆开算），模型：${esc(f.model || '')}</p>
      <div class="row">${isNew ? '<button class="btn" id="fs-save">保存到这一天</button>' : '<button class="btn ghost" id="fs-del">删除这条</button>'}<button class="btn ghost" id="fs-close">关闭</button></div>`, () => {
      $$('[data-g]').forEach(inp => inp.onchange = () => {
        const it = f.items[+inp.dataset.g], g = +inp.value;
        if (!(g >= 0) || !it.grams) return;
        const k = g / it.grams;
        ['carbs_g', 'protein_g', 'fat_g', 'kcal'].forEach(x => it[x] = Math.round(it[x] * k));
        it.grams = Math.round(g);
        f.total = f.items.reduce((s, x) => ({ carbs_g: s.carbs_g + x.carbs_g, protein_g: s.protein_g + x.protein_g, fat_g: s.fat_g + x.fat_g, kcal: s.kcal + x.kcal }), { carbs_g: 0, protein_g: 0, fat_g: 0, kcal: 0 });
        if (!isNew) save(S.day);
        draw();
      });
      $('#fs-close').onclick = () => { hideModal(); render(); };
      const sv = $('#fs-save');
      if (sv) sv.onclick = () => {
        const r = rec(S.day), before = badges().filter(b => b.got).length;
        r.food = r.food || []; r.food.push(f);
        r.done['meal-' + f.meal] = true; scoreDay(S.day);
        hideModal(); render(); toast('已记录，并勾选了这一餐'); celebrate(before);
      };
      const dl = $('#fs-del');
      if (dl) dl.onclick = () => { const r = rec(S.day); r.food.splice(idx, 1); save(S.day); hideModal(); render(); };
    });
  };
  draw();
}

window.__APP = { S, LS, E, $, $$, esc, src, APPSRC, today, DOW, rec, peek, save, allDays, dayInfo, tasksFor, scoreDay, pctOf, training, sessionInfo, sessionItems, weekOf,
  toast, showModal, hideModal, confetti, imgUrl, dateLabel, dateNav, bindNav, streaks, totals, weights, badges, levelOf, celebrate, dayTarget, eaten, bar,
  viewToday, bindToday, updateNow, APP_VERSION, REPO, holiday, month };
})();
