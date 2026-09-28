/* 训练：动作卡片 */
(() => {
const { E, $, $$, esc, today, S, LS, peek, rec, save, saveCustom, ICON, dayInfo, scoreDay, training, sessionInfo, sessionItems, LIB,
  badges, celebrate, toast, sheet, close, askScope, confetti, imgUrl, head, bindHead, render, allDays } = C;

function lastLift(v, before) {
  const days = allDays(E.addDays(before, -1)).reverse();
  for (const d of days) { const r = peek(d); const s = r && r.sets && r.sets[v]; if (s && s.some(x => x && x.w)) return s.filter(x => x && x.w).map(x => `${x.w}×${x.r || '?'}`).join('  '); }
  return '';
}
function viewTrain() {
  const p = S.profile, d = S.day;
  if (p.lift === false) return head('训练') + '<div class="card"><p>你设置了不做力量训练，饮食按表8《无力训者》。减脂需要的热量缺口可以只靠饮食提供。</p><p class="sm sub">想开始力训，去“我的 → 编辑资料”打开。</p></div>';
  const tr = training(), info = dayInfo(d), r = peek(d) || {};
  const { si, items, femaleSkip, optionalGroups } = sessionItems(d);
  const future = d > today(), doneLift = r.done && r.done.lift;
  const total = items.reduce((s, x) => s + x.sets, 0);
  const setsDone = items.reduce((s, it) => s + ((r.sets || {})[it.v] || []).slice(0, it.sets).filter(x => x && x.done).length, 0);
  let h = head('训练', d, `<span class="tag train">${esc(tr.splitName.replace('健身房', ''))}</span>`);
  h += `<div class="chips">${tr.days.map((dd, i) => `<button class="chip" data-day="${i}" aria-pressed="${!si.custom && si.dayIdx === i}">${esc(dd.name)}${si.recommended && si.dayIdx === i ? '<span class="rec">推荐</span>' : ''}</button>`).join('')}<button class="chip" data-day="custom" aria-pressed="${!!si.custom}">自选部位</button></div>`;
  if (!info.lift && !doneLift) h += `<div class="note">${info.h && info.h.off ? `今天是${esc(info.h.name)}，力训已自动跳过。` : '今天没有安排力训。'} <button class="textbtn" data-ov="lift">今天加练</button></div>`;
  if (femaleSkip) h += '<div class="note warn">女性每两轮三分化跳过一次胸日，这次可以换别的部位（表21 C14）</div>';
  h += `<div class="card hero"><div class="hero-top"><span class="sm"><b class="num">${setsDone}</b><span class="sub"> / ${total} 组</span>${doneLift ? ' <span class="tag done">已完成</span>' : ''}</span><span class="xs sub">约 ${Math.round(total * 3.2)} 分钟 · 练完拉伸</span></div><div class="progress"><i style="width:${total ? Math.round(setsDone / total * 100) : 0}%"></i></div></div>`;
  h += `<div class="section-title"><h2>动作</h2><button class="textbtn" id="editEx">${S.edit ? '完成' : '编辑'}</button></div><div class="list">`;
  items.forEach((it, idx) => h += exCard(it, idx, r, d, future));
  if (S.edit) h += '<button class="add-card" id="addEx">＋ 添加动作</button>';
  h += '</div>';
  if (optionalGroups.length && !S.edit) h += `<div class="note sm">${(p.level || 'new') === 'new' ? '新手偶尔加做' : '本次可选'}：${optionalGroups.map(g => `<button class="textbtn" data-extra="${g.id}">＋${esc(g.name)}</button>`).join(' ')}</div>`;
  h += `<button class="btn ${doneLift ? 'ghost' : 'primary'} block" id="finish" ${future ? 'disabled' : ''}>${doneLift ? '已完成，点击撤销' : '完成本次训练'}</button>`;
  h += '<p class="xs faint" style="text-align:center">动作、组数、次数来自表21-24；点“我的 → 规则与出处”查看每一项的单元格</p>';
  return h;
}
function exCard(it, idx, r, d, future) {
  const ex = it.ex, sets = ((r.sets || {})[it.v]) || [], open = S.open['ex' + it.v];
  const dn = sets.slice(0, it.sets).filter(x => x && x.done).length;
  let h = `<div class="ex">${S.edit ? `<button class="del" data-exdel="${it.v}" aria-label="删除 ${esc(ex.n)}">−</button>` : ''}
    <button class="ex-row" ${S.edit ? '' : `data-exopen="${it.v}"`} aria-expanded="${!!open}"><img class="ex-img" data-anim="${esc(ex.img)}" src="${imgUrl(ex, 0)}" alt="" loading="lazy">
      <span class="stack" style="gap:1px"><span class="ex-name">${esc(ex.n)}</span><span class="ex-meta">${it.sets} 组 × ${esc(it.reps)} 次 · 休息 ${esc(it.rest.replace(' 分钟', '分'))}</span></span>
      ${S.edit ? `<span class="stepper"><button data-st="${it.v}|-1" aria-label="减一组">−</button><span class="num">${it.sets}</span><button data-st="${it.v}|1" aria-label="加一组">＋</button></span>` : `<span class="ex-count">${dn}/${it.sets}</span>`}</button>`;
  if (open && !S.edit) {
    const last = lastLift(it.v, d);
    h += `<div class="ex-body"><div class="xs sub">${esc(it.group.name)} · ${esc(ex.eq)} · ${esc(it.fail)}${last ? ` · 上次 <span class="num">${esc(last)}</span>` : ''}</div>
      <div class="setgrid">${[...Array(it.sets)].map((_, i) => { const s = sets[i] || {}; return `<div class="setrow"><span class="n">${i + 1}</span><input class="in num" data-set="${it.v}|${i}|w" value="${esc(s.w || '')}" placeholder="kg" inputmode="decimal" aria-label="第${i + 1}组重量" ${future ? 'disabled' : ''}><input class="in num" data-set="${it.v}|${i}|r" value="${esc(s.r || '')}" placeholder="次数" inputmode="numeric" aria-label="第${i + 1}组次数" ${future ? 'disabled' : ''}><button class="chk" data-sd="${it.v}|${i}" aria-pressed="${!!s.done}" aria-label="第${i + 1}组完成" ${future ? 'disabled' : ''}>${ICON.check}</button></div>`; }).join('')}</div>
      <div class="row">${it.alts.length ? `<button class="btn ghost sm" data-swap="${idx}">换动作（${it.alts.length}）</button>` : ''}<button class="btn ghost sm" data-big="${idx}">看动作图</button></div></div>`;
  }
  return h + '</div>';
}
function bindTrain() {
  bindHead();
  const d = S.day;
  const tr = S.profile.lift === false ? null : training();
  if (!tr) return;
  const { si, items } = sessionItems(d);
  $('#editEx').onclick = () => { S.edit = !S.edit; render(); };
  $$('[data-ov]').forEach(b => b.onclick = () => { rec(d).override = b.dataset.ov; scoreDay(d); render(); });
  $$('[data-day]').forEach(b => b.onclick = () => { if (b.dataset.day === 'custom') return pickCustom(); rec(d).session = { split: tr.split.key, dayIdx: +b.dataset.day }; save(d); render(); });
  $$('[data-extra]').forEach(b => b.onclick = () => { const r = rec(d); r.extra = r.extra || {}; r.extra[b.dataset.extra] = true; save(d); render(); });
  $$('[data-exopen]').forEach(b => b.onclick = () => { const k = 'ex' + b.dataset.exopen; S.open[k] = !S.open[k]; const y = scrollY; render(); scrollTo(0, y); });
  $$('[data-set]').forEach(i => i.oninput = () => { const [v, k, f] = i.dataset.set.split('|'); const s = setOf(d, v, +k); s[f] = i.value.trim(); ensureSession(d); save(d); });
  $$('[data-sd]').forEach(b => b.onclick = () => {
    const [v, k] = b.dataset.sd.split('|'); const s = setOf(d, v, +k); s.done = !s.done; ensureSession(d); save(d);
    const r = rec(d); const all = items.every(it => [...Array(it.sets)].every((_, j) => ((r.sets[it.v] || [])[j] || {}).done));
    if (all && !(r.done && r.done.lift)) finish(true); else { const y = scrollY; render(); scrollTo(0, y); }
  });
  $$('[data-big]').forEach(b => b.onclick = () => bigImage(items[+b.dataset.big].ex));
  $$('[data-swap]').forEach(b => b.onclick = () => swap(items, +b.dataset.swap));
  $$('[data-exdel]').forEach(b => b.onclick = () => { const v = b.dataset.exdel; askScope(`删除「${window.EX[v].n}」`, sc => { modsOf(d, si.key, sc, m => { m.hide = (m.hide || []).concat(v); m.add = (m.add || []).filter(a => a.v !== v); }); render(); toast('已删除'); }); });
  $$('[data-st]').forEach(b => b.onclick = () => {
    const [v, dir] = b.dataset.st.split('|'); const it = items.find(x => x.v === v); const n = Math.max(1, Math.min(10, it.sets + +dir));
    modsOf(d, si.key, 'tpl', m => { m.sets = m.sets || {}; m.sets[v] = n; }); render();
  });
  const add = $('#addEx'); if (add) add.onclick = () => library(v => askScope(`添加「${window.EX[v].n}」`, sc => { modsOf(d, si.key, sc, m => { m.add = (m.add || []).filter(a => a.v !== v).concat({ v, sets: 3 }); m.hide = (m.hide || []).filter(x => x !== v); }); render(); toast('已添加'); }));
  $('#finish').onclick = () => finish(!(peek(d) && peek(d).done && peek(d).done.lift));
  animate();
}
function setOf(d, v, k) { const r = rec(d); r.sets = r.sets || {}; r.sets[v] = r.sets[v] || []; return r.sets[v][k] || (r.sets[v][k] = {}); }
/* 修改动作卡片：scope=tpl 存到“以后这一天都这样”，day 只改今天 */
function modsOf(d, key, scope, fn) {
  if (scope === 'tpl') { const m = S.custom.train[key] || (S.custom.train[key] = {}); fn(m); saveCustom(); }
  else { const r = rec(d); r.ex = r.ex || {}; fn(r.ex); save(d); }
}
function ensureSession(d) { const r = rec(d); if (!r.session) { const si = sessionInfo(d); r.session = { split: training().split.key, dayIdx: si.dayIdx }; } }
function finish(on) {
  const d = S.day, r = rec(d), before = badges().filter(b => b.got).length;
  ensureSession(d);
  if (on) { r.done.lift = true; if (!dayInfo(d).lift) r.override = 'lift'; } else delete r.done.lift;
  scoreDay(d); render();
  if (on) { toast('本次训练完成，+10 能量'); confetti(); celebrate(before); }
}
function pickCustom() {
  const tr = training();
  sheet(`<h2>自选今天练的部位</h2><p class="xs sub">从当前分化各天里挑肌群，动作和组数仍按原表</p>
    ${tr.days.map((dd, i) => `<div class="stack"><b class="sm">${esc(dd.name)}</b><div class="pills">${dd.groups.map(g => `<button data-cg="${i}|${g.id}" aria-pressed="false">${esc(g.name)}</button>`).join('')}</div></div>`).join('')}
    <button class="btn primary block" id="cg-ok">确定</button>`, () => {
    $$('[data-cg]').forEach(b => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'));
    $('#cg-ok').onclick = () => {
      const groups = $$('[data-cg][aria-pressed="true"]').map(b => { const [di, gid] = b.dataset.cg.split('|'); return { dayIdx: +di, gid }; });
      if (!groups.length) { toast('至少选一个肌群'); return; }
      rec(S.day).session = { custom: true, split: tr.split.key, groups }; save(S.day); close(); render();
    };
  });
}
function swap(items, idx) {
  const it = items[idx], g = it.group;
  sheet(`<h2>把「${esc(it.ex.n)}」换成</h2><p class="xs sub">备选来自原表同一肌群（${esc(g.src)}）</p>
    <div class="libgrid">${it.alts.map(v => { const ex = window.EX[v]; return `<button class="libitem" data-alt="${v}"><img src="${imgUrl(ex, 0)}" alt="" loading="lazy"><span>${esc(ex.n)}</span><small>${esc(ex.eq)}</small></button>`; }).join('')}</div>`, () => {
    $$('[data-alt]').forEach(b => b.onclick = () => {
      const key = g.sheet + ':' + g.id, nv = b.dataset.alt;
      S.choices[key] = items.filter(x => x.group === g).map(x => x.v === it.v ? nv : x.v).filter((v, i, a) => a.indexOf(v) === i);
      LS.set('choices', S.choices); close(); render(); toast('已换成 ' + window.EX[nv].n + '，以后默认用它');
    });
  });
}
function library(onPick) {
  const byPart = {};
  Object.values(LIB).forEach(x => { if (S.profile.place === 'home' && !/徒手|哑铃|弹力带|单杠|瑜伽垫/.test(x.ex.eq)) return; (byPart[x.part] = byPart[x.part] || []).push(x); });
  const parts = Object.keys(byPart);
  let cur = parts[0];
  const draw = () => sheet(`<h2>添加动作</h2><div class="pills">${parts.map(p => `<button data-pt="${esc(p)}" aria-pressed="${p === cur}">${esc(p)}</button>`).join('')}</div>
    <div class="libgrid">${byPart[cur].map(x => `<button class="libitem" data-add="${x.v}"><img src="${imgUrl(x.ex, 0)}" alt="" loading="lazy"><span>${esc(x.ex.n)}</span><small>${esc(x.group)} · ${esc(x.ex.eq)}</small></button>`).join('')}</div>`, () => {
    $$('[data-pt]').forEach(b => b.onclick = () => { cur = b.dataset.pt; draw(); });
    $$('[data-add]').forEach(b => b.onclick = () => { close(); onPick(b.dataset.add); });
  });
  draw();
}
function bigImage(ex) {
  sheet(`<h2>${esc(ex.n)}</h2><img class="bigimg" src="${imgUrl(ex, 0)}" alt="起始动作"><img class="bigimg" src="${imgUrl(ex, 1)}" alt="结束动作">
    <p class="xs sub">器械：${esc(ex.eq)}。图片来自 free-exercise-db（公有领域）${ex.approx ? '，图库里没有完全相同的动作，这是相近动作的示意' : ''}。动作细节可以在 B 站搜动作名学习（表21 C4）。</p>`);
}
let animT;
function animate() {
  clearInterval(animT);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let f = 0; animT = setInterval(() => { f = 1 - f; $$('img[data-anim]').forEach(img => img.src = `img/ex/${img.dataset.anim}/${f}.jpg`); }, 1100);
}
window.Train = { view: viewTrain, bind: bindTrain, stop: () => clearInterval(animT) };
})();
