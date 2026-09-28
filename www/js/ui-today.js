/* 今天：摘要 + 时间线卡片 */
(() => {
const { E, $, $$, esc, today, S, peek, rec, save, saveCustom, ICON, dayInfo, TYPE, tasksFor, scoreDay, pctOf, sessionItems, burnOf, intakeOf, targetOf,
  streaks, badges, celebrate, toast, sheet, close, askScope, confetti, head, bindHead, render, uid } = C;

function viewToday() {
  const d = S.day, { info, tasks } = tasksFor(d), r = peek(d) || { done: {} };
  const req = tasks.filter(t => !t.optional), done = req.filter(t => r.done && r.done[t.id]).length;
  const pct = req.length ? done / req.length : 0, isToday = d === today(), future = d > today();
  const eat = intakeOf(d), burn = burnOf(d), tgt = targetOf(d), st = streaks();
  const [tn, tc] = TYPE[info.type];
  const tag = `<span class="tag ${tc}">${tn}${info.h ? ' · ' + esc(info.h.name) + (info.h.off ? '' : '补班') : ''}</span>`;
  let h = head(isToday ? '今天' : (d < today() ? '回顾' : '预览'), d, tag);
  h += `<div class="card hero"><div class="hero-top"><span class="sm"><b class="num">${done}</b><span class="sub"> / ${req.length} 项完成</span>${pct >= .8 ? ' <span class="tag done">达标</span>' : ''}</span><span class="xs sub">连续 <b class="num">${st.cur}</b> 天</span></div>
    <div class="progress"><i style="width:${Math.round(pct * 100)}%"></i></div>
    <div class="stats3"><div class="stat"><span class="k">摄入</span><span class="v">${eat.kcal}<small>/${tgt.kcal}</small></span></div>
    <button class="stat" data-burn style="text-align:left"><span class="k">消耗 ›</span><span class="v">${burn.total}</span></button>
    <div class="stat"><span class="k">缺口</span><span class="v">${eat.kcal ? burn.total - eat.kcal : '—'}</span></div></div>
    ${isToday ? '<div id="nowBox"></div>' : ''}</div>`;
  const liftLink = S.profile.lift !== false && !future ? (info.lift ? '<button class="textbtn warn" data-ov="rest">今天不练</button>' : '<button class="textbtn" data-ov="lift">今天加练</button>') : '';
  h += `<div class="section-title"><h2>时间线</h2><div class="row">${S.edit ? '' : liftLink}<button class="textbtn" id="editTl">${S.edit ? '完成' : '编辑'}</button></div></div><div class="list">`;
  tasks.forEach(t => h += card(t, r, future, d));
  if (S.edit) h += '<button class="add-card" id="addTl">＋ 添加卡片</button>';
  h += '</div>';
  h += bodyCard(r, future);
  return h;
}
function card(t, r, future, d) {
  const ck = !!(r.done && r.done[t.id]), open = S.open[t.id];
  const kind = t.kind === 'food' ? 'food' : t.kind === 'train' ? 'train' : t.kind === 'cardio' ? 'cardio' : 'habit';
  const icon = ICON[t.icon] || ICON[kind];
  let sub = t.sub || t.note || '';
  if (t.kind === 'train') { const s = sessionItems(d); sub = `${s.items.length} 个动作 · 约 ${s.items.reduce((a, x) => a + x.sets, 0)} 组`; }
  if (t.id === 'weigh' && r.weight) sub = `${r.weight} kg`;
  let detail = '';
  if (open && !S.edit) {
    if (t.kind === 'food' && t.meal) {
      const f = t.meal.foods;
      detail = `<ul>${f.c.length ? `<li>主食选一：${f.c.map(esc).join(' / ')}</li>` : ''}${f.p.length ? `<li>${f.c.length ? '蛋白质选一：' : ''}${f.p.map(esc).join(' / ')}</li>` : ''}</ul>${f.notes.map(n => `<div>${esc(n)}</div>`).join('')}
        ${future ? '' : `<div class="row"><button class="btn food sm" data-log="${t.meal.key}">记录这餐吃了什么</button></div>`}`;
    } else if (t.kind === 'train') detail = `<div class="row"><button class="btn primary sm" data-go="train">打开训练</button></div>`;
    else if (t.id === 'weigh') detail = `<div class="row" style="flex-wrap:nowrap"><input class="in num" id="wIn" inputmode="decimal" placeholder="体重 kg" value="${esc(r.weight || '')}" ${future ? 'disabled' : ''}><button class="btn sm" id="wOk" ${future ? 'disabled' : ''}>保存</button></div><div class="xs">只比较 1-2 周的平均值，两三天的起伏主要是水分（表17 B91）</div>`;
    else if (t.kind === 'cardio') detail = `<div>${esc(S.plan.goal === 'cut' ? '心率约 120 最有利于脂肪氧化；不要刚吃完饭就做（表5 E102-E103）' : '一般建议增肌不做有氧，爱好性的可以保留（表13 E25）')}</div>${t.act && t.act.kind === '跑步' ? `<div class="row" style="flex-wrap:nowrap"><input class="in num" id="kmIn" inputmode="decimal" placeholder="实际跑了多少 km" value="${esc(r.km || '')}" ${future ? 'disabled' : ''}><button class="btn sm" id="kmOk" ${future ? 'disabled' : ''}>保存</button></div>` : ''}`;
    else if (t.note) detail = `<div>${esc(t.note)}</div>`;
  }
  const clickable = !S.edit;
  return `<div class="tl k-${kind} ${ck ? 'is-done' : ''} ${open ? 'open' : ''}" data-tid="${esc(t.id)}">
    ${S.edit ? `<button class="del" data-del="${esc(t.id)}" aria-label="删除 ${esc(t.title)}">−</button>` : ''}
    <div class="ico">${icon}</div>
    <button class="main" ${clickable ? `data-open="${esc(t.id)}"` : ''} aria-expanded="${!!open}"><span class="t1"><span class="time">${t.time}</span><span class="title">${esc(t.title)}</span>${t.optional ? '<span class="opt">可选</span>' : ''}</span><span class="t2">${esc(sub)}</span></button>
    <button class="chk" data-ck="${esc(t.id)}" aria-pressed="${ck}" aria-label="完成 ${esc(t.title)}" ${future || S.edit ? 'disabled' : ''}>${ICON.check}</button>
    ${detail ? `<div class="detail">${detail}</div>` : ''}</div>`;
}
function bodyCard(r, future) {
  const open = S.open.__body;
  let h = `<div class="card tight"><button class="row between" data-open="__body" style="width:100%"><h2 style="font-size:16px">身体数据</h2><span class="xs sub">${[r.waist && `腰围 ${r.waist}`, r.sleep && `睡眠 ${r.sleep}h`, r.hunger && `饥饿 ${r.hunger}`].filter(Boolean).join(' · ') || '腰围、睡眠、饥饿感'} ${open ? '▴' : '▾'}</span></button>`;
  if (open) {
    h += `<div class="fgrid"><div class="field"><label for="b-waist">腰围 cm</label><input class="in num" id="b-waist" data-b="waist" inputmode="decimal" value="${esc(r.waist || '')}" ${future ? 'disabled' : ''}></div>
      <div class="field"><label for="b-sleep">睡眠 小时</label><input class="in num" id="b-sleep" data-b="sleep" inputmode="decimal" value="${esc(r.sleep || '')}" ${future ? 'disabled' : ''}></div></div>
      <div class="field"><label>饥饿感（1 不饿，5 很饿）</label><div class="pills">${[1, 2, 3, 4, 5].map(i => `<button data-hg="${i}" aria-pressed="${+r.hunger === i}" ${future ? 'disabled' : ''}>${i}</button>`).join('')}</div></div>
      <div class="field"><label for="b-note">备注</label><textarea class="in" id="b-note" data-b="note" ${future ? 'disabled' : ''}>${esc(r.note || '')}</textarea></div>
      <p class="xs sub">常饿：选饱腹感高的主食、多吃蔬菜、瘦肉吃够（表17 第16问）。体脂秤数据不可信，看体重、腰围和外观（表17 B88）。</p>`;
  }
  return h + '</div>';
}
function toggleDone(d, id, on) {
  const r = rec(d), before = badges().filter(b => b.got).length, was = pctOf(r);
  if (on) r.done[id] = true; else delete r.done[id];
  scoreDay(d);
  if (on) toast('+10 能量');
  if (pctOf(r) >= 1 && was < 1) { toast('今天全部完成，+20 能量'); confetti(); }
  celebrate(before);
}
function bindToday() {
  bindHead();
  const d = S.day;
  $('#editTl').onclick = () => { S.edit = !S.edit; render(); };
  $$('[data-ov]').forEach(b => b.onclick = () => { rec(d).override = b.dataset.ov; scoreDay(d); render(); });
  $$('[data-open]').forEach(b => b.onclick = () => { const k = b.dataset.open; S.open[k] = !S.open[k]; const y = scrollY; render(); scrollTo(0, y); });
  $$('[data-ck]').forEach(b => b.onclick = () => { const on = b.getAttribute('aria-pressed') !== 'true'; toggleDone(d, b.dataset.ck, on); const y = scrollY; render(); scrollTo(0, y); });
  $$('[data-go]').forEach(b => b.onclick = () => { S.tab = b.dataset.go; render(); scrollTo(0, 0); });
  $$('[data-log]').forEach(b => b.onclick = () => window.Food.addSheet(b.dataset.log));
  const wOk = $('#wOk'); if (wOk) wOk.onclick = () => { const v = $('#wIn').value.trim(); if (!(+v > 20)) { toast('请输入体重'); return; } rec(d).weight = v; if (!rec(d).done.weigh) toggleDone(d, 'weigh', true); else save(d); S.open.weigh = false; render(); };
  const kmOk = $('#kmOk'); if (kmOk) kmOk.onclick = () => { rec(d).km = $('#kmIn').value.trim(); save(d); toast('已保存，消耗按实际距离计算'); render(); };
  $$('[data-b]').forEach(i => i.oninput = () => { rec(d)[i.dataset.b] = i.value.trim(); save(d); });
  $$('[data-hg]').forEach(b => b.onclick = () => { rec(d).hunger = +b.dataset.hg; save(d); $$('[data-hg]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $$('[data-del]').forEach(b => b.onclick = () => delCard(d, b.dataset.del));
  const add = $('#addTl'); if (add) add.onclick = () => addCard(d);
  $$('[data-burn]').forEach(b => b.onclick = () => burnSheet(d));
  updateNow();
}
function burnSheet(d) {
  const b = burnOf(d), future = d > today();
  const kinds = window.CARDIO.filter(c => !c.run && !c.perSteps);
  sheet(`<h2>今天的消耗</h2><div class="card" style="gap:0;padding:4px 14px;box-shadow:none;background:var(--fill)">${b.items.map(x => `<div class="food-item"><span class="stack" style="gap:0"><span class="fn sm">${esc(x.name)}</span><span class="fm">${esc(x.src)}</span></span><span class="row" style="gap:6px"><span class="fk">${x.kcal}</span>${x.id ? `<button class="textbtn warn" data-rmb="${x.id}">删</button>` : ''}</span></div>`).join('')}
    <div class="food-item"><b>合计</b><span class="fk">${b.total}</span></div></div>
    <p class="xs sub">基础消耗包含日常活动；力训和有氧在打勾完成后才计入。跑步可以在时间线的跑步卡片里填实际公里数。</p>
    ${future ? '' : `<h2 style="font-size:16px">添加额外活动</h2><div class="fgrid"><div class="field"><label for="bk-k">活动（按表16）</label><select class="in" id="bk-k">${kinds.map((k, i) => `<option value="${i}">${esc(k.label)}</option>`).join('')}<option value="own">自己填 kcal</option></select></div>
      <div class="field"><label for="bk-v" id="bk-l">分钟</label><input class="in num" id="bk-v" inputmode="decimal" placeholder="30"></div></div><button class="btn primary block" id="bk-ok">添加</button>`}`, () => {
    $$('[data-rmb]').forEach(x => x.onclick = () => { const r = rec(d); r.burns = (r.burns || []).filter(y => y.id !== x.dataset.rmb); save(d); burnSheet(d); render(); });
    const k = $('#bk-k'); if (!k) return;
    k.onchange = () => $('#bk-l').textContent = k.value === 'own' ? 'kcal' : '分钟';
    $('#bk-ok').onclick = () => {
      const v = +$('#bk-v').value; if (!(v > 0)) { toast('请填数字'); return; }
      let name, kcal;
      if (k.value === 'own') { name = '额外活动'; kcal = Math.round(v); }
      else { const c = kinds[+k.value]; name = `${c.label} ${v} 分钟`; kcal = Math.round(E.cardioPerHour({ kind: c.label }, S.profile.weight).kcal * v / 60); }
      const r = rec(d); r.burns = r.burns || []; r.burns.push({ id: uid(), name, kcal }); save(d); burnSheet(d); render(); toast(`已添加 ${kcal} kcal`);
    };
  });
}
function delCard(d, id) {
  const { info, tasks } = tasksFor(d), t = tasks.find(x => x.id === id);
  askScope(`删除「${t ? t.title : ''}」`, scope => {
    if (scope === 'tpl') {
      const m = S.custom.timeline[info.type] || (S.custom.timeline[info.type] = { hide: [], add: [] });
      if (t && t.custom && t.tpl) m.add = m.add.filter(a => a.id !== id); else m.hide.push(id);
      saveCustom();
    } else {
      const r = rec(d); r.tl = r.tl || { hide: [], add: [] };
      if (t && t.custom && !t.tpl) r.tl.add = r.tl.add.filter(a => a.id !== id); else r.tl.hide.push(id);
    }
    scoreDay(d); render(); toast('已删除');
  });
}
function addCard(d) {
  const { info } = tasksFor(d);
  sheet(`<h2>添加卡片</h2>
    <div class="field"><label for="ac-t">标题</label><input class="in" id="ac-t" placeholder="例如：喝水 500ml、拉伸 10 分钟"></div>
    <div class="fgrid"><div class="field"><label for="ac-time">时间</label><input class="in" type="time" id="ac-time" value="${E.mt(new Date().getHours() * 60 + 60)}"></div>
    <div class="field"><label>类型</label><div class="pills" id="ac-k">${[['habit', '习惯'], ['food', '饮食'], ['cardio', '运动'], ['train', '训练']].map(([k, n], i) => `<button data-k="${k}" aria-pressed="${i === 0}">${n}</button>`).join('')}</div></div></div>
    <div class="field"><label for="ac-n">说明（可选）</label><input class="in" id="ac-n"></div>
    <label class="switch">可选（不计入完成率）<input type="checkbox" id="ac-o"></label>
    <div class="stack"><button class="btn ghost block" data-sc="day">只加今天</button><button class="btn primary block" data-sc="tpl">以后每个${C.TYPE[info.type][0]}都加</button></div>`, () => {
    $$('#ac-k button').forEach(b => b.onclick = () => $$('#ac-k button').forEach(x => x.setAttribute('aria-pressed', x === b)));
    $$('[data-sc]').forEach(b => b.onclick = () => {
      const title = $('#ac-t').value.trim(); if (!title) { toast('请填标题'); return; }
      const kind = ($('#ac-k [aria-pressed="true"]') || {}).dataset.k || 'habit';
      const c = { id: 'c-' + uid(), time: $('#ac-time').value || '12:00', title, note: $('#ac-n').value.trim(), sub: $('#ac-n').value.trim(), kind, optional: $('#ac-o').checked };
      if (b.dataset.sc === 'tpl') { const m = S.custom.timeline[info.type] || (S.custom.timeline[info.type] = { hide: [], add: [] }); m.add.push(c); saveCustom(); }
      else { const r = rec(d); r.tl = r.tl || { hide: [], add: [] }; r.tl.add.push(c); }
      close(); scoreDay(d); render(); toast('已添加');
    });
  });
}
function updateNow() {
  const box = $('#nowBox'); if (!box || S.day !== today()) return;
  const { tasks, key } = tasksFor(S.day), r = peek(S.day) || { done: {} };
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), wake = E.tm(S.profile.wake);
  const cur = nm < wake - 60 ? nm + 1440 : nm;
  const open = tasks.filter(t => !t.optional && !(r.done && r.done[t.id]));
  $$('.tl.is-next').forEach(e => e.classList.remove('is-next'));
  if (!open.length) { box.innerHTML = '<div class="nowline ok"><span class="dot"></span><b>今天的任务都完成了</b></div>'; return; }
  const late = open.filter(t => key(t.time) <= cur);
  const t = late.length ? late[late.length - 1] : open[0];
  const diff = key(t.time) - cur;
  const el = document.querySelector(`.tl[data-tid="${CSS.escape(t.id)}"]`); if (el) el.classList.add('is-next');
  box.innerHTML = late.length
    ? `<div class="nowline late"><span class="dot"></span><span>该做了：<b>${esc(t.title)}</b>${late.length > 1 ? `（还有 ${late.length - 1} 项没打勾）` : ''}</span></div>`
    : `<div class="nowline"><span class="dot" style="color:var(--train)"></span><span>${diff >= 60 ? Math.floor(diff / 60) + ' 小时 ' : ''}${diff % 60} 分钟后：<b>${esc(t.title)}</b></span></div>`;
}
window.Today = { view: viewToday, bind: bindToday, updateNow, toggleDone };
})();
