/* 训练：动作卡组 + 全部动作列表 */
(() => {
const { E, $, $$, esc, today, S, LS, peek, rec, save, saveCustom, dayInfo, scoreDay, training, sessionInfo, sessionItems, LIB,
  badges, celebrate, toast, sheet, close, askScope, confetti, imgUrl, head, bindHead, render, allDays } = C;
const { I } = Kit;
S.exLater = S.exLater || {};

function lastLift(v, before) {
  const days = allDays(E.addDays(before, -1)).reverse();
  for (const d of days) { const r = peek(d); const s = r && r.sets && r.sets[v]; if (s && s.some(x => x && x.w)) return s.filter(x => x && x.w).map(x => `${x.w}×${x.r || '?'}`).join('  '); }
  return '';
}
const doneSets = (r, it) => ((r.sets || {})[it.v] || []).slice(0, it.sets).filter(x => x && x.done).length;
function exBody(it, idx, n, r, d, future) {
  const ex = it.ex, sets = ((r.sets || {})[it.v]) || [], last = lastLift(it.v, d);
  return `<div class="ex-hero"><img data-anim="${esc(ex.img)}" src="${imgUrl(ex, 0)}" alt="${esc(ex.n)}"><span class="badge">${idx + 1} / ${n} · ${esc(it.group.name)}</span></div>
    <div><div class="dc-title" style="font-size:24px">${esc(ex.n)}</div><div class="dc-sub">${it.sets} 组 × ${esc(it.reps)} 次 · 组间休息 ${esc(it.rest)}</div></div>
    <div class="t-foot l2">${esc(ex.eq)} · ${esc(it.fail)}${last ? ` · 上次 <span class="num">${esc(last)}</span>` : ''}</div>
    <div class="sets">${[...Array(it.sets)].map((_, i) => { const s = sets[i] || {}; return `<div class="set"><span class="n">${i + 1}</span><input class="field-in" data-set="${it.v}|${i}|w" value="${esc(s.w || '')}" placeholder="kg" inputmode="decimal" aria-label="第${i + 1}组重量" ${future ? 'disabled' : ''}><input class="field-in" data-set="${it.v}|${i}|r" value="${esc(s.r || '')}" placeholder="次数" inputmode="numeric" aria-label="第${i + 1}组次数" ${future ? 'disabled' : ''}><button class="hit" data-sd="${it.v}|${i}" aria-label="第${i + 1}组完成" ${future ? 'disabled' : ''}>${Kit.chk(!!s.done)}</button></div>`; }).join('')}</div>
    <div class="ghost-row">${it.alts.length ? `<button class="tbtn" data-swap="${it.v}">换动作（${it.alts.length}）</button>` : ''}<button class="tbtn" data-big="${it.v}">动作图</button></div>`;
}
function viewTrain() {
  const p = S.profile, d = S.day;
  if (p.lift === false) return head('训练') + '<section class="mat card"><div class="t-headline">没有安排力量训练</div><p class="t-sub l2">你设置了不做力训，饮食按表8《无力训者》。想开始力训，到“我的 → 编辑资料”打开。</p></section>';
  const tr = training(), info = dayInfo(d), r = peek(d) || {};
  const { si, items, femaleSkip, optionalGroups } = sessionItems(d);
  const future = d > today(), doneLift = r.done && r.done.lift;
  const total = items.reduce((s, x) => s + x.sets, 0), setsDone = items.reduce((s, it) => s + doneSets(r, it), 0);
  let h = head('训练', d, tr.splitName.replace('健身房', ''));
  h += `<div class="seg-scroll glass">${tr.days.map((dd, i) => `<button data-day="${i}" aria-pressed="${!si.custom && si.dayIdx === i}">${esc(dd.name)}${si.recommended && si.dayIdx === i ? '<span class="rec">推荐</span>' : ''}</button>`).join('')}<button data-day="custom" aria-pressed="${!!si.custom}">自选部位</button></div>`;
  if (!info.lift && !doneLift) h += `<section class="note mat">${info.h && info.h.off ? `今天是${esc(info.h.name)}，力训已自动跳过。` : '今天没有安排力训。'} <button class="link" data-ov="lift">今天加练</button></section>`;
  if (femaleSkip) h += '<section class="note warn mat">女性每两轮三分化跳过一次胸日，这次可以换别的部位（表21 C14）</section>';
  h += `<section class="mat card hero"><div class="hero-top"><div class="fig hero-fig">${setsDone}<small>/ ${total} 组</small></div><div class="hero-cap">${doneLift ? '今天练完了' : '约 ' + Math.round(total * 3.2) + ' 分钟'}<br><span class="l3">${items.length} 个动作</span></div></div><div class="progress ok"><i style="width:${total ? Math.round(setsDone / total * 100) : 0}%"></i></div></section>`;
  // 卡组：没做完的动作
  const later = S.exLater[d] || [];
  const open = items.map((it, i) => ({ it, i })).filter(x => doneSets(r, x.it) < x.it.sets);
  const order = open.filter(x => !later.includes(x.it.v)).concat(later.map(v => open.find(x => x.it.v === v)).filter(Boolean));
  h += `<section class="section"><div class="section-h"><h2>当前动作</h2><span class="t-foot l2">${order.length ? `还剩 ${order.length} 个` : ''}</span></div>
    ${Kit.deck('exDeck', order.map(x => ({ key: x.it.v, cls: 'k-train', html: exBody(x.it, x.i, items.length, r, d, future) })), doneLift ? '<div class="t-title3" style="color:var(--ink)">今天练完了</div>' : '<div class="t-title3" style="color:var(--ink)">动作都做完了</div><div class="t-foot">点下面的“完成训练”</div>')}
    ${order.length && !future ? `<div class="deck-ctrl"><button class="pill glass" data-skip>${I.later}先跳过</button><button class="pill ink" data-exdone>${I.check}做完了</button></div>` : ''}</section>`;
  // 全部动作
  h += `<section class="section"><div class="section-h"><h2>全部动作</h2><button class="link" id="editEx">${S.edit ? '完成' : '编辑'}</button></div><div class="list mat">`;
  items.forEach(it => {
    const dn = doneSets(r, it);
    h += `<div class="row" style="grid-template-columns:48px 1fr auto">${S.edit ? `<button class="hit" data-exdel="${it.v}" aria-label="删除 ${esc(it.ex.n)}" style="margin:0;justify-items:start"><span class="del">−</span></button>` : `<img class="thumb" src="${imgUrl(it.ex, 0)}" alt="" loading="lazy">`}
      <button class="row-main" data-exopen="${it.v}"><span class="row-title">${esc(it.ex.n)}</span><span class="row-sub">${esc(it.group.name)} · ${it.sets} × ${esc(it.reps)}</span></button>
      ${S.edit ? `<span class="stepper"><button data-st="${it.v}|-1" aria-label="减一组">−</button><span>${it.sets}</span><button data-st="${it.v}|1" aria-label="加一组">+</button></span>` : `<span class="row-val">${dn === it.sets ? Kit.chk(true) : dn + ' / ' + it.sets}</span>`}</div>`;
  });
  if (S.edit) h += `<button class="row add" id="addEx"><span class="plus">+</span><span class="row-title">从动作库添加</span></button>`;
  h += '</div>';
  if (optionalGroups.length && !S.edit) h += `<div class="list-footer">${(p.level || 'new') === 'new' ? '新手偶尔加做' : '本次可选'}：${optionalGroups.map(g => `<button class="link" data-extra="${g.id}" style="min-height:32px">＋${esc(g.name)}</button>`).join('　')}</div>`;
  h += '</section>';
  h += `<button class="pill ${doneLift ? 'glass' : 'ink'} wide" id="finish" ${future ? 'disabled' : ''}>${doneLift ? '已完成 · 撤销' : '完成训练'}</button>`;
  h += '<p class="t-cap l3" style="text-align:center">动作、组数、次数来自表21-24，出处见“我的 → 规则与出处”</p>';
  return h;
}
function setOf(d, v, k) { const r = rec(d); r.sets = r.sets || {}; r.sets[v] = r.sets[v] || []; return r.sets[v][k] || (r.sets[v][k] = {}); }
function modsOf(d, key, scope, fn) { if (scope === 'tpl') { const m = S.custom.train[key] || (S.custom.train[key] = {}); fn(m); saveCustom(); } else { const r = rec(d); r.ex = r.ex || {}; fn(r.ex); save(d); } }
function ensureSession(d) { const r = rec(d); if (!r.session) { const si = sessionInfo(d); r.session = { split: training().split.key, dayIdx: si.dayIdx }; } }
function bindSetInputs(root, d, items) {
  root.querySelectorAll('[data-set]').forEach(i => i.oninput = () => { const [v, k, f] = i.dataset.set.split('|'); setOf(d, v, +k)[f] = i.value.trim(); ensureSession(d); save(d); });
  root.querySelectorAll('[data-sd]').forEach(b => b.onclick = () => {
    const [v, k] = b.dataset.sd.split('|'); const s = setOf(d, v, +k); s.done = !s.done; ensureSession(d); save(d); Kit.haptic(s.done ? 'medium' : 'light');
    b.innerHTML = Kit.chk(s.done);
    const it = items.find(x => x.v === v), r = rec(d);
    if (doneSets(r, it) === it.sets) { toast(`${it.ex.n} 完成`); setTimeout(() => { close(); afterSets(d, items); }, 350); }
  });
  root.querySelectorAll('[data-swap]').forEach(b => b.onclick = () => swap(items, items.findIndex(x => x.v === b.dataset.swap)));
  root.querySelectorAll('[data-big]').forEach(b => b.onclick = () => bigImage(items.find(x => x.v === b.dataset.big).ex));
}
function afterSets(d, items) {
  const r = rec(d);
  if (items.every(it => doneSets(r, it) >= it.sets) && !(r.done && r.done.lift)) finish(true); else { const y = scrollY; render(); scrollTo(0, y); }
}
function bindTrain() {
  bindHead();
  const d = S.day;
  if (S.profile.lift === false) return;
  const tr = training(), { si, items } = sessionItems(d);
  const deckEl = $('#exDeck');
  if (deckEl && d <= today()) {
    Kit.bindDeck('exDeck', v => { const it = items.find(x => x.v === v); for (let k = 0; k < it.sets; k++) setOf(d, v, k).done = true; ensureSession(d); save(d); afterSets(d, items); },
      v => { const l = S.exLater[d] = (S.exLater[d] || []).filter(x => x !== v); l.push(v); render(); });
    bindSetInputs(deckEl, d, items);
  }
  const ed = $('[data-exdone]'); if (ed) ed.onclick = () => deckEl.flyRight();
  const sk = $('[data-skip]'); if (sk) sk.onclick = () => deckEl.flyLeft();
  $('#editEx').onclick = () => { S.edit = !S.edit; render(); };
  $$('[data-ov]').forEach(b => b.onclick = () => { rec(d).override = b.dataset.ov; scoreDay(d); render(); });
  $$('[data-day]').forEach(b => b.onclick = () => { Kit.haptic('light'); if (b.dataset.day === 'custom') return pickCustom(); rec(d).session = { split: tr.split.key, dayIdx: +b.dataset.day }; save(d); render(); });
  $$('[data-extra]').forEach(b => b.onclick = () => { const r = rec(d); r.extra = r.extra || {}; r.extra[b.dataset.extra] = true; save(d); render(); });
  $$('[data-exopen]').forEach(b => b.onclick = () => { const i = items.findIndex(x => x.v === b.dataset.exopen); sheet(`<div class="k-train" style="display:grid;gap:14px;padding-top:16px">${exBody(items[i], i, items.length, peek(d) || {}, d, d > today())}</div>`, m => { bindSetInputs(m, d, items); m.onclick = e => { if (e.target === m) { close(); render(); } }; }); });
  $$('[data-exdel]').forEach(b => b.onclick = () => { const v = b.dataset.exdel; askScope(`删除「${window.EX[v].n}」`, sc => { modsOf(d, si.key, sc, m => { m.hide = (m.hide || []).concat(v); m.add = (m.add || []).filter(a => a.v !== v); }); render(); toast('已删除'); }); });
  $$('[data-st]').forEach(b => b.onclick = () => { const [v, dir] = b.dataset.st.split('|'); const it = items.find(x => x.v === v); modsOf(d, si.key, 'tpl', m => { m.sets = m.sets || {}; m.sets[v] = Math.max(1, Math.min(10, it.sets + +dir)); }); Kit.haptic('light'); render(); });
  const add = $('#addEx'); if (add) add.onclick = () => library(v => askScope(`添加「${window.EX[v].n}」`, sc => { modsOf(d, si.key, sc, m => { m.add = (m.add || []).filter(a => a.v !== v).concat({ v, sets: 3 }); m.hide = (m.hide || []).filter(x => x !== v); }); render(); toast('已添加'); }));
  $('#finish').onclick = () => finish(!(peek(d) && peek(d).done && peek(d).done.lift));
  animate();
}
function finish(on) {
  const d = S.day, r = rec(d), before = badges().filter(b => b.got).length;
  ensureSession(d);
  if (on) { r.done.lift = true; if (!dayInfo(d).lift) r.override = 'lift'; } else delete r.done.lift;
  scoreDay(d); render();
  if (on) { Kit.haptic('success'); toast('训练完成，+10 能量'); confetti(); celebrate(before); }
}
function pickCustom() {
  const tr = training();
  sheet(`<h2>自选部位</h2><div class="sheet-sub">动作和组数仍按原表</div>${tr.days.map((dd, i) => `<div style="display:grid;gap:8px"><div class="t-foot l2">${esc(dd.name)}</div><div class="chips">${dd.groups.map(g => `<button data-cg="${i}|${g.id}" aria-pressed="false">${esc(g.name)}</button>`).join('')}</div></div>`).join('')}<button class="pill ink wide" id="cg-ok">开始</button>`, m => {
    m.querySelectorAll('[data-cg]').forEach(b => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'));
    m.querySelector('#cg-ok').onclick = () => {
      const groups = [...m.querySelectorAll('[data-cg][aria-pressed="true"]')].map(b => { const [di, gid] = b.dataset.cg.split('|'); return { dayIdx: +di, gid }; });
      if (!groups.length) { toast('至少选一个肌群'); return; }
      rec(S.day).session = { custom: true, split: tr.split.key, groups }; save(S.day); close(); render();
    };
  });
}
function swap(items, idx) {
  const it = items[idx], g = it.group;
  sheet(`<h2>替换动作</h2><div class="sheet-sub">${esc(it.ex.n)} 的备选，来自原表同一肌群</div><div class="libgrid">${it.alts.map(v => { const ex = window.EX[v]; return `<button class="libitem" data-alt="${v}"><img src="${imgUrl(ex, 0)}" alt="" loading="lazy"><span>${esc(ex.n)}</span><small>${esc(ex.eq)}</small></button>`; }).join('')}</div><p class="t-cap l3" style="text-align:center">${esc(g.src)}</p>`, m => {
    m.querySelectorAll('[data-alt]').forEach(b => b.onclick = () => {
      const key = g.sheet + ':' + g.id, nv = b.dataset.alt;
      S.choices[key] = items.filter(x => x.group === g).map(x => x.v === it.v ? nv : x.v).filter((v, i, a) => a.indexOf(v) === i);
      LS.set('choices', S.choices); close(); Kit.haptic('light'); render(); toast('已换成 ' + window.EX[nv].n);
    });
  });
}
function library(onPick) {
  const byPart = {};
  Object.values(LIB).forEach(x => { if (S.profile.place === 'home' && !/徒手|哑铃|弹力带|单杠|瑜伽垫/.test(x.ex.eq)) return; (byPart[x.part] = byPart[x.part] || []).push(x); });
  const parts = Object.keys(byPart); let cur = parts[0];
  const draw = () => sheet(`<h2>动作库</h2><div class="segmented">${parts.map(p => `<button data-pt="${esc(p)}" aria-pressed="${p === cur}">${esc(p)}</button>`).join('')}</div>
    <div class="libgrid">${byPart[cur].map(x => `<button class="libitem" data-add="${x.v}"><img src="${imgUrl(x.ex, 0)}" alt="" loading="lazy"><span>${esc(x.ex.n)}</span><small>${esc(x.group)} · ${esc(x.ex.eq)}</small></button>`).join('')}</div>`, m => {
    m.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { cur = b.dataset.pt; draw(); });
    m.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { close(); onPick(b.dataset.add); });
  });
  draw();
}
function bigImage(ex) {
  sheet(`<h2>${esc(ex.n)}</h2><img class="bigimg" src="${imgUrl(ex, 0)}" alt="起始动作"><img class="bigimg" src="${imgUrl(ex, 1)}" alt="结束动作"><p class="t-foot l2">器械：${esc(ex.eq)}。图片来自 free-exercise-db（公有领域）${ex.approx ? '，这是相近动作的示意' : ''}。</p>`);
}
let animT;
function animate() {
  clearInterval(animT);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let f = 0; animT = setInterval(() => { f = 1 - f; $$('img[data-anim]').forEach(img => img.src = `img/ex/${img.dataset.anim}/${f}.jpg`); }, 1200);
}
window.Train = { view: viewTrain, bind: bindTrain, stop: () => clearInterval(animT) };
})();
