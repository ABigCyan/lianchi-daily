/* 练吃日课：训练、统计、计划、设置、提醒、启动 */
(() => {
const A = window.__APP;
const { S, LS, E, $, $$, esc, src, APPSRC, today, DOW, rec, peek, save, allDays, dayInfo, tasksFor, scoreDay, pctOf, training, sessionInfo, sessionItems,
  toast, showModal, hideModal, confetti, imgUrl, dateNav, bindNav, streaks, totals, weights, badges, levelOf, celebrate, APP_VERSION, REPO } = A;

/* ============ 训练 ============ */
function lastLift(v, before) {
  const days = allDays(E.addDays(before, -1)).reverse();
  for (const d of days) {
    const r = peek(d); const s = r && r.sets && r.sets[v];
    if (s && s.some(x => x && x.w)) return s.filter(x => x && x.w).map(x => `${x.w}×${x.r || '?'}`).join('  ');
  }
  return '';
}
function viewTrain() {
  const p = S.profile, d = S.day;
  if (p.lift === false) return `<h1>训练</h1><div class="card"><p>你在设置里选了“不做力训”，饮食按表8《减脂-无力训者》。减脂需要的热量缺口可以只靠饮食提供（表8 E20）。</p></div>`;
  const tr = training(), info = dayInfo(d), r = peek(d) || {};
  const { si, items, femaleSkip } = sessionItems(d);
  const future = d > today();
  let h = `<div class="topbar">${dateNav(d, '训练')}<span class="pill lift">${esc(tr.splitName)}</span></div>`;
  h += `<div class="card"><div class="row between"><h2>这次练哪天</h2>${info.lift ? '' : '<button class="linkbtn" data-ov="lift">今天加练</button>'}</div>
    <div class="chips">${tr.days.map((dd, i) => `<button class="chip" data-day="${i}" aria-pressed="${!si.custom && si.dayIdx === i}">Day${i + 1} ${esc(dd.name)}${si.recommended && si.dayIdx === i ? '<span class="rec">推荐</span>' : ''}</button>`).join('')}<button class="chip" data-day="custom" aria-pressed="${!!si.custom}">自选部位</button></div>
    <p class="xs muted">${esc(tr.split.why)} ${src(tr.split.src)}。按顺序轮换，推荐的是上次练完的下一天；节假日或不练的日子不会打乱顺序。</p>
    ${info.lift ? '' : `<p class="small muted">${info.h && info.h.off ? `今天是${esc(info.h.name)}，力训已自动跳过。` : '今天没有安排力训。'}想练的话点“今天加练”。</p>`}
    ${femaleSkip ? `<p class="small pill warn" style="white-space:normal">女性每两轮三分化跳过一次胸日，这次可以换别的部位（表21 C14）</p>` : ''}</div>`;
  const total = items.filter(it => !it.optional || (r.extra || {})[it.group.id]).reduce((s, it) => s + it.sets, 0);
  h += `<div class="row between small"><span class="muted">本次约 <b class="num">${total}</b> 组，一般 1-1.5 小时 ${src('表21 C10')}</span><span class="muted">热身 5 分钟，练完拉伸（表26/27）</span></div>`;
  let lastG = null;
  items.forEach((it, idx) => {
    const g = it.group;
    const extraOn = (r.extra || {})[g.id];
    if (g !== lastG) {
      lastG = g;
      h += `<div class="grouphead"><h3>${esc(g.name)}</h3><span class="xs muted">${esc(g.text)}</span></div><div class="xs">${src(g.src)}${g.movedNote ? src(g.movedNote, 1) : ''}</div>`;
      if (it.optional && !extraOn) {
        h += `<div class="card" style="padding:12px"><p class="small muted">${(S.profile.level || 'new') === 'new' ? '新手偶尔加做' : '这次轮到隔次休息（应用补充：有基础者下胸隔次做）'}，默认不做。</p><button class="btn ghost small" data-extra="${g.id}">加做这组</button></div>`;
      }
    }
    if (it.optional && !extraOn) return;
    const ex = it.ex, sets = ((r.sets || {})[it.v]) || [];
    const last = lastLift(it.v, d);
    h += `<div class="excard"><div class="exhead"><button class="linkbtn" data-big="${idx}" aria-label="看 ${esc(ex.n)} 的大图"><img class="eximg" data-anim="${esc(ex.img)}" src="${imgUrl(ex, 0)}" alt="${esc(ex.n)}" loading="lazy"></button>
      <div class="stack" style="gap:4px"><div class="exname">${esc(ex.n)}</div><div class="exmeta"><span>器械：${esc(ex.eq)}</span>
      <span><b class="num">${it.sets}</b> 组 × <b class="num">${it.reps}</b> 次 ${src(it.repsSrc)}</span>
      <span>组间休息 ${it.rest} ${src('表21 C11')}</span><span>${it.fail} ${src('表21 C13')}</span>
      ${last ? `<span>上次：<span class="num">${esc(last)}</span></span>` : ''}${ex.approx ? '<span>图片为相近动作示意</span>' : ''}</div>
      ${it.alts.length ? `<button class="linkbtn" data-swap="${idx}">换动作（${it.alts.length} 个备选）</button>` : '<span class="xs muted">原表这一项没有备选动作</span>'}</div></div>
      <div class="sets">${[...Array(it.sets)].map((_, i) => { const s = sets[i] || {}; return `<div class="setrow"><span class="sn">${i + 1}</span><input class="in num" data-set="${it.v}|${i}|w" value="${esc(s.w || '')}" placeholder="kg" inputmode="decimal" aria-label="第${i + 1}组重量" ${future ? 'disabled' : ''}><input class="in num" data-set="${it.v}|${i}|r" value="${esc(s.r || '')}" placeholder="次数" inputmode="numeric" aria-label="第${i + 1}组次数" ${future ? 'disabled' : ''}><input type="checkbox" class="check" data-setdone="${it.v}|${i}" ${s.done ? 'checked' : ''} ${future ? 'disabled' : ''} aria-label="第${i + 1}组完成"></div>`; }).join('')}</div></div>`;
  });
  const doneLift = r.done && r.done.lift;
  h += `<div class="card"><p class="xs muted">重量选能做 ${items[0] ? esc(items[0].reps) : '8-12'} 次就力竭的；每组都做到上限后下次加重（加重节奏为应用补充）。不是越重越增肌 ${src('表21 C12')}</p>
    <button class="btn block" id="finishLift" ${future ? 'disabled' : ''}>${doneLift ? '已完成（点击取消）' : '完成本次训练'}</button></div>`;
  return h;
}
function bindTrain() {
  bindNav();
  const d = S.day;
  $$('[data-ov]').forEach(b => b.onclick = () => { rec(d).override = b.dataset.ov; scoreDay(d); render(); });
  $$('[data-day]').forEach(b => b.onclick = () => {
    const tr = training(), r = rec(d);
    if (b.dataset.day === 'custom') return pickCustom();
    r.session = { split: tr.split.key, dayIdx: +b.dataset.day }; save(d); render();
  });
  $$('[data-extra]').forEach(b => b.onclick = () => { const r = rec(d); r.extra = r.extra || {}; r.extra[b.dataset.extra] = true; save(d); render(); });
  const { items } = sessionItems(d);
  $$('[data-big]').forEach(b => b.onclick = () => bigImage(items[+b.dataset.big].ex));
  $$('[data-swap]').forEach(b => b.onclick = () => swap(items, +b.dataset.swap));
  $$('[data-set]').forEach(i => i.oninput = () => {
    const [v, idx, f] = i.dataset.set.split('|'); const r = rec(d);
    r.sets = r.sets || {}; r.sets[v] = r.sets[v] || []; r.sets[v][+idx] = r.sets[v][+idx] || {};
    r.sets[v][+idx][f] = i.value.trim(); ensureSession(d); save(d);
  });
  $$('[data-setdone]').forEach(c => c.onchange = () => {
    const [v, idx] = c.dataset.setdone.split('|'); const r = rec(d);
    r.sets = r.sets || {}; r.sets[v] = r.sets[v] || []; r.sets[v][+idx] = r.sets[v][+idx] || {};
    r.sets[v][+idx].done = c.checked; ensureSession(d); save(d);
    const all = items.filter(it => !it.optional || (r.extra || {})[it.group.id]).every(it => [...Array(it.sets)].every((_, k) => ((r.sets[it.v] || [])[k] || {}).done));
    if (all && !(r.done && r.done.lift)) finish(true);
  });
  const fb = $('#finishLift'); if (fb) fb.onclick = () => finish(!(peek(d) && peek(d).done && peek(d).done.lift));
  animate();
}
function ensureSession(d) {
  const r = rec(d);
  if (!r.session) { const si = sessionInfo(d); r.session = { split: training().split.key, dayIdx: si.dayIdx }; }
}
function finish(on) {
  const d = S.day, r = rec(d), before = badges().filter(b => b.got).length;
  ensureSession(d);
  if (on) { r.done.lift = true; if (!A.dayInfo(d).lift) r.override = 'lift'; } else delete r.done.lift;
  scoreDay(d); render();
  if (on) { toast('本次训练完成，+10 能量'); confetti(); celebrate(before); }
}
function pickCustom() {
  const tr = training();
  showModal(`<h2>自选今天练的部位</h2><p class="xs muted">从当前分化的各天里挑肌群，动作和组数仍按原表。</p>
    ${tr.days.map((dd, i) => `<div class="stack"><b class="small">Day${i + 1} ${esc(dd.name)}</b>${dd.groups.map(g => `<label class="switch"><input type="checkbox" data-cg="${i}|${g.id}">${esc(g.name)} <span class="xs muted">${esc(g.text)}</span></label>`).join('')}</div>`).join('')}
    <div class="row"><button class="btn" id="cg-ok">确定</button><button class="btn ghost" id="cg-x">取消</button></div>`, () => {
    $('#cg-x').onclick = hideModal;
    $('#cg-ok').onclick = () => {
      const groups = $$('[data-cg]:checked').map(c => { const [di, gid] = c.dataset.cg.split('|'); return { dayIdx: +di, gid }; });
      if (!groups.length) { toast('至少选一个肌群'); return; }
      rec(S.day).session = { custom: true, split: tr.split.key, groups }; save(S.day); hideModal(); render();
    };
  });
}
function swap(items, idx) {
  const it = items[idx], g = it.group;
  showModal(`<h2>把「${esc(it.ex.n)}」换成</h2><p class="xs muted">备选都来自原表同一肌群：${esc(g.src)}</p>
    <div class="altgrid">${it.alts.map(v => { const ex = window.EX[v]; return `<button class="alt" data-alt="${v}"><img src="${imgUrl(ex, 0)}" alt="" loading="lazy"><span>${esc(ex.n)}</span><small>${esc(ex.eq)}${ex.approx ? ' · 示意图' : ''}</small></button>`; }).join('')}</div>
    <button class="btn ghost" id="sw-x">取消</button>`, () => {
    $('#sw-x').onclick = hideModal;
    $$('[data-alt]').forEach(b => b.onclick = () => {
      const key = g.sheet + ':' + g.id;
      const current = items.filter(x => x.group === g).map(x => x.v);
      const nv = b.dataset.alt;
      const next = current.map(v => v === it.v ? nv : v).filter((v, i, a) => a.indexOf(v) === i);
      // 如果换成的动作和同组另一个动作属于同一条目（器械版本），替换那一个
      S.choices[key] = next; LS.set('choices', S.choices);
      hideModal(); render(); toast('已换成 ' + window.EX[nv].n + '，以后默认用它');
    });
  });
}
function bigImage(ex) {
  showModal(`<h2>${esc(ex.n)}</h2><img class="bigimg" src="${imgUrl(ex, 0)}" alt="${esc(ex.n)} 起始"><img class="bigimg" src="${imgUrl(ex, 1)}" alt="${esc(ex.n)} 结束">
    <p class="xs muted">器械：${esc(ex.eq)}。图片来自开源图库 free-exercise-db（公有领域）${ex.approx ? '，图库中没有完全相同的动作，这里是相近动作的示意' : ''}。动作细节可在 B 站搜索动作名称学习（表21 C4）。</p>
    <button class="btn ghost" id="bi-x">关闭</button>`, () => $('#bi-x').onclick = hideModal);
}
let animT;
function animate() {
  clearInterval(animT);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let f = 0;
  animT = setInterval(() => { f = 1 - f; $$('img[data-anim]').forEach(img => img.src = `img/ex/${img.dataset.anim}/${f}.jpg`); }, 1100);
}

/* ============ 统计 ============ */
function weightChart() {
  const ws = weights();
  if (ws.length < 2) return '<p class="muted small">记录两天以上体重后，这里显示趋势图。</p>';
  const pts = ws.slice(-90), W = 600, H = 220, L = 44, R = 12, T = 14, B = 28;
  const d0 = pts[0].d, span = Math.max(1, (E.pd(pts[pts.length - 1].d) - E.pd(d0)) / 864e5);
  const tgt = +S.profile.targetWeight || null;
  let lo = Math.min(...pts.map(x => x.w)), hi = Math.max(...pts.map(x => x.w));
  if (tgt && Math.abs(tgt - lo) < 4) lo = Math.min(lo, tgt); if (tgt && Math.abs(tgt - hi) < 4) hi = Math.max(hi, tgt);
  lo = Math.floor(lo - .5); hi = Math.ceil(hi + .5);
  const X = d => L + (W - L - R) * ((E.pd(d) - E.pd(d0)) / 864e5) / span, Y = w => T + (H - T - B) * (hi - w) / (hi - lo);
  const step = (hi - lo) > 8 ? 2 : 1; let g = '';
  for (let v = lo; v <= hi; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  const ma = pts.map(x => { const win = pts.filter(y => y.d <= x.d && y.d > E.addDays(x.d, -7)); return { d: x.d, w: win.reduce((s, y) => s + y.w, 0) / win.length }; });
  const line = ma.map((x, i) => (i ? 'L' : 'M') + X(x.d).toFixed(1) + ' ' + Y(x.w).toFixed(1)).join(' ');
  const dots = pts.map(x => `<circle cx="${X(x.d).toFixed(1)}" cy="${Y(x.w).toFixed(1)}" r="3" fill="var(--muted)" opacity=".5"/>`).join('');
  const last = ma[ma.length - 1];
  const fd = s => { const d = E.pd(s); return (d.getMonth() + 1) + '/' + d.getDate(); };
  const tl = tgt && tgt >= lo && tgt <= hi ? `<line x1="${L}" x2="${W - R}" y1="${Y(tgt)}" y2="${Y(tgt)}" stroke="var(--done)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${W - R}" y="${Y(tgt) - 6}" text-anchor="end" style="fill:var(--done)">目标 ${tgt}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="体重趋势">${g}${tl}${dots}<path d="${line}" fill="none" stroke="var(--lift)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${X(last.d)}" cy="${Y(last.w)}" r="5" fill="var(--lift)"/><text x="${L}" y="${H - 8}">${fd(pts[0].d)}</text><text x="${W - R}" y="${H - 8}" text-anchor="end">${fd(pts[pts.length - 1].d)}</text></svg><div class="xs muted">圆点是每天的体重，蓝线是 7 天平均。只看 1-2 周的平均变化（表17 B91）。</div>`;
}
function heatmap() {
  const td = today(); let start = E.addDays(td, -34); start = E.addDays(start, -E.dow(start));
  let h = DOW.map(x => `<div class="hd">${x}</div>`).join('');
  for (let d = start; d <= E.addDays(td, 6 - E.dow(td)); d = E.addDays(d, 1)) {
    const pc = pctOf(peek(d)), fut = d > td, pre = d < S.profile.startDate, hol = A.holiday(d);
    const bg = fut || pre ? 'var(--sunk)' : pc >= 1 ? 'var(--done)' : pc >= .8 ? 'color-mix(in srgb,var(--done) 70%,var(--surface))' : pc > 0 ? 'color-mix(in srgb,var(--done) 30%,var(--surface))' : (hol && hol.off ? 'var(--warn-soft)' : 'var(--sunk)');
    h += `<div class="h" style="background:${bg};color:${pc >= .8 && !fut ? 'var(--surface)' : 'var(--muted)'};${d === td ? 'outline:2px solid var(--lift);' : ''}${fut || pre ? 'opacity:.4' : ''}" title="${d}">${E.pd(d).getDate()}</div>`;
  }
  return `<div class="heat">${h}</div><div class="xs muted">越绿完成得越多，浅红是节假日（不影响连续记录），蓝框是今天。</div>`;
}
function liftProgress() {
  const first = {}, last = {}, best = {};
  allDays().forEach(d => {
    const r = peek(d); if (!r || !r.sets) return;
    Object.entries(r.sets).forEach(([v, arr]) => {
      const valid = (arr || []).filter(x => x && +x.w);
      if (!valid.length) return;
      const top = Math.max(...valid.map(x => +x.w));
      if (!first[v]) first[v] = top; last[v] = top;
      valid.forEach(x => { const rm = E.oneRM(+x.w, +x.r, S.profile.sex); if (rm && (!best[v] || rm > best[v])) best[v] = rm; });
    });
  });
  const vs = Object.keys(last);
  if (!vs.length) return '<p class="muted small">在训练页记录每组重量后，这里显示每个动作的进步和最大力量预测。</p>';
  return `<div class="tbl"><table><thead><tr><th>动作</th><th class="n">第一次</th><th class="n">最近</th><th class="n">预测 1RM</th></tr></thead><tbody>${vs.map(v => `<tr><td>${esc((window.EX[v] || {}).n || v)}</td><td class="n">${first[v]}kg</td><td class="n">${last[v]}kg</td><td class="n">${best[v] ? Math.round(best[v]) + 'kg' : '—'}</td></tr>`).join('')}</tbody></table></div><div class="xs muted">1RM 用${S.profile.sex === 'F' ? ' Brzycki' : ' Lombardi'} 公式按重量和次数预测 ${src('表25')}</div>`;
}
function medal(got, i) {
  return `<svg class="medal" viewBox="0 0 40 40"><path d="M13 2h6l3 9h-6zM27 2h-6l-3 9h6z" fill="${got ? 'var(--lift)' : 'var(--line)'}"/><circle cx="20" cy="25" r="12" fill="${got ? 'var(--gold)' : 'var(--muted)'}"/><text x="20" y="29.5" text-anchor="middle" font-size="11" font-weight="700" fill="var(--surface)">${i + 1}</text></svg>`;
}
function viewStats() {
  const t = totals(), lv = levelOf(t.points), bs = badges(), p = S.profile;
  const last7 = [...Array(7)].map((_, i) => E.addDays(today(), -i)).filter(d => d >= p.startDate);
  const rate = last7.length ? Math.round(last7.reduce((s, d) => s + pctOf(peek(d)), 0) / last7.length * 100) : 0;
  const ws = weights(), w0 = +p.startWeight || +p.weight, wl = ws.length ? ws[ws.length - 1].w : w0;
  const adv = E.advice(p, S.plan, ws, today());
  const foodDays = last7.filter(d => (peek(d) || {}).food && peek(d).food.length);
  let h = `<h1>统计</h1><div class="tiles">
    <div class="tile"><span class="k">当前连续达标</span><span class="v">${t.cur}<small>天</small></span></div>
    <div class="tile"><span class="k">最长连续</span><span class="v">${t.best}<small>天</small></span></div>
    <div class="tile"><span class="k">近 7 天完成率</span><span class="v">${rate}<small>%</small></span></div>
    <div class="tile"><span class="k">体重变化</span><span class="v">${(wl - w0 > 0 ? '+' : '') + (wl - w0).toFixed(1)}<small>kg</small></span></div></div>`;
  h += `<div class="card"><div class="row between"><h2>等级：${lv.name}</h2><span class="num small muted">${t.points} 能量</span></div><div class="lvbar"><i style="width:${lv.lv >= LEVELS_LEN() - 1 ? 100 : Math.round(lv.into / lv.need * 100)}%"></i></div><div class="xs muted">每打勾一项 +10，一天全部完成 +20，每连续达标 7 天 +50。</div></div>`;
  h += `<div class="card"><h2>进度判断</h2>${adv.map(a => `<p class="advice ${a.cls} small">${esc(a.text)} ${src(a.src)}</p>`).join('')}</div>`;
  h += `<div class="card"><h2>体重趋势</h2>${weightChart()}</div>`;
  h += `<div class="card"><h2>最近 5 周打卡</h2>${heatmap()}</div>`;
  if (foodDays.length) {
    const avg = k => Math.round(foodDays.reduce((s, d) => s + A.eaten(d)[k], 0) / foodDays.length);
    h += `<div class="card"><h2>拍照记录的平均摄入</h2><p class="small">最近 ${foodDays.length} 天有记录：碳水 ${avg('c')}g，蛋白质 ${avg('p')}g，约 ${avg('kcal')} kcal/天。目标：碳水 ${S.plan.carbR}-${S.plan.carbT}g，蛋白质 ${S.plan.prot}g。</p><p class="xs muted">只统计拍照记录过的餐，没拍的餐不计入。</p></div>`;
  }
  h += `<div class="card"><h2>力量进步</h2>${liftProgress()}</div>`;
  h += `<div class="card"><div class="row between"><h2>奖章</h2><span class="xs muted num">${bs.filter(b => b.got).length}/${bs.length}</span></div><div class="badges">${bs.map((b, i) => `<div class="badge ${b.got ? '' : 'locked'}">${medal(b.got, i)}<span class="bn">${esc(b.name)}</span><span class="bd">${esc(b.desc)}</span></div>`).join('')}</div></div>`;
  h += `<div class="tiles"><div class="tile"><span class="k">累计力训</span><span class="v">${t.lifts}<small>次</small></span></div><div class="tile"><span class="k">累计跑步</span><span class="v">${t.km}<small>km</small></span></div><div class="tile"><span class="k">满分日</span><span class="v">${t.perfect}<small>天</small></span></div><div class="tile"><span class="k">拍照记录</span><span class="v">${t.photos}<small>餐</small></span></div></div>`;
  return h;
}
const LEVELS_LEN = () => 7;

/* ============ 计划（算法与出处） ============ */
function viewPlan() {
  const p = S.profile, pl = S.plan, R = window.RULES;
  const G = pl.goalWhy;
  let h = `<h1>我的计划</h1><p class="xs muted">每一步都标了出处：虚线框是《健身Excel超级套表》的表号和单元格，橙色框是 Excel 没给具体数值、本应用补充的做法。</p>`;
  h += `<div class="card"><div class="row between"><h2>1. 目标：${pl.goal === 'cut' ? '减脂' : '增肌'}</h2><span class="pill ${pl.goal === 'cut' ? 'cardio' : 'lift'}">BMI ${pl.bmi.toFixed(1)}</span></div><p class="small">${esc(G.reason)} ${src(G.src)}</p><p class="xs muted">${esc(R.noRecomp.text)} ${src(R.noRecomp.src)}</p></div>`;
  const rows = [
    ['基础代谢', pl.bmr, pl.bmr, R.bmr.src], ['无运动总消耗（÷0.7）', pl.b, pl.b, R.noExercise.src],
    ['力训消耗', pl.noLift ? '—' : '+' + pl.c, '—', R.liftBurn.src], ['有氧（每周÷7）', '+' + pl.d, '+' + pl.d, R.cardioBurn.src],
    ['平衡热量', pl.e1, pl.e2, R.balance.src], [`应吃热量（×${pl.factor}）`, pl.f1, pl.f2, pl.goal === 'cut' ? R.cutFactor.src : R.bulkFactor.src],
    ['脂肪（不细算）', pl.fat + 'g', pl.fat + 'g', R.fat.src], ['蛋白质', `${pl.prot}g<br><span class="xs muted">${pl.qP}/kg</span>`, `${pl.prot}g`, R.split.src],
    ['碳水', `${pl.carbT}g<br><span class="xs muted">${pl.qT}/kg</span>`, `${pl.carbR}g<br><span class="xs muted">${pl.qR}/kg</span>`, R.split.src + '，' + R.quota.src],
  ];
  h += `<div class="card"><h2>2. 热量和三大营养素</h2><div class="tbl"><table><thead><tr><th>步骤</th><th class="n">${pl.noLift ? '每天' : '力训日'}</th>${pl.noLift ? '' : '<th class="n">休息日</th>'}</tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}<br>${src(r[3])}</td><td class="n">${r[1]}</td>${pl.noLift ? '' : `<td class="n">${r[2]}</td>`}</tr>`).join('')}</tbody></table></div>
    <p class="xs muted">乘 0.64/0.84 看起来偏少，是因为原表预留了定量饮食时不自觉多吃的 10-20% ${src(pl.goal === 'cut' ? '表5 G19' : '表13 G19')}</p>${pl.notes.map(n => `<p class="small advice">${esc(n.text)} ${src(n.src)}</p>`).join('')}</div>`;
  const meals = pl.noLift ? pl.meals.rest : pl.meals[S.planDay];
  h += `<div class="card"><div class="row between"><h2>3. 饮食表：${esc(pl.sheet.sheet)}《${pl.goal === 'cut' ? '减脂' : '增肌'}-${esc(pl.sheet.name)}》</h2></div><p class="small muted">${esc(pl.sheet.how)} ${src(window.RULES.meals.src)} ${pl.noLift ? '' : src('按练前 2 小时内是否吃过正餐判断', 1)}</p>
    ${pl.noLift ? '' : `<div class="segs"><button data-pd="lift" aria-pressed="${S.planDay === 'lift'}">力训日</button><button data-pd="rest" aria-pressed="${S.planDay === 'rest'}">休息日</button></div>`}
    <div class="tbl"><table><thead><tr><th>餐</th><th class="n">碳水</th><th class="n">蛋白</th><th>怎么吃</th></tr></thead><tbody>${meals.map(m => `<tr><td>${esc(m.name)}<br><span class="muted num">${m.time}</span></td><td class="n">${m.reserve ? '预留' : ''}${m.c}g</td><td class="n">${m.p}g</td><td>${m.foods.c[0] ? esc(m.foods.c[0]) + '<br>' : ''}${m.foods.p[0] ? esc(m.foods.p[0]) : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="xs muted">餐序照原表；每餐分多少 ${src(APPSRC, 1)}：原表格子是空的（数值在视频里），这里按原表规则分配——练后餐最大（C12）、练前餐只垫碳水不吃蛋白（I44）、零食只留 10% 碳水（E58）、早饭鸡蛋牛奶（J31）${p.budget ? '；省钱模式把肉和饭集中到自助午饭，晚饭用馒头加鸡蛋（参考表20 价格）' : ''}。</p>
    <p class="xs muted">${esc(R.fatRule.text)} ${src(R.fatRule.src)}</p>${pl.goal === 'bulk' ? `<p class="xs muted">${esc(R.bulkNuts.text)} ${src(R.bulkNuts.src)}</p>` : ''}</div>`;
  const cw = pl.cardio;
  h += `<div class="card"><h2>4. 有氧</h2>${cw.items.length ? `<div class="tbl"><table><thead><tr><th>项目</th><th class="n">每次</th><th class="n">每周</th></tr></thead><tbody>${cw.items.map(a => `<tr><td>${esc(a.kind)}${a.kind === '跑步' ? `（${a.pace} 分配速）` : ''} ${a.minutes} 分钟<br>${src(a.src)}</td><td class="n">${a.perSession} kcal</td><td class="n">${a.n} 次</td></tr>`).join('')}</tbody></table></div><p class="small">每周约 ${cw.weekly} kcal，平均每天 ${cw.daily} kcal，已算进饮食。</p>` : '<p class="small muted">没有设置有氧。</p>'}
    <p class="xs muted">${esc(R.cardioAdvice.text)} ${src(R.cardioAdvice.src)}</p><p class="xs muted">${esc(R.cardioTiming.text)} ${src(R.cardioTiming.src)}</p></div>`;
  if (!pl.noLift) {
    const tr = pl.training;
    h += `<div class="card"><h2>5. 训练：${esc(tr.splitName)}</h2><p class="small">${esc(tr.split.why)} ${src(tr.split.src)}</p><p class="xs muted">每周 ${pl.perWeek} 次。${esc(R.freq.text)} ${src(R.freq.src)}</p>
      ${tr.days.map((d, i) => `<div class="stack"><b>Day${i + 1} ${esc(d.name)} ${src(d.src)}</b><div class="stack" style="gap:6px">${d.groups.map(g => `<div class="small"><b>${esc(g.name)}</b> <span class="muted">${esc(g.text)}</span><br>${src(g.src)}${g.movedNote ? src('不练腿，腹移到这天', 1) : ''}</div>`).join('')}</div></div>`).join('')}
      <p class="xs muted">${esc(R.volume.text)} ${src(R.volume.src)}。新手前 4 周取组数下限、动作数取下限；第 1-2 周用 12-15 次的重量 ${src('表21 C10、C12；分阶段为应用补充', 1)}</p>
      <p class="xs muted">${esc(R.legRotate.text)} ${src(R.legRotate.src)}</p>${p.sex === 'F' ? `<p class="xs muted">${esc(R.female.text)} ${src(R.female.src)}</p>` : ''}</div>`;
  }
  h += `<div class="card"><h2>6. 未来两周</h2>${calendar()}<p class="xs muted">节假日数据来自国务院办公厅通知（holiday-cn 整理），${p.skipHolidays !== false ? '节假日自动跳过力训' : '节假日照常训练'}${p.cardioSkipHolidays ? '，有氧也跳过' : '，有氧照常'}。</p></div>`;
  if (pl.warnings.length) h += `<div class="card"><h2>需要注意</h2>${pl.warnings.map(w => `<p class="advice warn small">${esc(w.text)} ${src(w.src)}</p>`).join('')}</div>`;
  h += `<div class="card"><details><summary><b>全部规则与出处（${Object.keys(R).length} 条）</b></summary><div class="stack" style="padding-top:10px">${Object.values(R).map(r => `<p class="small">${esc(r.text)} ${src(r.src)}</p>`).join('')}</div></details></div>`;
  return h;
}
function calendar() {
  const td = today(); let start = E.addDays(td, -E.dow(td));
  let h = DOW.map(x => `<div class="hd xs muted" style="text-align:center">${x}</div>`).join('');
  for (let i = 0; i < 14; i++) {
    const d = E.addDays(start, i), info = dayInfo(d);
    let label = info.type === 'lift' ? (d >= td ? '力训' : '力训') : info.type === 'cardio' ? info.cardio.map(a => a.kind).join('/') : info.type === 'holiday' ? info.h.name : (info.h && !info.h.off ? '补班' : '休息');
    h += `<div class="cd ${info.type} ${d === td ? 'today' : ''}"><b>${E.pd(d).getDate()}</b><span>${esc(label)}</span></div>`;
  }
  return `<div class="cal">${h}</div>`;
}
function bindPlan() { $$('[data-pd]').forEach(b => b.onclick = () => { S.planDay = b.dataset.pd; render(); }); }

/* ============ 设置 ============ */
const DEF = {
  name: '', sex: 'M', age: '', height: '', weight: '', waist: '', targetWeight: '', goal: 'auto', lift: true, level: 'new', place: 'gym', split: 'auto',
  parts: { chest: true, back: true, shoulder: true, arm: true, legs: true, abs: true }, focus: 'auto', femaleAbs: true,
  schedMode: 'weekly', liftDays: [0, 2, 4], skipHolidays: true, liftTime: '18:00',
  cardio: [], cardioTime: '18:30', wake: '07:30', breakfast: '08:00', lunch: '12:00', dinner: '19:00', sleep: '23:30', sheet: 'auto',
  eggsMilk: true, budget: false, lunchCost: 30, gout: false, diabetes: false,
};
const CARDIO_KINDS = ['无', '跑步', ...window.CARDIO.filter(c => !c.run).map(c => c.label)];
function viewMe(first) {
  const p = Object.assign({}, DEF, S.profile || {});
  p.parts = Object.assign({}, DEF.parts, p.parts || {});
  const sel = (id, opts, v) => `<select class="in" id="f-${id}">${opts.map(([k, t]) => `<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const num = (id, v, ph) => `<input class="in num" id="f-${id}" value="${esc(v)}" placeholder="${esc(ph)}" inputmode="decimal">`;
  const time = (id, v) => `<input class="in" type="time" id="f-${id}" value="${esc(v)}">`;
  const dows = (id, arr, cls) => `<div class="dows ${cls || ''}" data-dows="${id}">${DOW.map((x, i) => `<button type="button" data-i="${i}" aria-pressed="${(arr || []).includes(i)}">${x}</button>`).join('')}</div>`;
  const cardio = [0, 1, 2].map(i => {
    const a = p.cardio[i] || { kind: '无', minutes: 45, pace: 8, days: [] };
    return `<div class="cardiorow"><div class="fgrid"><div class="field"><label>有氧 ${i + 1}</label><select class="in" data-c="${i}|kind">${CARDIO_KINDS.map(k => `<option ${a.kind === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
      <div class="field"><label>每次分钟</label><input class="in num" data-c="${i}|minutes" value="${esc(a.minutes)}" inputmode="numeric"></div>
      <div class="field"><label>跑步配速（分钟/公里）</label><input class="in num" data-c="${i}|pace" value="${esc(a.pace || '')}" inputmode="decimal" placeholder="8"></div>
      <div class="field"><label>运动心率 / 静息心率（可选）</label><div class="row" style="flex-wrap:nowrap"><input class="in num" data-c="${i}|hr" value="${esc(a.hr || '')}" placeholder="130" inputmode="numeric"><input class="in num" data-c="${i}|rhr" value="${esc(a.rhr || '')}" placeholder="65" inputmode="numeric"></div></div></div>
      ${dows('cd' + i, a.days, 'cardio')}</div>`;
  }).join('');
  const sheets = [['auto', '按训练时间自动选']].concat(Object.entries(E.SHEETS).map(([k, v]) => [k, `${v.name}（${v.cut}/${v.bulk}）`]));
  let h = first ? `<div class="stack" style="padding-top:8px"><h1>练吃日课</h1><p class="muted small">按《健身Excel超级套表》（B站好人松松）的规则，根据你的情况生成饮食和训练计划。数据只保存在这台手机上。</p><button class="btn ghost small" id="importFirst">从备份导入</button></div>` : `<h1>设置</h1><p class="xs muted">改完点最下面的“保存”，计划会重新生成，已有的打卡不受影响。</p>`;
  h += `<form class="form" id="pform">
  <fieldset><legend>身体数据</legend><div class="fgrid">
    <div class="field"><label for="f-name">昵称</label><input class="in" id="f-name" value="${esc(p.name)}" placeholder="可不填"></div>
    <div class="field"><label for="f-sex">性别</label>${sel('sex', [['M', '男'], ['F', '女']], p.sex)}</div>
    <div class="field"><label for="f-age">年龄</label>${num('age', p.age, '24')}</div>
    <div class="field"><label for="f-height">身高 cm</label>${num('height', p.height, '172')}</div>
    <div class="field"><label for="f-weight">体重 kg</label>${num('weight', p.weight, '80')}</div>
    <div class="field"><label for="f-waist">空腹腰围 cm</label>${num('waist', p.waist, '可选')}</div>
    <div class="field"><label for="f-targetWeight">目标体重 kg</label>${num('targetWeight', p.targetWeight, '可选')}</div>
    <div class="field"><label for="f-goal">目标</label>${sel('goal', [['auto', '按 BMI 和腰围自动判断'], ['cut', '减脂'], ['bulk', '增肌']], p.goal)}</div>
  </div><div class="stack"><label class="switch"><input type="checkbox" id="f-gout" ${p.gout ? 'checked' : ''}>高尿酸 / 痛风（表17 第22问）</label><label class="switch"><input type="checkbox" id="f-diabetes" ${p.diabetes ? 'checked' : ''}>胰岛素抵抗 / 二型糖尿病（表17 第23问）</label></div></fieldset>
  <fieldset><legend>力量训练</legend>
    <label class="switch"><input type="checkbox" id="f-lift" ${p.lift !== false ? 'checked' : ''}>做力量训练（不做则按表8 无力训者，只能减脂）</label>
    <div class="fgrid">
    <div class="field"><label for="f-level">训练经验</label>${sel('level', [['new', '新手'], ['some', '有基础'], ['vet', '老手']], p.level)}</div>
    <div class="field"><label for="f-place">地点</label>${sel('place', [['gym', '健身房'], ['home', '家里（哑铃 + 弹力带）']], p.place)}</div>
    <div class="field"><label for="f-split">分化</label>${sel('split', [['auto', '按经验和次数自动选'], ['three', '三分化（表21）'], ['four_sh', '四分化肩单练（表22）'], ['four_arm', '四分化手臂单练（表23）'], ['home', '居家三分化（表24）']], p.split)}</div>
    <div class="field"><label for="f-focus">四分化重点</label>${sel('focus', [['auto', '肩（默认）'], ['arm', '手臂']], p.focus)}</div>
    <div class="field"><label for="f-liftTime">开始训练时间</label>${time('liftTime', p.liftTime)}</div>
    <div class="field"><label for="f-schedMode">训练日安排</label>${sel('schedMode', [['weekly', '固定星期几'], ['workdays', '所有工作日（含调休补班）'], ['free', '不固定，每天自己决定']], p.schedMode)}</div>
    </div>
    <div class="field"><label>固定哪几天练（选“固定星期几”时有效）</label>${dows('liftDays', p.liftDays)}</div>
    <label class="switch"><input type="checkbox" id="f-skipHolidays" ${p.skipHolidays !== false ? 'checked' : ''}>法定节假日自动跳过力训（不影响连续打卡）</label>
    <label class="switch"><input type="checkbox" id="f-cardioSkipHolidays" ${p.cardioSkipHolidays ? 'checked' : ''}>有氧也在节假日跳过</label>
    <div class="field"><label>想练的部位（不勾的部位从 Excel 计划里去掉）</label><div class="chips">${window.PARTS.map(pt => `<label class="switch" style="border:1px solid var(--line);border-radius:99px;padding:4px 12px"><input type="checkbox" data-part="${pt.id}" ${p.parts[pt.id] !== false ? 'checked' : ''}>${pt.name}</label>`).join('')}</div></div>
  </fieldset>
  <fieldset><legend>有氧（按表16 计算消耗）</legend>${cardio}<div class="field"><label for="f-cardioTime">有氧开始时间（非力训日）</label>${time('cardioTime', p.cardioTime)}</div></fieldset>
  <fieldset><legend>作息和吃饭</legend><div class="fgrid">
    <div class="field"><label for="f-wake">起床</label>${time('wake', p.wake)}</div><div class="field"><label for="f-breakfast">早饭</label>${time('breakfast', p.breakfast)}</div>
    <div class="field"><label for="f-lunch">午饭</label>${time('lunch', p.lunch)}</div><div class="field"><label for="f-dinner">晚饭</label>${time('dinner', p.dinner)}</div>
    <div class="field"><label for="f-sleep">睡觉</label>${time('sleep', p.sleep)}</div><div class="field"><label for="f-lunchCost">午饭价格（元）</label>${num('lunchCost', p.lunchCost, '30')}</div>
    <div class="field" style="grid-column:1/-1"><label for="f-sheet">饮食表</label>${sel('sheet', sheets, p.sheet)}</div>
  </div>
    <label class="switch"><input type="checkbox" id="f-eggsMilk" ${p.eggsMilk !== false ? 'checked' : ''}>早饭能吃鸡蛋和牛奶</label>
    <label class="switch"><input type="checkbox" id="f-budget" ${p.budget ? 'checked' : ''}>省钱模式：午饭是自助，多吃肉和饭；晚饭用馒头加鸡蛋</label>
  </fieldset>
  <button class="btn block" type="submit">${first ? '生成我的计划' : '保存并重新生成计划'}</button><p class="small" id="ferr" role="alert" style="color:var(--warn)"></p></form>`;
  if (!first) h += settingsExtra();
  return h;
}
function settingsExtra() {
  const ai = S.ai, native = isNative();
  return `<div class="card"><h2>拍照识别（接入大模型）</h2>
    <div class="field"><label for="ai-preset">服务商</label><select class="in" id="ai-preset">${AI.PRESETS.map(x => `<option value="${x.id}" ${ai.preset === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="ai-base">接口地址</label><input class="in" id="ai-base" value="${esc(ai.base)}" placeholder="https://…/v1"></div>
    <div class="field"><label for="ai-key">API Key（只存在这台手机上）</label><input class="in" id="ai-key" type="password" value="${esc(ai.key)}" autocomplete="off"></div>
    <div class="row"><button class="btn small" id="ai-scan">扫描可用模型</button><span class="xs muted" id="ai-msg"></span></div>
    <div class="field"><label for="ai-model">模型（带“图”的通常支持看图）</label><select class="in" id="ai-model">${(ai.models || []).map(m => `<option value="${esc(m.id)}" ${ai.model === m.id ? 'selected' : ''}>${esc(m.id)}${m.vision ? '（图）' : ''}</option>`).join('')}${ai.model && !(ai.models || []).some(m => m.id === ai.model) ? `<option selected>${esc(ai.model)}</option>` : ''}</select></div>
    <div class="field"><label for="ai-manual">或手动填模型 ID</label><input class="in" id="ai-manual" placeholder="例如 qwen-vl-max" value=""></div>
    <button class="btn ghost small" id="ai-save">保存接口设置</button>
    <details><summary class="xs muted">内置的饮食识别助手提示词</summary><pre class="xs" style="white-space:pre-wrap">${esc(AI.systemPrompt())}</pre></details></div>
  <div class="card"><h2>提醒</h2><label class="switch"><input type="checkbox" id="nt-on" ${S.notify.on ? 'checked' : ''} ${native ? '' : 'disabled'}>按时间线发通知（未来 7 天，每次打开 App 自动续排）</label>
    <p class="xs muted">${native ? '需要允许通知权限。部分手机还要在系统设置里允许“自启动 / 后台运行”，否则可能收不到。' : '通知只在安卓 App 里有效，网页版请用手机日历提醒。'}</p></div>
  <div class="card"><h2>节假日数据</h2><p class="small muted">已内置 2026 年（${Object.keys(window.HOLIDAYS_BUNDLED).length} 天）。国务院每年 11 月前后公布下一年安排，公布后联网点更新。</p><button class="btn ghost small" id="hd-up">联网更新节假日</button></div>
  <div class="card"><h2>数据备份</h2><p class="small muted">所有数据都只在这台手机上。换手机或重装前，先导出备份。</p><div class="row"><button class="btn ghost small" id="bk-out">导出备份</button><button class="btn ghost small" id="bk-in">导入备份</button></div></div>
  <div class="card"><h2>版本 ${APP_VERSION}</h2><button class="btn ghost small" id="up-check">检查更新</button><p class="xs muted" id="up-msg"></p></div>
  <div class="card"><h2>出处和致谢</h2><div class="small stack">
    <p>饮食和训练规则：${esc(window.SRC_BOOK)}。配套讲解：B站 BV1zu4m1N76R（饮食）、BV1Hk4y187jF（训练）、BV1mM6JY6Ei9（解剖）。</p>
    <p>动作图片：free-exercise-db（github.com/yuhonas/free-exercise-db，Unlicense 公有领域）。</p>
    <p>节假日：holiday-cn（github.com/NateScarlet/holiday-cn），整理自国务院办公厅通知。</p>
    <p class="xs muted">本应用是个人学习用的工具，不能代替医生建议。训练中出现头晕、胸闷或关节疼痛，请停止并就医。</p></div></div>`;
}
function bindMe(first) {
  $$('[data-dows] button').forEach(b => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'));
  const imp = $('#importFirst'); if (imp) imp.onclick = importBackup;
  $('#pform').onsubmit = e => {
    e.preventDefault();
    const v = id => $('#f-' + id).value.trim(), ck = id => $('#f-' + id).checked;
    const days = id => $$(`[data-dows="${id}"] button`).filter(b => b.getAttribute('aria-pressed') === 'true').map(b => +b.dataset.i);
    const parts = {}; $$('[data-part]').forEach(c => parts[c.dataset.part] = c.checked);
    const cardio = [0, 1, 2].map(i => {
      const g = f => ($(`[data-c="${i}|${f}"]`) || {}).value;
      return { kind: g('kind'), minutes: +g('minutes') || 0, pace: +g('pace') || 8, hr: +g('hr') || '', rhr: +g('rhr') || '', days: days('cd' + i) };
    }).filter(a => a.kind !== '无' && a.minutes > 0 && a.days.length);
    const p = Object.assign({}, S.profile || {}, {
      name: v('name'), sex: v('sex'), age: +v('age'), height: +v('height'), weight: +v('weight'), waist: +v('waist') || '', targetWeight: +v('targetWeight') || '',
      goal: v('goal'), gout: ck('gout'), diabetes: ck('diabetes'), lift: ck('lift'), level: v('level'), place: v('place'), split: v('split'), focus: v('focus'),
      liftTime: v('liftTime'), schedMode: v('schedMode'), liftDays: days('liftDays'), skipHolidays: ck('skipHolidays'), cardioSkipHolidays: ck('cardioSkipHolidays'), parts, cardio, cardioTime: v('cardioTime'),
      wake: v('wake'), breakfast: v('breakfast'), lunch: v('lunch'), dinner: v('dinner'), sleep: v('sleep'), lunchCost: +v('lunchCost') || 30, sheet: v('sheet'),
      eggsMilk: ck('eggsMilk'), budget: ck('budget'),
    });
    const errs = [];
    if (!(p.age >= 14 && p.age <= 80)) errs.push('年龄'); if (!(p.height >= 130 && p.height <= 220)) errs.push('身高'); if (!(p.weight >= 35 && p.weight <= 200)) errs.push('体重');
    if (p.lift && p.schedMode === 'weekly' && !p.liftDays.length) errs.push('至少选一天力训');
    if (p.lift && !Object.values(parts).some(Boolean)) errs.push('至少选一个部位');
    if (p.goal === 'bulk' && !p.lift) errs.push('增肌必须做力训（表13 E24）');
    if (errs.length) { $('#ferr').textContent = '请检查：' + errs.join('、'); return; }
    p.startDate = p.startDate || today(); p.startWeight = p.startWeight || p.weight;
    S.profile = p; LS.set('profile', p); rebuild();
    toast(first ? '计划已生成' : '已保存，计划已更新');
    S.tab = first ? 'today' : 'plan'; render(); scrollTo(0, 0); scheduleNotifs();
  };
  if (first) return;
  $('#ai-preset').onchange = () => { const pr = AI.PRESETS.find(x => x.id === $('#ai-preset').value); if (pr.base) $('#ai-base').value = pr.base; };
  const collect = () => { const pr = AI.PRESETS.find(x => x.id === $('#ai-preset').value); return { ...S.ai, preset: pr.id, type: pr.type, base: $('#ai-base').value.trim(), key: $('#ai-key').value.trim() }; };
  $('#ai-scan').onclick = async () => {
    const cfg = collect(); $('#ai-msg').textContent = '扫描中…';
    try {
      const models = await AI.listModels(cfg);
      S.ai = { ...cfg, models, model: S.ai.model && models.some(m => m.id === S.ai.model) ? S.ai.model : AI.defaultModel(cfg, models) };
      LS.set('ai', S.ai); render(); toast(`找到 ${models.length} 个模型`);
    } catch (e) { $('#ai-msg').textContent = e.message; }
  };
  $('#ai-save').onclick = () => { const cfg = collect(); const man = $('#ai-manual').value.trim(); S.ai = { ...cfg, model: man || $('#ai-model').value }; LS.set('ai', S.ai); toast('接口设置已保存'); render(); };
  const nt = $('#nt-on'); if (nt) nt.onchange = async () => { S.notify.on = nt.checked; LS.set('notify', S.notify); if (nt.checked) { const ok = await scheduleNotifs(true); if (!ok) { S.notify.on = false; LS.set('notify', S.notify); render(); } } else cancelNotifs(); };
  $('#hd-up').onclick = updateHolidays;
  $('#bk-out').onclick = exportBackup; $('#bk-in').onclick = importBackup;
  $('#up-check').onclick = checkUpdate;
}

/* ============ 提醒（安卓本地通知） ============ */
function isNative() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
function LN() { return window.capacitorLocalNotifications && window.capacitorLocalNotifications.LocalNotifications; }
async function cancelNotifs() {
  const ln = LN(); if (!ln || !isNative()) return;
  try { const p = await ln.getPending(); if (p.notifications.length) await ln.cancel({ notifications: p.notifications.map(n => ({ id: n.id })) }); } catch (e) { /* 忽略 */ }
}
async function scheduleNotifs(ask) {
  const ln = LN(); if (!ln || !isNative() || !S.profile) return false;
  if (!S.notify.on && !ask) return false;
  try {
    let perm = await ln.checkPermissions();
    if (perm.display !== 'granted') { if (!ask) return false; perm = await ln.requestPermissions(); }
    if (perm.display !== 'granted') { toast('没有通知权限，提醒已关闭'); return false; }
    await cancelNotifs();
    const now = Date.now(), list = [];
    for (let i = 0; i < 7; i++) {
      const d = E.addDays(today(), i), { tasks } = tasksFor(d), r = peek(d) || { done: {} };
      tasks.forEach((t, k) => {
        if (t.optional || (r.done && r.done[t.id])) return;
        const [hh, mm] = t.time.split(':').map(Number); const at = E.pd(d); at.setHours(hh, mm, 0, 0);
        if (E.tm(t.time) < E.tm(S.profile.wake) - 60) at.setDate(at.getDate() + 1);
        if (at.getTime() <= now + 30000) return;
        let body = t.detail || '';
        if (t.kind === 'meal') body = `碳水 ${t.meal.c}g，蛋白质 ${t.meal.p}g。${t.meal.foods.c[0] || ''}；${t.meal.foods.p[0] || ''}`;
        list.push({ id: (i + 1) * 100 + k, title: `${t.time} ${t.title}`, body: body.slice(0, 180), schedule: { at, allowWhileIdle: true } });
      });
    }
    if (list.length) await ln.schedule({ notifications: list });
    if (ask) toast(`已安排未来 7 天的 ${list.length} 条提醒`);
    return true;
  } catch (e) { toast('设置提醒失败：' + (e.message || e)); return false; }
}

/* ============ 节假日、备份、更新 ============ */
async function updateHolidays() {
  const y = new Date().getFullYear(); let n = 0;
  for (const year of [y, y + 1]) {
    for (const base of ['https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/', 'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/']) {
      try {
        const res = await fetch(base + year + '.json'); if (!res.ok) continue;
        const d = await res.json(); (d.days || []).forEach(x => { S.holidays[x.date] = [x.name, x.isOffDay]; n++; });
        break;
      } catch (e) { /* 换下一个地址 */ }
    }
  }
  LS.set('holidays', S.holidays);
  toast(n ? `已更新 ${n} 天节假日安排` : '没有获取到数据，请检查网络'); render();
}
function exportBackup() {
  const text = JSON.stringify({ app: 'lianchi-daily', version: APP_VERSION, at: new Date().toISOString(), data: LS.all() });
  showModal(`<h2>导出备份</h2><p class="xs muted">复制下面全部内容，保存到备忘录或发给自己。备份里包含 API Key，不要发给别人。</p><textarea class="in num" id="bk-t" style="min-height:200px;font-size:11px">${esc(text)}</textarea><div class="row"><button class="btn" id="bk-c">复制</button><button class="btn ghost" id="bk-x">关闭</button></div>`, () => {
    $('#bk-x').onclick = hideModal;
    $('#bk-c').onclick = async () => { try { await navigator.clipboard.writeText(text); toast('已复制'); } catch (e) { $('#bk-t').select(); toast('请长按选择后复制'); } };
  });
}
function importBackup() {
  showModal(`<h2>导入备份</h2><p class="xs muted">粘贴导出的备份内容。导入会覆盖这台手机上的同名数据。</p><textarea class="in num" id="bi-t" style="min-height:200px;font-size:11px"></textarea><div class="row"><button class="btn" id="bi-ok">导入</button><button class="btn ghost" id="bi-x">取消</button></div><p class="small" id="bi-err" style="color:var(--warn)"></p>`, () => {
    $('#bi-x').onclick = hideModal;
    $('#bi-ok').onclick = () => {
      try {
        const obj = JSON.parse($('#bi-t').value);
        if (!obj || obj.app !== 'lianchi-daily' || !obj.data) throw new Error('不是练吃日课的备份');
        Object.entries(obj.data).forEach(([k, v]) => { if (k.startsWith('lcd:')) localStorage.setItem(k, v); });
        location.reload();
      } catch (e) { $('#bi-err').textContent = '导入失败：' + e.message; }
    };
  });
}
function newer(a, b) { const x = a.replace(/^v/, '').split('.').map(Number), y = b.replace(/^v/, '').split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }
async function checkUpdate() {
  const msg = $('#up-msg'); msg.textContent = '检查中…';
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('GitHub 返回 ' + res.status);
    const rel = await res.json();
    const apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name));
    if (newer(rel.tag_name || '0', APP_VERSION)) {
      msg.innerHTML = `有新版本 ${esc(rel.tag_name)}：${esc((rel.body || '').slice(0, 200))}<br><a href="${esc(apk ? apk.browser_download_url : rel.html_url)}" target="_blank" rel="noopener">下载安装包</a>（覆盖安装，数据会保留）`;
    } else msg.textContent = `已经是最新版本（${APP_VERSION}）`;
  } catch (e) { msg.textContent = '检查失败：' + e.message + '。国内网络访问 GitHub 可能不稳定，可以稍后再试。'; }
}

/* ============ 渲染与启动 ============ */
function rebuild() { S.plan = E.build(S.profile); }
function render() {
  const app = $('#app');
  if (!S.profile) { app.innerHTML = viewMe(true); $('#tabs').hidden = true; bindMe(true); return; }
  $('#tabs').hidden = false;
  $$('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false'));
  if (S.tab !== 'train') clearInterval(animT);
  if (S.tab === 'today') { app.innerHTML = A.viewToday(); A.bindToday(); }
  else if (S.tab === 'train') { app.innerHTML = viewTrain(); bindTrain(); }
  else if (S.tab === 'stats') app.innerHTML = viewStats();
  else if (S.tab === 'plan') { app.innerHTML = viewPlan(); bindPlan(); }
  else { app.innerHTML = viewMe(false); bindMe(false); }
}
window.__render = render;
A.render = render;
$$('#tabs button').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; if (S.tab === 'today' || S.tab === 'train') S.day = today(); render(); scrollTo(0, 0); });
(function boot() {
  const p = LS.get('profile');
  if (p) { S.profile = Object.assign({}, DEF, p, { parts: Object.assign({}, DEF.parts, p.parts || {}) }); rebuild(); }
  render();
  setInterval(() => A.updateNow(), 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.profile) { if (S.tab === 'today') { S.day = today(); render(); } scheduleNotifs(); } });
  if (S.profile) scheduleNotifs();
})();
})();
