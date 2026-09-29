/* 今天：圆环 + “接下来”堆叠卡组 + 全部安排（分组列表） */
(() => {
const { E, $, $$, esc, today, S, peek, rec, save, saveCustom, dayInfo, TYPE, tasksFor, scoreDay, pctOf, sessionItems, burnOf, intakeOf, targetOf,
  badges, celebrate, toast, sheet, close, askScope, confetti, head, bindHead, render, uid, streaks, setTaskTime } = C;
S.editScope = S.editScope || 'day';
const { I, KIND } = Kit;
S.later = S.later || {};

function kindOf(t) { return t.icon === 'moon' ? 'sleep' : t.icon === 'scale' ? 'scale' : (KIND[t.kind] ? t.kind : 'habit'); }
function subOf(t, r, d) {
  if (t.kind === 'train') { const s = sessionItems(d); return `${s.items.length} 个动作 · 约 ${s.items.reduce((a, x) => a + x.sets, 0)} 组`; }
  if (t.id === 'weigh' && r.weight) return `${r.weight} kg`;
  return t.sub || t.note || '';
}
/* 卡片正文：卡组顶部和详情面板共用 */
function body(t, r, d, future) {
  if (t.kind === 'food' && t.meal) {
    const f = t.meal.foods;
    return `<div class="dc-body"><ul>${f.c.length ? `<li>主食选一：${f.c.slice(0, 3).map(esc).join(' / ')}</li>` : ''}${f.p.length ? `<li>${f.c.length ? '蛋白质选一：' : ''}${f.p.slice(0, 3).map(esc).join(' / ')}</li>` : ''}</ul>${f.notes.slice(0, 2).map(n => `<div class="t-foot">${esc(n)}</div>`).join('')}${(t.meal.notes || []).length ? `<div class="t-foot l2">${[...new Set(t.meal.notes)].map(esc).join('；')}</div>` : ''}</div>
      ${future ? '' : `<div class="ghost-row"><button class="tbtn" data-log="${t.meal.key}">记录吃了什么</button></div>`}`;
  }
  if (t.kind === 'train') return `<div class="ghost-row"><button class="pill tint" data-go="train">${I.train}开始训练</button></div>`;
  if (t.id === 'weigh') return `<div class="set" style="grid-template-columns:1fr auto"><input class="field-in" data-w inputmode="decimal" placeholder="体重 kg" value="${esc(r.weight || '')}" ${future ? 'disabled' : ''}><button class="pill tint" data-wok ${future ? 'disabled' : ''}>记录</button></div><div class="t-foot l2">只比较 1-2 周的平均值（表17 B91）</div>`;
  if (t.kind === 'cardio' && t.act && t.act.kind === '跑步') return `<div class="set" style="grid-template-columns:1fr auto"><input class="field-in" data-km inputmode="decimal" placeholder="实际跑了多少 km（可选）" value="${esc(r.km || '')}" ${future ? 'disabled' : ''}><button class="tbtn" data-kmok ${future ? 'disabled' : ''}>保存</button></div>`;
  if (t.note) return `<div class="dc-body">${esc(t.note)}</div>`;
  return '';
}
function cardHtml(t, r, d, future) {
  const k = KIND[kindOf(t)];
  return `<div class="dc-kind ${k[2]}"><span class="ico">${k[1]}</span><span>${k[0]}</span><span class="l3 num" style="margin-left:auto;color:var(--label3)">${t.time}</span></div>
    <div><div class="dc-title">${esc(t.title)}</div><div class="dc-sub">${esc(subOf(t, r, d))}</div></div>${body(t, r, d, future)}`;
}
function pending(d, tasks, r) {
  const later = S.later[d] || [];
  const open = tasks.filter(t => !t.optional && !(r.done && r.done[t.id]));
  return open.filter(t => !later.includes(t.id)).concat(later.map(id => open.find(t => t.id === id)).filter(Boolean));
}
function viewToday() {
  const d = S.day, { info, tasks } = tasksFor(d), r = peek(d) || { done: {} };
  const req = tasks.filter(t => !t.optional), done = req.filter(t => r.done && r.done[t.id]).length;
  const future = d > today(), isToday = d === today();
  const eat = intakeOf(d), burn = burnOf(d), tgt = targetOf(d);
  const s = info.lift ? sessionItems(d) : null;
  const setsTotal = s ? s.items.reduce((a, x) => a + x.sets, 0) : 0;
  const setsDone = s ? s.items.reduce((a, it) => a + ((r.sets || {})[it.v] || []).slice(0, it.sets).filter(x => x && x.done).length, 0) : 0;
  const cardioDone = tasks.filter(t => t.kind === 'cardio').filter(t => r.done && r.done[t.id]).length, cardioAll = tasks.filter(t => t.kind === 'cardio').length;
  const [tn] = TYPE[info.type];
  let h = head(isToday ? '今天' : d < today() ? '回顾' : '预览', d, tn + (info.h ? ' · ' + info.h.name + (info.h.off ? '' : '补班') : ''));
  const st = streaks(), pct = req.length ? done / req.length : 0;
  const bar = (v, max) => `<span class="bar ${v > max * 1.1 ? 'over' : ''}"><i style="width:${max ? Math.min(100, Math.round(v / max * 100)) : 0}%"></i></span>`;
  h += `<section class="mat card hero"><div class="hero-top"><div class="fig hero-fig">${done}<small>/ ${req.length} 项</small></div><div class="hero-cap">${pct >= .8 ? '今日达标' : '已完成'}<br><span class="l3">连续 ${st.cur} 天</span></div></div>
    <div class="progress ok"><i style="width:${Math.round(pct * 100)}%"></i></div>
    <div class="stats"><div><span class="k">摄入 kcal</span><span class="v">${eat.kcal}</span>${bar(eat.kcal, tgt.kcal)}</div>
    <button data-burn aria-label="查看消耗明细"><span class="k">消耗 kcal ›</span><span class="v">${burn.total}</span></button>
    <div><span class="k">${info.lift ? '训练 组' : '有氧 项'}</span><span class="v">${info.lift ? setsDone : cardioDone}<small>/${info.lift ? setsTotal : cardioAll}</small></span></div></div></section>`;
  // 接下来：堆叠卡组
  const pend = pending(d, tasks, r);
  const items = pend.map(t => ({ key: t.id, cls: 'k-' + kindOf(t), html: cardHtml(t, r, d, future) }));
  h += `<section class="section"><div class="section-h"><h2>接下来</h2><span class="t-foot l2">${pend.length ? `还剩 ${pend.length} 项` : ''}</span></div>
    ${Kit.deck('todayDeck', items, future ? '这一天还没到' : `<div class="t-title3" style="color:var(--ink)">今天的安排都完成了</div><div class="t-foot">明天继续</div>`)}
    ${pend.length && !future ? `<div class="deck-ctrl"><button class="pill glass" data-later>${I.later}稍后</button><button class="pill ink" data-done>${I.check}完成</button></div><div class="deck-hint">也可以把卡片向右滑完成、向左滑放到后面</div>` : ''}</section>`;
  // 全部安排
  const liftLink = S.profile.lift !== false && !future && !S.edit ? (info.lift ? '<button class="link red" data-ov="rest">今天不练</button>' : '<button class="link" data-ov="lift">今天加练</button>') : '';
  h += `<section class="section"><div class="section-h"><h2>全部安排</h2><div style="display:flex;gap:14px">${liftLink}<button class="link" id="editTl">${S.edit ? '完成' : '编辑'}</button></div></div><div class="list mat">`;
  if (S.edit) h += `<div class="row" style="grid-template-columns:1fr"><div class="segmented" style="justify-self:start"><button data-scope="day" aria-pressed="${S.editScope === 'day'}">只改今天</button><button data-scope="tpl" aria-pressed="${S.editScope === 'tpl'}">以后每个${TYPE[info.type][0]}</button></div></div>`;
  tasks.forEach((t, i) => {
    const ck = !!(r.done && r.done[t.id]);
    if (S.edit) {
      const prev = tasks[i - 1], next = tasks[i + 1];
      h += `<div class="row ${S.flash === t.id ? 'flash' : ''}" style="grid-template-columns:48px 1fr auto"><button class="hit" data-del="${esc(t.id)}" aria-label="删除 ${esc(t.title)}" style="margin:0;justify-items:start"><span class="del">−</span></button>
        <span class="row-main"><span class="row-title">${esc(t.title)}</span><input class="time-in" type="time" data-time="${esc(t.id)}" value="${t.time}" aria-label="${esc(t.title)} 的时间"></span>
        <span class="mover"><button data-mv="${esc(t.id)}|-1" aria-label="上移" ${prev ? '' : 'disabled'}>${I.up}</button><button data-mv="${esc(t.id)}|1" aria-label="下移" ${next ? '' : 'disabled'}>${I.down}</button></span></div>`;
      return;
    }
    h += `<div class="row ${ck ? 'done' : ''} ${S.flash === t.id ? 'flash' : ''}"><button class="time" data-tedit="${esc(t.id)}" aria-label="改 ${esc(t.title)} 的时间">${t.time}</button>
      <button class="row-main" data-open="${esc(t.id)}"><span class="row-title">${esc(t.title)}${t.optional ? ' <span class="t-cap l3">可选</span>' : ''}</span><span class="row-sub">${esc(subOf(t, r, d))}</span></button>
      <button class="hit" data-ck="${esc(t.id)}" aria-label="${ck ? '取消完成' : '完成'} ${esc(t.title)}" ${future ? 'disabled' : ''}>${Kit.chk(ck)}</button></div>`;
  });
  if (S.edit) h += `<button class="row add" id="addTl"><span class="plus">+</span><span class="row-title">添加卡片</span></button>`;
  h += `</div></section>`;
  h += `<section class="list mat">${Kit.row({ icon: I.heart, title: '身体数据', sub: [r.waist && `腰围 ${r.waist}`, r.sleep && `睡眠 ${r.sleep}h`, r.hunger && `饥饿 ${r.hunger}/5`].filter(Boolean).join(' · ') || '腰围、睡眠、饥饿感、备注', chev: true, attrs: 'data-body' })}</section>`;
  return h;
}
function toggleDone(d, id, on) {
  const r = rec(d), before = badges().filter(b => b.got).length, was = pctOf(r);
  if (on) r.done[id] = true; else delete r.done[id];
  if (S.later[d]) S.later[d] = S.later[d].filter(x => x !== id);
  scoreDay(d); Kit.haptic(on ? 'success' : 'light');
  if (pctOf(r) >= 1 && was < 1) { toast('今天全部完成'); confetti(); } else if (on) toast('+10 能量');
  celebrate(before);
}
function bindInputs(root, d) {
  const q = s => root.querySelector(s);
  const wok = q('[data-wok]'); if (wok) wok.onclick = () => { const v = q('[data-w]').value.trim(); if (!(+v > 20)) { toast('请输入体重'); return; } rec(d).weight = v; if (!rec(d).done.weigh) toggleDone(d, 'weigh', true); else save(d); close(); render(); };
  const kok = q('[data-kmok]'); if (kok) kok.onclick = () => { rec(d).km = q('[data-km]').value.trim(); save(d); toast('已保存，消耗按实际距离计算'); };
  root.querySelectorAll('[data-log]').forEach(b => b.onclick = () => { close(); window.Food.addSheet(b.dataset.log); });
  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { close(); S.tab = b.dataset.go; render(); scrollTo(0, 0); });
}
function bindToday() {
  bindHead();
  const d = S.day, { tasks } = tasksFor(d), r = peek(d) || { done: {} };
  const deckEl = $('#todayDeck');
  const right = key => { toggleDone(d, key, true); render(); };
  const left = key => { const l = S.later[d] = (S.later[d] || []).filter(x => x !== key); l.push(key); Kit.haptic('light'); render(); };
  if (deckEl && d <= today()) { Kit.bindDeck('todayDeck', right, left); bindInputs(deckEl.querySelector('.dc.top'), d); }
  const dn = $('[data-done]'); if (dn) dn.onclick = () => deckEl.flyRight();
  const lt = $('[data-later]'); if (lt) lt.onclick = () => deckEl.flyLeft();
  $('#editTl').onclick = () => { S.edit = !S.edit; render(); };
  $$('[data-ov]').forEach(b => b.onclick = () => { rec(d).override = b.dataset.ov; scoreDay(d); render(); });
  $$('[data-ck]').forEach(b => b.onclick = () => { const on = !(r.done && r.done[b.dataset.ck]); toggleDone(d, b.dataset.ck, on); const y = scrollY; render(); scrollTo(0, y); });
  $$('[data-open]').forEach(b => b.onclick = () => { const t = tasks.find(x => x.id === b.dataset.open); if (!t) return; sheet(`<div class="${'k-' + kindOf(t)}" style="display:grid;gap:14px">${cardHtml(t, peek(d) || { done: {} }, d, d > today())}</div>`, m => bindInputs(m, d)); });
  $$('[data-del]').forEach(b => b.onclick = () => delCard(d, b.dataset.del));
  $$('[data-scope]').forEach(b => b.onclick = () => { S.editScope = b.dataset.scope; Kit.haptic('light'); render(); });
  $$('[data-time]').forEach(i => i.onchange = () => changeTime(d, i.dataset.time, i.value));
  $$('[data-tedit]').forEach(b => b.onclick = () => { const t = tasks.find(x => x.id === b.dataset.tedit); if (t) timeSheet(d, t); });
  // 长按一行：直接改时间
  $$('[data-tedit]').forEach(b => { const row = b.closest('.row'), t = tasks.find(x => x.id === b.dataset.tedit); if (row && t) Kit.longPress(row, () => timeSheet(d, t)); });
  if (S.flash) { const el = $('.row.flash'); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); setTimeout(() => { S.flash = null; }, 0); }
  $$('[data-mv]').forEach(b => b.onclick = () => { const [id, dir] = b.dataset.mv.split('|'); moveTask(d, id, +dir); });
  const add = $('#addTl'); if (add) add.onclick = () => addCard(d);
  const bd = $('[data-body]'); if (bd) bd.onclick = () => bodySheet(d);
  $$('[data-burn]').forEach(b => b.onclick = () => burnSheet(d));
}
function bodySheet(d) {
  const r = peek(d) || {}, dis = d > today() ? 'disabled' : '';
  sheet(`<h2>身体数据</h2><div class="list" style="background:var(--fill3)">
    <div class="frow"><label for="b-waist">腰围</label><input id="b-waist" data-b="waist" inputmode="decimal" placeholder="cm" value="${esc(r.waist || '')}" ${dis}></div>
    <div class="frow"><label for="b-sleep">睡眠</label><input id="b-sleep" data-b="sleep" inputmode="decimal" placeholder="小时" value="${esc(r.sleep || '')}" ${dis}></div>
    <div class="frow stack"><span class="lbl">饥饿感（1 不饿，5 很饿）</span><div class="chips">${[1, 2, 3, 4, 5].map(i => `<button data-hg="${i}" aria-pressed="${+r.hunger === i}" ${dis}>${i}</button>`).join('')}</div></div>
    <div class="frow stack"><textarea class="field-in" data-b="note" style="height:80px;padding:10px 12px;font-family:var(--font)" placeholder="备注" ${dis}>${esc(r.note || '')}</textarea></div></div>
    <p class="t-foot l2" style="padding:0 6px">常饿：选饱腹感高的主食、多吃蔬菜、瘦肉吃够（表17 第16问）。体脂秤数据不可信，看体重、腰围和外观（表17 B88）。</p>`, m => {
    m.querySelectorAll('[data-b]').forEach(i => i.oninput = () => { rec(d)[i.dataset.b] = i.value.trim(); save(d); });
    m.querySelectorAll('[data-hg]').forEach(b => b.onclick = () => { rec(d).hunger = +b.dataset.hg; save(d); m.querySelectorAll('[data-hg]').forEach(x => x.setAttribute('aria-pressed', x === b)); Kit.haptic('light'); });
    m.onclick = e => { if (e.target === m) { close(); render(); } };
  });
}
function burnSheet(d) {
  const b = burnOf(d), future = d > today(), kinds = window.CARDIO.filter(c => !c.run && !c.perSteps);
  sheet(`<h2>今天的消耗</h2><div class="sheet-sub">合计 ${b.total} kcal</div><div class="list" style="background:var(--fill3)">${b.items.map(x => `<div class="row" style="grid-template-columns:1fr auto auto"><span class="row-main"><span class="row-title">${esc(x.name)}</span><span class="row-sub">${esc(x.src)}</span></span><span class="row-val num">${x.kcal}</span>${x.id ? `<button class="link red" data-rmb="${x.id}">删除</button>` : '<span></span>'}</div>`).join('')}</div>
    <p class="t-foot l2" style="padding:0 6px">基础消耗已包含日常活动；力训、有氧打勾完成后才计入。</p>
    ${future ? '' : `<div class="list" style="background:var(--fill3)"><div class="frow"><label for="bk-k">额外活动</label><select id="bk-k">${kinds.map((k, i) => `<option value="${i}">${esc(k.label)}</option>`).join('')}<option value="own">自己填 kcal</option></select></div>
      <div class="frow"><label for="bk-v" id="bk-l">分钟</label><input id="bk-v" inputmode="decimal" placeholder="30"></div></div><button class="pill tint wide" id="bk-ok">添加（按表16 计算）</button>`}`, m => {
    m.querySelectorAll('[data-rmb]').forEach(x => x.onclick = () => { const r = rec(d); r.burns = (r.burns || []).filter(y => y.id !== x.dataset.rmb); save(d); burnSheet(d); render(); });
    const k = m.querySelector('#bk-k'); if (!k) return;
    k.onchange = () => m.querySelector('#bk-l').textContent = k.value === 'own' ? 'kcal' : '分钟';
    m.querySelector('#bk-ok').onclick = () => {
      const v = +m.querySelector('#bk-v').value; if (!(v > 0)) { toast('请填数字'); return; }
      let name, kcal;
      if (k.value === 'own') { name = '额外活动'; kcal = Math.round(v); } else { const c = kinds[+k.value]; name = `${c.label} ${v} 分钟`; kcal = Math.round(E.cardioPerHour({ kind: c.label }, S.profile.weight).kcal * v / 60); }
      const r = rec(d); r.burns = r.burns || []; r.burns.push({ id: uid(), name, kcal }); save(d); Kit.haptic('success'); burnSheet(d); render(); toast(`已添加 ${kcal} kcal`);
    };
  });
}
function delCard(d, id) {
  const { info, tasks } = tasksFor(d), t = tasks.find(x => x.id === id), scope = S.editScope;
  if (scope === 'tpl') { const m = S.custom.timeline[info.type] || (S.custom.timeline[info.type] = { hide: [], add: [] }); if (t && t.custom && t.tpl) m.add = m.add.filter(a => a.id !== id); else m.hide.push(id); saveCustom(); }
  else { const r = rec(d); r.tl = r.tl || { hide: [], add: [] }; if (t && t.custom && !t.tpl) r.tl.add = r.tl.add.filter(a => a.id !== id); else r.tl.hide.push(id); }
  scoreDay(d); Kit.haptic('light'); render(); toast(scope === 'tpl' ? '已删除，以后也不再出现' : '已从今天删除');
}
/* 改时间：任意时间都可以，改完按时间自动排到对应位置，并闪一下提示新位置 */
function changeTime(d, id, val, scope) {
  if (!/^\d{1,2}:\d\d$/.test(val || '')) return;
  val = val.padStart(5, '0');
  const before = tasksFor(d).tasks.findIndex(x => x.id === id);
  setTaskTime(d, id, val, scope || S.editScope); scoreDay(d); Kit.haptic('light');
  const after = tasksFor(d).tasks.findIndex(x => x.id === id);
  S.flash = id; render();
  if (after !== before) toast(`已按时间排到第 ${after + 1} 项`);
  if (window.Me && Me.scheduleNotifs) Me.scheduleNotifs();
}
/* 点时间：弹出改时间面板（不用进编辑模式） */
function timeSheet(d, t) {
  const info = dayInfo(d);
  sheet(`<h2>${esc(t.title)}</h2><div class="sheet-sub">改好后会按时间自动排到对应位置</div>
    <div class="list" style="background:var(--fill3)"><div class="frow"><label for="te-t">时间</label><input type="time" id="te-t" value="${t.time}"></div></div>
    <button class="pill glass wide" data-te="day">只改这一天</button><button class="pill ink wide" data-te="tpl">以后每个${TYPE[info.type][0]}都这样</button>
    ${t.baseTime ? `<button class="link" id="te-reset" style="justify-self:center">恢复默认时间 ${t.baseTime}</button>` : ''}`, m => {
    m.querySelectorAll('[data-te]').forEach(b => b.onclick = () => { const v = m.querySelector('#te-t').value; close(); changeTime(d, t.id, v, b.dataset.te); });
    const rs = m.querySelector('#te-reset'); if (rs) rs.onclick = () => { setTaskTime(d, t.id, null, 'day'); setTaskTime(d, t.id, null, 'tpl'); close(); scoreDay(d); S.flash = t.id; render(); toast('已恢复默认时间'); };
  });
}
/* 上移 / 下移：和相邻一项交换时间 */
function moveTask(d, id, dir) {
  const { tasks, key } = tasksFor(d), i = tasks.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= tasks.length) return;
  const a = tasks[i], b = tasks[j];
  let ta = b.time, tb = a.time;
  if (ta === tb) { const m = E.tm(ta) + (dir < 0 ? -1 : 1); ta = E.mt(m); }
  setTaskTime(d, a.id, ta, S.editScope); setTaskTime(d, b.id, tb, S.editScope);
  Kit.haptic('light'); render();
}
function addCard(d) {
  const { info } = tasksFor(d);
  sheet(`<h2>添加卡片</h2><div class="list" style="background:var(--fill3)">
    <div class="frow"><label for="ac-t">标题</label><input id="ac-t" placeholder="例如：喝水 500ml"></div>
    <div class="frow"><label for="ac-time">时间</label><input type="time" id="ac-time" value="${E.mt(new Date().getHours() * 60 + 60)}"></div>
    <div class="frow"><label for="ac-n">说明</label><input id="ac-n" placeholder="可选"></div>
    <div class="frow stack"><div class="chips" id="ac-k">${[['habit', '习惯'], ['food', '饮食'], ['cardio', '运动'], ['train', '训练']].map(([k, n], i) => `<button data-k="${k}" aria-pressed="${i === 0}">${n}</button>`).join('')}</div></div>
    <div class="frow"><span class="lbl">可选（不计入完成率）</span><input type="checkbox" class="switch" id="ac-o"></div></div>
    <button class="pill glass wide" data-sc="day">只加今天</button><button class="pill tint wide" data-sc="tpl">以后每个${TYPE[info.type][0]}都加</button>`, m => {
    m.querySelectorAll('#ac-k button').forEach(b => b.onclick = () => m.querySelectorAll('#ac-k button').forEach(x => x.setAttribute('aria-pressed', x === b)));
    m.querySelectorAll('[data-sc]').forEach(b => b.onclick = () => {
      const title = m.querySelector('#ac-t').value.trim(); if (!title) { toast('请填标题'); return; }
      const kind = (m.querySelector('#ac-k [aria-pressed="true"]') || {}).dataset.k || 'habit', note = m.querySelector('#ac-n').value.trim();
      const c = { id: 'c-' + uid(), time: m.querySelector('#ac-time').value || '12:00', title, note, sub: note, kind, optional: m.querySelector('#ac-o').checked };
      if (b.dataset.sc === 'tpl') { const x = S.custom.timeline[info.type] || (S.custom.timeline[info.type] = { hide: [], add: [] }); x.add.push(c); saveCustom(); }
      else { const r = rec(d); r.tl = r.tl || { hide: [], add: [] }; r.tl.add.push(c); }
      close(); scoreDay(d); render(); toast('已添加');
    });
  });
}
window.Today = { view: viewToday, bind: bindToday, updateNow() {}, toggleDone };
})();
