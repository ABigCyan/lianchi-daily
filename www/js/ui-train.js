/* 训练：动作卡组 + 全部动作列表 */
(() => {
const { E, $, $$, esc, src, today, S, LS, peek, rec, save, saveCustom, dayInfo, scoreDay, training, sessionInfo, sessionItems, LIB,
  badges, celebrate, toast, sheet, close, askScope, confetti, imgUrl, head, bindHead, render, allDays, suggestFor } = C;
S.trainScope = S.trainScope || 'tpl';
const { I } = Kit;
S.exLater = S.exLater || {};

function lastLift(v, before) {
  const days = allDays(E.addDays(before, -1)).reverse();
  for (const d of days) { const r = peek(d); const s = r && r.sets && r.sets[v]; if (s && s.some(x => x && x.w)) return s.filter(x => x && x.w).map(x => `${x.w}×${x.r || '?'}`).join('  '); }
  return '';
}
/* 表25：自由卧推 / 深蹲按做到力竭的一组预测最大力量（男 Lombardi，女 Brzycki，表25 G 列） */
const FREE_1RM = ['bench_bb', 'squat'];
function rmLine(it, r, d) {
  if (!FREE_1RM.includes(it.v)) return '';
  const pick = sets => (sets || []).filter(x => x && +x.w > 0 && +x.r > 0 && +x.r <= 15);
  let sets = pick((r.sets || {})[it.v]), when = '今天';
  if (!sets.length) { for (const x of allDays(E.addDays(d, -1)).reverse()) { const s = pick(((peek(x) || {}).sets || {})[it.v]); if (s.length) { sets = s; when = '上次'; break; } } }
  if (!sets.length) return '<div class="t-foot l3">记录重量和次数后，会按表25 预测最大力量</div>';
  const F = S.profile.sex === 'F', best = Math.max(...sets.map(x => E.oneRM(+x.w, +x.r, S.profile.sex)));
  return `<div class="t-foot l2">按${when}的组预测最大力量 ≈ <b class="num">${Math.round(best)} kg</b>（表25 ${F ? 'Brzycki' : 'Lombardi'} 公式按力竭次数算；按表21 C13 提前 1-2 次停的话，实际会比这个高一点）</div>`;
}
/* 表26/27 拉伸图谱：按今天练到的肌群列出 */
function stretchSection(items) {
  const gids = new Set(items.map(it => it.group.id)), all = window.STRETCH || [];
  const list = all.map((x, i) => ({ x, i })).filter(({ x }) => x.groups.some(g => gids.has(g)));
  if (!all.length) return '';
  return `<section class="section"><div class="section-h"><h2>拉伸</h2><button class="link" id="allStretch">全部 ${all.length} 个</button></div>
    ${list.length ? `<div class="stretch-row">${list.map(({ x, i }) => `<button class="stretch mat" data-str="${i}"><img src="${x.img}" alt="${esc(x.m)}拉伸" loading="lazy"><span>${esc(x.m)}</span></button>`).join('')}</div>` : ''}
    <p class="list-footer">按今天练到的肌群列出表26、表27 的拉伸图。原表只给图谱（目录：看图就懂），没有规定拉伸的时间和次数。</p></section>`;
}
function stretchSheet(i) {
  const x = window.STRETCH[i];
  sheet(`<h2>${esc(x.m)}</h2><img class="bigimg" src="${x.img}" alt="${esc(x.m)}拉伸"><p class="t-foot l3" style="text-align:center">${esc(x.src)}</p>`);
}
function allStretchSheet() {
  sheet(`<h2>拉伸图谱</h2><div class="sheet-sub">表26 上身、表27 下身</div><div class="libgrid">${window.STRETCH.map((x, i) => `<button class="libitem" data-str="${i}"><img src="${x.img}" alt="" loading="lazy"><span>${esc(x.m)}</span><small>${esc(x.src)}</small></button>`).join('')}</div>`,
    m => m.querySelectorAll('[data-str]').forEach(b => b.onclick = () => stretchSheet(+b.dataset.str)));
}
const nAlts = it => it.alts.length + (it.extAlts || []).length;
const doneSets = (r, it) => ((r.sets || {})[it.v] || []).slice(0, it.sets).filter(x => x && x.done).length;
function exBody(it, idx, n, r, d, future) {
  const ex = it.ex, sets = ((r.sets || {})[it.v]) || [], sg = future ? null : suggestFor(it, d);
  const lo = (String(it.reps).match(/^(\d+)/) || [])[1] || '';
  const why = [['次数', it.repsSrc], ['休息', it.restSrc], ['力竭', it.failSrc]].filter(x => x[1]).map(([k, v]) => `${k}：${v}`).join(' · ');
  return `<div class="ex-hero"><img data-anim="${esc(ex.img)}" src="${imgUrl(ex, 0)}" alt="${esc(ex.n)}"><span class="badge">${idx + 1} / ${n} · ${esc(it.group.name)}</span></div>
    <div><div class="dc-title" style="font-size:24px">${esc(ex.n)}</div><div class="dc-sub">${it.sets} 组 × ${esc(it.reps)}${ex.timed ? '' : ' 次'} · 组间休息 ${esc(it.rest)}</div></div>
    <div class="ex-tags"><span class="xt ${/不追求/.test(it.fail) ? 'warn' : ''}">${/不追求/.test(it.fail) ? '不做到力竭，留 1-2 次' : '可以做到力竭'}</span><span class="xt">${ex.multi ? '多关节' : '单关节'}</span><span class="xt">${esc(ex.eq)}</span>${it.custom ? '<span class="xt mine">你改过</span>' : ''}${it.fresh ? '<span class="xt">新动作</span>' : ''}</div>
    ${sg ? `<div class="ex-sug">${Kit.I.sparkles}<span>建议 <b class="num">${sg.side != null ? `每边 ${sg.side} kg（总 ${sg.w}）× ` : sg.w ? sg.w + ' kg × ' : ''}${sg.r} 次</b> · ${esc(sg.why)}<br><span class="l3">上次（${esc(sg.last.d.slice(5).replace('-', '/'))}）${esc(sg.lastText)}</span></span></div>` : ''}
    ${ex.ext ? `<div class="t-foot l2">${src('补充 · ' + ex.kindName, 1)} ${esc(ex.basis)}</div>` : ''}${it.note ? `<div class="t-foot l2">${esc(it.note)}</div>` : ''}${rmLine(it, r, d)}
    ${setsHtml(it, sets, sg, lo, future)}
    ${sg ? '<div class="t-foot l3">灰色数字是按上次算的建议，直接打勾就按建议记下</div>' : ''}
    <div class="ghost-row">${nAlts(it) ? `<button class="tbtn" data-swap="${it.v}">换动作（${nAlts(it)}）</button>` : ''}<button class="tbtn" data-cfg="${it.v}">调整</button><button class="tbtn" data-big="${it.v}">动作图</button></div>
    <details class="ex-why"><summary>为什么是这些数</summary><p>${esc(why)}</p></details>`;
}
/* 每组的输入：按“重量怎么记”分——杠铃类填每边的片（杆重另算，旁边显示总重）、单只、配重、自重只填次数 */
function setsHtml(it, sets, sg, lo, future) {
  const ld = C.loadOf(it.ex, it.v), dis = future ? 'disabled' : '', none = ld.mode === 'none';
  const head = `<div class="set-h ${none ? 'none' : ''}"><span></span>${none ? '' : ld.mode === 'bar' ? `<button class="set-bar" data-bars>单边片 kg · 杆 ${ld.bar}<span aria-hidden="true">›</span></button>` : `<span>${esc(ld.label)}</span>`}<span>${it.ex.timed ? '秒' : '次数'}</span><span></span></div>`;
  const rows = [...Array(it.sets)].map((_, i) => {
    const s = sets[i] || {};
    const reps = `<input class="field-in" data-set="${it.v}|${i}|r" value="${esc(s.r || '')}" placeholder="${sg ? sg.r : lo || '次数'}" inputmode="numeric" aria-label="第${i + 1}组${it.ex.timed ? '秒数' : '次数'}" ${dis}>`;
    let w = '';
    if (ld.mode === 'bar') {
      const side = s.p != null && s.p !== '' ? s.p : +s.w ? Math.max(0, (+s.w - ld.bar) / 2) : '';
      w = `<label class="wbox"><input class="field-in" data-set="${it.v}|${i}|p" value="${esc(side)}" placeholder="${sg && sg.side != null ? sg.side : '单边片'}" inputmode="decimal" aria-label="第${i + 1}组单边加的片" ${dis}><em data-tot="${it.v}|${i}">${+s.w ? '总 ' + s.w : ''}</em></label>`;
    } else if (!none) w = `<input class="field-in" data-set="${it.v}|${i}|w" value="${esc(s.w || '')}" placeholder="${sg && sg.w ? sg.w : 'kg'}" inputmode="decimal" aria-label="第${i + 1}组${ld.mode === 'db' ? '单只' : ''}重量" ${dis}>`;
    return `<div class="set ${none ? 'none' : ''}"><span class="n">${i + 1}</span>${w}${reps}<button class="hit" data-sd="${it.v}|${i}" aria-label="第${i + 1}组完成" ${dis}>${Kit.chk(!!s.done)}</button></div>`;
  }).join('');
  return `<div class="sets">${head}${rows}</div>`;
}
/* 杆重：杠铃杆、EZ 曲杆、史密斯杆各设一次，所有用这种杆的动作共用；每组只填单边的片，总重 = 杆 + 片 × 2 */
function barSheet() {
  const b = C.barsOf();
  sheet(`<h2>杆重</h2><div class="sheet-sub">设一次，所有杠铃类动作共用</div><div class="list" style="background:var(--fill3)">
    ${C.BAR_KINDS.map(([k, n]) => `<div class="frow"><label for="bar-${k}">${n}</label><div class="bar-in"><div class="chips">${[20, 15, 10].map(v => `<button data-bk="${k}|${v}" aria-pressed="${b[k] === v}">${v}</button>`).join('')}</div><input id="bar-${k}" inputmode="decimal" value="${b[k]}" aria-label="${n}重量"><em>kg</em></div></div>`).join('')}</div>
    <p class="t-foot l2" style="padding:0 6px">每组填单边加了多少片（比如两边各一片 10kg 就填 10），总重自动算成 杆 + 片 × 2。改杆重不影响已经记下的组。</p>
    <button class="pill ink wide" id="bar-ok">保存</button>`, m => {
    m.querySelectorAll('[data-bk]').forEach(x => x.onclick = () => { const [k, v] = x.dataset.bk.split('|'); m.querySelector('#bar-' + k).value = v; m.querySelectorAll(`[data-bk^="${k}|"]`).forEach(y => y.setAttribute('aria-pressed', y === x)); Kit.haptic('light'); });
    m.querySelector('#bar-ok').onclick = () => {
      const v = {}; for (const [k, n] of C.BAR_KINDS) { const x = +m.querySelector('#bar-' + k).value; if (!(x >= 0 && x <= 60)) { toast(`${n}要在 0-60kg`); return; } v[k] = x; }
      C.setBars(v); close(); Kit.haptic('success'); const y = scrollY; render(); scrollTo(0, y); toast('杆重已保存');
    };
  });
}
/* 调整一个动作：次数范围、组间休息、要不要做到力竭（对这个动作一直有效；恢复默认就回到套表规则） */
function cfgSheet(it) {
  const c = Object.assign({}, (S.custom.exCfg || {})[it.v] || {}), def = it.def || it;
  const m0 = String(c.reps || it.reps).match(/(\d+)\s*-\s*(\d+)/) || [], RESTS = ['30-60 秒', '1 分钟', '1-1.5 分钟', '2 分钟', '2-3 分钟', '3 分钟以上'];
  let rest = c.rest || it.rest, fail = c.fail != null ? c.fail : !/不追求/.test(it.fail);
  const ld0 = C.loadOf(it.ex, it.v); let load = ld0.mode; const bar = ld0.bar;
  sheet(`<h2>${esc(it.ex.n)}</h2><div class="sheet-sub">对这个动作一直有效，换到哪天练都一样</div>
    <div class="list" style="background:var(--fill3)">
      <div class="frow"><label for="cf-lo">每组次数</label><div class="cf-reps"><input id="cf-lo" inputmode="numeric" value="${m0[1] || ''}" aria-label="最少次数"><span>-</span><input id="cf-hi" inputmode="numeric" value="${m0[2] || ''}" aria-label="最多次数"><em>次</em></div></div>
      <div class="frow stack"><span class="lbl">组间休息</span><div class="chips">${RESTS.map(x => `<button data-rest="${x}" aria-pressed="${x === rest}">${x}</button>`).join('')}</div></div>
      <div class="frow"><label for="cf-fail">做到力竭</label><input type="checkbox" class="switch" id="cf-fail" ${fail ? 'checked' : ''}></div>
      <div class="frow stack"><span class="lbl">重量怎么记</span><div class="segmented" data-load>${Object.entries(C.LOADS).map(([k, n]) => `<button data-v="${k}" aria-pressed="${load === k}">${n}</button>`).join('')}</div></div>
      <button class="row" id="cf-bar-row" data-bars style="grid-template-columns:1fr auto" ${load === 'bar' ? '' : 'hidden'}><span class="row-main"><span class="row-title">杆重</span><span class="row-sub">所有杠铃类动作统一设置，每组只填单边的片</span></span><span class="row-val chev">${bar} kg</span></button></div>
    <p class="t-foot l2" style="padding:0 6px">套表默认：${esc(def.reps)} 次（${esc(def.repsSrc || '')}）；休息 ${esc(def.rest)}（${esc(def.restSrc || '')}）；${esc(def.fail)}（${esc(def.failSrc || '')}）。${it.ex.noFail ? '这是可能砸伤的动作，套表建议不要做到完全力竭。' : ''}</p>
    <button class="pill ink wide" id="cf-ok">保存</button>${(S.custom.exCfg || {})[it.v] ? '<button class="pill glass wide" id="cf-reset">恢复套表默认</button>' : ''}`, m => {
    m.querySelectorAll('[data-load] button').forEach(b => b.onclick = () => { load = b.dataset.v; m.querySelectorAll('[data-load] button').forEach(x => x.setAttribute('aria-pressed', x === b)); m.querySelector('#cf-bar-row').hidden = load !== 'bar'; Kit.haptic('light'); });
    m.querySelectorAll('[data-bars]').forEach(b => b.onclick = () => barSheet());
    m.querySelectorAll('[data-rest]').forEach(b => b.onclick = () => { rest = b.dataset.rest; m.querySelectorAll('[data-rest]').forEach(x => x.setAttribute('aria-pressed', x === b)); Kit.haptic('light'); });
    m.querySelector('#cf-ok').onclick = () => {
      const lo = +m.querySelector('#cf-lo').value, hi = +m.querySelector('#cf-hi').value, f = m.querySelector('#cf-fail').checked;
      if (!it.ex.timed && !(lo >= 1 && hi >= lo && hi <= 50)) { toast('次数要写成 8-12 这样'); return; }
      const cfg = {};
      if (!it.ex.timed && `${lo}-${hi}` !== def.reps) cfg.reps = `${lo}-${hi}`;
      if (rest !== def.rest) cfg.rest = rest;
      if (f !== !/不追求/.test(def.fail)) cfg.fail = f;
      // 重量怎么记：和默认一样就不存
      const saved = (S.custom.exCfg || {})[it.v] || {}, defLoad = (() => { const t = Object.assign({}, saved); delete S.custom.exCfg[it.v]; const x = C.loadOf(it.ex, it.v); if (Object.keys(t).length) S.custom.exCfg[it.v] = t; return x; })();
      if (load !== defLoad.mode) cfg.load = load;
      if (saved.bar != null) cfg.bar = saved.bar;   // 以前单独设过的杆重（助手可以改）保留
      S.custom.exCfg = S.custom.exCfg || {};
      if (Object.keys(cfg).length) S.custom.exCfg[it.v] = cfg; else delete S.custom.exCfg[it.v];
      saveCustom(); close(); Kit.haptic('success'); render(); toast('已保存');
    };
    const rs = m.querySelector('#cf-reset'); if (rs) rs.onclick = () => { delete S.custom.exCfg[it.v]; saveCustom(); close(); render(); toast('已恢复套表默认'); };
  });
}
/* 为什么是这个安排：分化怎么选的、今天为什么练这些、和原表有什么不同 */
/* 为什么是这个安排：一句话说清楚，细节收在“为什么这样安排”里，每条一行，出处用小字 */
function whyBlock(tr, si) {
  const cite = x => x ? ` <span class="pw-src">${esc(x)}</span>` : '';
  const items = [];
  let main;
  if (si.custom) { main = '自选部位：从当前分化的肌群里挑'; items.push(tr.ext ? '组数按补充分化' : '组数和动作按原表'); }
  else {
    const d = si.day, i = tr.days.indexOf(d) + 1;
    main = `${tr.splitName.replace('健身房', '')} · 第 ${i}/${tr.days.length} 天${si.recommended ? '，按顺序轮到这天' : '，你选的这天'}`;
    items.push(`为什么用这个分化：${esc(tr.split.why)}${cite(tr.split.src)}`);
    if (tr.reshaped) items.push(esc(tr.reshaped.replace(/（应用补充.*?）/, '')) + cite('应用补充'));
    (d.notes || []).forEach(n => items.push(esc(n)));
    if (tr.ext) items.push(`肌群和动作来自表21-24 和补充动作，组数是应用补充${cite('规则与出处')}`);
    else if (!d.made) items.push(`肌群、组数、动作来自原表${cite(d.src)}`);
    else items.push(`肌群、组数、动作仍按原来的分化，单独成一天参照${cite(d.ref)}`);
  }
  items.push(`休息日自己安排，不用一轮练完才休息${cite('表21 C8')}`);
  return `<div class="plan-why"><span>${esc(main)}</span><details><summary>为什么这样安排</summary><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul></details></div>`;
}
function viewTrain() {
  const p = S.profile, d = S.day;
  if (p.lift === false) return head('训练') + '<section class="mat card"><div class="t-headline">没有安排力量训练</div><p class="t-sub l2">你设置了不做力训，饮食按表8《无力训者》。想开始力训，到“我的 → 编辑资料”打开。</p></section>';
  const tr = training(), info = dayInfo(d), r = peek(d) || {};
  const { si, items, femaleSkip, optionalGroups, trimNote, skipped } = sessionItems(d);
  const future = d > today(), doneLift = r.done && r.done.lift;
  const total = items.reduce((s, x) => s + x.sets, 0), setsDone = items.reduce((s, it) => s + doneSets(r, it), 0);
  let h = head('训练', d, tr.splitName.replace('健身房', ''));
  h += `<div class="seg-wrap glass"><div class="seg-scroll" id="daySeg">${tr.days.map((dd, i) => `<button data-day="${i}" aria-pressed="${!si.custom && si.dayIdx === i}">${esc(dd.name)}${si.recommended && si.dayIdx === i ? '<span class="rec">推荐</span>' : ''}</button>`).join('')}<button data-day="custom" aria-pressed="${!!si.custom}">自选部位</button></div></div>`;
  h += whyBlock(tr, si);
  if (!info.lift && !doneLift) h += `<section class="note mat">${info.h && info.h.off ? `今天是${esc(info.h.name)}，力训已自动跳过。` : '今天没有安排力训。'} <button class="link" data-ov="lift">今天加练</button></section>`;
  if (femaleSkip) h += '<section class="note warn mat">女性每两轮三分化跳过一次胸日，这次可以换别的部位（表21 C14）</section>';
  if (skipped.length) h += `<section class="note warn mat">${esc(skipped.join('、'))}：按你设置的器械和伤病，没有能做的动作，这次先不练。可以在“我的 → 编辑资料 → 定制”里调整。</section>`;
  if (trimNote) h += `<section class="note mat">${esc(trimNote)}</section>`;
  h += `<section class="mat card hero"><div class="hero-top"><div class="fig hero-fig">${setsDone}<small>/ ${total} 组</small></div><div class="hero-cap">${doneLift ? '今天练完了' : '约 ' + E.estMinutes(items) + ' 分钟'}<br><span class="l3">${items.length} 个动作</span></div></div><div class="progress ok"><i style="width:${total ? Math.round(setsDone / total * 100) : 0}%"></i></div></section>`;
  // 卡组：没做完的动作
  const later = S.exLater[d] || [];
  const open = items.map((it, i) => ({ it, i })).filter(x => doneSets(r, x.it) < x.it.sets);
  const order = open.filter(x => !later.includes(x.it.v)).concat(later.map(v => open.find(x => x.it.v === v)).filter(Boolean));
  h += `<section class="section"><div class="section-h"><h2>当前动作</h2><span class="t-foot l2">${order.length ? `还剩 ${order.length} 个` : ''}</span></div>
    ${Kit.deck('exDeck', order.map(x => ({ key: x.it.v, cls: 'k-train', html: exBody(x.it, x.i, items.length, r, d, future) })), doneLift ? '<div class="t-title3" style="color:var(--ink)">今天练完了</div>' : '<div class="t-title3" style="color:var(--ink)">动作都做完了</div><div class="t-foot">点下面的“完成训练”</div>')}
    ${order.length && !future ? `<div class="deck-ctrl"><button class="pill glass" data-skip>${I.later}先跳过</button><button class="pill ink" data-exdone>${I.check}做完了</button></div>` : ''}</section>`;
  // 全部动作
  h += `<section class="section"><div class="section-h"><h2>全部动作</h2><button class="link" id="editEx">${S.edit ? '完成' : '编辑'}</button></div>`;
  if (S.edit) h += `<div class="tscope"><span class="t-foot l2">拖动 ≡ 调整顺序；改动范围</span><div class="segmented" data-tscope>${[['day', '只改今天'], ['tpl', '以后都这样']].map(([k, n]) => `<button data-v="${k}" aria-pressed="${S.trainScope === k}">${n}</button>`).join('')}</div></div>`;
  h += `<div class="list mat" id="exList">`;
  items.forEach(it => {
    const dn = doneSets(r, it);
    h += `<div class="row ex-row" data-v="${it.v}" style="grid-template-columns:${S.edit ? '40px 1fr auto 36px' : '48px 1fr auto'}">${S.edit ? `<button class="hit" data-exdel="${it.v}" aria-label="删除 ${esc(it.ex.n)}" style="margin:0;justify-items:start"><span class="del">−</span></button>` : `<img class="thumb" src="${imgUrl(it.ex, 0)}" alt="" loading="lazy">`}
      <button class="row-main" data-exopen="${it.v}"><span class="row-title">${esc(it.ex.n)}</span><span class="row-sub">${esc(it.group.name)} · ${it.sets} × ${esc(it.reps)} · 休息 ${esc(it.rest)}</span></button>
      ${S.edit ? `<span class="stepper"><button data-st="${it.v}|-1" aria-label="减一组">−</button><span>${it.sets}</span><button data-st="${it.v}|1" aria-label="加一组">+</button></span><button class="drag" data-drag="${it.v}" aria-label="拖动调整 ${esc(it.ex.n)} 的顺序">≡</button>` : `<span class="row-val">${dn === it.sets ? Kit.chk(true) : dn + ' / ' + it.sets}</span>`}</div>`;
  });
  if (S.edit) h += `<button class="row add" id="addEx"><span class="plus">+</span><span class="row-title">从动作库添加</span></button>`;
  h += '</div>';
  if (optionalGroups.length && !S.edit) h += `<div class="list-footer">${(p.level || 'new') === 'new' ? '新手偶尔加做' : '本次可选'}：${optionalGroups.map(g => `<button class="link" data-extra="${g.id}" style="min-height:32px">＋${esc(g.name)}</button>`).join('　')}</div>`;
  h += '</section>';
  h += stretchSection(items);
  h += `<button class="pill ${doneLift ? 'glass' : 'ink'} wide" id="finish" ${future ? 'disabled' : ''}>${doneLift ? '已完成 · 撤销' : '完成训练'}</button>`;
  h += `<p class="t-cap l3" style="text-align:center">${tr.ext ? '补充分化：肌群和动作来自表21-24 + 补充动作，组数为应用补充' : '动作、组数、次数来自表21-24'}，出处见“我的 → 规则与出处”</p>`;
  return h;
}
function setOf(d, v, k) { const r = rec(d); r.sets = r.sets || {}; r.sets[v] = r.sets[v] || []; return r.sets[v][k] || (r.sets[v][k] = {}); }
function modsOf(d, key, scope, fn) { if (scope === 'tpl') { const m = S.custom.train[key] || (S.custom.train[key] = {}); fn(m); saveCustom(); } else { const r = rec(d); r.ex = r.ex || {}; fn(r.ex); save(d); } }
function ensureSession(d) { const r = rec(d); if (!r.session) { const si = sessionInfo(d); r.session = { split: training().split.key, dayIdx: si.dayIdx }; } }
function bindSetInputs(root, d, items) {
  root.querySelectorAll('[data-set]').forEach(i => i.oninput = () => {
    const [v, k, f] = i.dataset.set.split('|'), s = setOf(d, v, +k), val = i.value.trim();
    s[f] = val;
    // 杠铃类：填的是每边的片，总重 = 杆 + 片 × 2（记录、建议、预测最大力量都用总重）
    if (f === 'p') { const bar = C.loadOf(window.EX[v], v).bar; s.w = val === '' ? '' : String(Math.round((bar + 2 * +val) * 100) / 100); const t = root.querySelector(`[data-tot="${v}|${k}"]`); if (t) t.textContent = s.w ? '总 ' + s.w : ''; }
    ensureSession(d); save(d);
  });
  root.querySelectorAll('[data-sd]').forEach(b => b.onclick = () => {
    const [v, k] = b.dataset.sd.split('|'); const s = setOf(d, v, +k); s.done = !s.done; ensureSession(d);
    const it = items.find(x => x.v === v), r = rec(d);
    // 没填就打勾：按建议（上次的重量和次数）记下
    if (s.done && !s.w && !s.r && !s.p) {
      const sg = suggestFor(it, d);
      if (sg) {
        if (sg.w) s.w = String(sg.w); if (sg.side != null) s.p = String(sg.side); s.r = String(sg.r);
        const q = f => root.querySelector(`[data-set="${v}|${k}|${f}"]`);
        if (q('w') && s.w) q('w').value = s.w; if (q('p') && s.p != null) q('p').value = s.p; if (q('r')) q('r').value = s.r;
        const t = root.querySelector(`[data-tot="${v}|${k}"]`); if (t && s.w) t.textContent = '总 ' + s.w;
      }
    }
    save(d); Kit.haptic(s.done ? 'medium' : 'light');
    b.innerHTML = Kit.chk(s.done);
    if (doneSets(r, it) === it.sets) { toast(`${it.ex.n} 完成`); setTimeout(() => { close(); afterSets(d, items); }, 350); }
  });
  root.querySelectorAll('[data-swap]').forEach(b => b.onclick = () => swap(items, items.findIndex(x => x.v === b.dataset.swap)));
  root.querySelectorAll('[data-big]').forEach(b => b.onclick = () => bigImage(items.find(x => x.v === b.dataset.big).ex));
  root.querySelectorAll('[data-cfg]').forEach(b => b.onclick = () => cfgSheet(items.find(x => x.v === b.dataset.cfg)));
  root.querySelectorAll('[data-bars]').forEach(b => b.onclick = () => barSheet());
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
    bindSetInputs(deckEl.querySelector('.dc.top'), d, items);
  }
  const ed = $('[data-exdone]'); if (ed) ed.onclick = () => deckEl.flyRight();
  const sk = $('[data-skip]'); if (sk) sk.onclick = () => deckEl.flyLeft();
  $('#editEx').onclick = () => { S.edit = !S.edit; render(); };
  $$('[data-ov]').forEach(b => b.onclick = () => { rec(d).override = b.dataset.ov; scoreDay(d); render(); });
  Kit.fadeEdges($('#daySeg'));
  $$('[data-str]').forEach(b => b.onclick = () => stretchSheet(+b.dataset.str));
  const allS = $('#allStretch'); if (allS) allS.onclick = allStretchSheet;
  $$('[data-day]').forEach(b => b.onclick = () => { Kit.haptic('light'); if (b.dataset.day === 'custom') return pickCustom(); rec(d).session = { split: tr.split.key, dayIdx: +b.dataset.day }; save(d); render(); });
  $$('[data-extra]').forEach(b => b.onclick = () => { const r = rec(d); r.extra = r.extra || {}; r.extra[b.dataset.extra] = true; save(d); render(); });
  // 长按动作：有备选就换动作，没有就看大图
  $$('[data-exopen]').forEach(b => { const i = items.findIndex(x => x.v === b.dataset.exopen), row = b.closest('.row'); if (row && i >= 0) Kit.longPress(row, () => nAlts(items[i]) ? swap(items, i) : bigImage(items[i].ex)); });
  $$('[data-exopen]').forEach(b => b.onclick = () => { const i = items.findIndex(x => x.v === b.dataset.exopen); sheet(`<div class="k-train" style="display:grid;gap:14px;padding-top:16px">${exBody(items[i], i, items.length, peek(d) || {}, d, d > today())}</div>`, m => bindSetInputs(m, d, items), () => { const y = scrollY; render(); scrollTo(0, y); }); });
  const stay = () => { const y = scrollY; render(); scrollTo(0, y); };
  // 编辑模式：删除、组数、拖动排序都按上面选的范围（只改今天 / 以后都这样）
  const scopeText = () => S.trainScope === 'tpl' ? `以后练“${si.custom ? '自选部位' : si.day.name}”都这样` : '只改今天';
  $$('[data-tscope] button').forEach(b => b.onclick = () => { S.trainScope = b.dataset.v; Kit.haptic('light'); $$('[data-tscope] button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $$('[data-exdel]').forEach(b => b.onclick = () => { const v = b.dataset.exdel;
    // 两层里加过的都去掉，再在选的那一层删掉（否则“只改今天”加回来的会盖住“以后都这样”的删除）
    [S.custom.train[si.key], (peek(d) || {}).ex].forEach(m => { if (m && m.add) m.add = m.add.filter(a => a.v !== v); });
    modsOf(d, si.key, S.trainScope, m => { m.hide = (m.hide || []).filter(x => x !== v).concat(v); }); stay(); toast(`已删除「${window.EX[v].n}」（${scopeText()}）`); });
  $$('[data-st]').forEach(b => b.onclick = () => { const [v, dir] = b.dataset.st.split('|'); const it = items.find(x => x.v === v); modsOf(d, si.key, S.trainScope, m => { m.sets = m.sets || {}; m.sets[v] = Math.max(1, Math.min(10, it.sets + +dir)); }); Kit.haptic('light'); stay(); });
  const exList = $('#exList');
  if (exList && S.edit) dragSort(exList, (from, to) => {
    const order = items.map(x => x.v), [mv] = order.splice(from, 1); order.splice(to, 0, mv);
    modsOf(d, si.key, S.trainScope, m => { m.order = order; }); Kit.haptic('success'); stay(); toast(`顺序已调整（${scopeText()}）`);
  });
  // 动作库可以一次选好几个，再一起问“只改今天 / 以后都这样”
  const add = $('#addEx'); if (add) add.onclick = () => library(list => askScope(list.length === 1 ? `添加「${window.EX[list[0]].n}」` : `添加 ${list.length} 个动作`, sc => {
    C.addExercises(d, si, sc, list, 3);
    render(); toast(`已添加 ${list.length} 个动作`);
  }), items.map(it => it.v));
  $('#finish').onclick = () => finish(!(peek(d) && peek(d).done && peek(d).done.lift));
  animate();
}
/* 拖动排序：按住 ≡ 上下拖，其他行让位；松手后回调 (原位置, 新位置) */
function dragSort(list, onDrop) {
  list.querySelectorAll('[data-drag]').forEach(h => h.addEventListener('pointerdown', e => {
    e.preventDefault();
    const rows = [...list.querySelectorAll('[data-v]')], row = h.closest('[data-v]'), i0 = rows.indexOf(row);
    const rects = rows.map(x => x.getBoundingClientRect()), hgt = rects[i0].height, y0 = e.clientY;
    let to = i0;
    h.setPointerCapture(e.pointerId); row.classList.add('dragging'); rows.forEach(x => x !== row && x.classList.add('shifting')); Kit.haptic('medium', true);
    const move = ev => {
      const dy = Math.max(rects[0].top - rects[i0].top, Math.min(rects[rows.length - 1].bottom - rects[i0].bottom, ev.clientY - y0));
      row.style.transform = `translateY(${dy}px)`;
      const cy = rects[i0].top + hgt / 2 + dy;
      const n = rects.filter((r, j) => j !== i0 && r.top + r.height / 2 < cy).length;
      if (n !== to) { to = n; Kit.haptic('tick'); }
      rows.forEach((x, j) => { if (j === i0) return; const sft = i0 < to && j > i0 && j <= to ? -hgt : i0 > to && j < i0 && j >= to ? hgt : 0; x.style.transform = sft ? `translateY(${sft}px)` : ''; });
    };
    const up = () => {
      h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
      rows.forEach(x => { x.style.transform = ''; x.classList.remove('dragging', 'shifting'); });
      if (to !== i0) onDrop(i0, to);
    };
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  }));
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
const libItem = (v, attr, sub) => { const ex = window.EX[v]; return `<button class="libitem" ${attr}="${v}"><img src="${imgUrl(ex, 0)}" alt="" loading="lazy"><span>${esc(ex.n)}</span><small>${esc(sub || ex.eq)}</small>${ex.ext ? `<em class="lib-tag">${esc(ex.kindName)}</em>` : ''}</button>`; };
function swap(items, idx) {
  const it = items[idx], g = it.group, ext = it.extAlts || [];
  const orig = it.alts.length ? `<div class="t-foot l2">原表同一肌群${g.ext ? '' : `（${esc(g.src)}）`}</div><div class="libgrid">${it.alts.map(v => libItem(v, 'data-alt')).join('')}</div>` : '';
  const more = ext.length ? `<div class="t-foot l2">补充备选（非套表训练计划，依据见每个动作的标签）</div><div class="libgrid">${ext.map(v => libItem(v, 'data-alt')).join('')}</div>` : '';
  sheet(`<h2>替换动作</h2><div class="sheet-sub">${esc(it.ex.n)} 的备选</div>${orig}${more}`, m => {
    m.querySelectorAll('[data-alt]').forEach(b => b.onclick = () => {
      const nv = b.dataset.alt;
      C.swapExercise(S.day, sessionItems(S.day).si, it.v, nv); close(); Kit.haptic('light'); render(); toast(`已换成 ${window.EX[nv].n}（以后练这一天也用它）`);
    });
  });
}
/* 动作库：按部位分；只列你的器械能做、没被伤病设置排除的动作（没设器械时按场地默认：健身房全部，居家哑铃/凳/弹力带/单杠）。
   可以多选：点一下选中，切换部位不会丢，最后一起添加 */
function library(onPick, have) {
  const p = S.profile, equip = p.equip && p.equip.length ? p.equip : window.EQUIP_DEFAULT[p.place === 'home' ? 'home' : 'gym'];
  const byPart = {}, picked = [], already = new Set(have || []);
  let showExt = S.libExt !== false;
  Object.values(LIB).forEach(x => { if (!window.exUsable(x.ex, equip, p.avoid || [])) return; (byPart[x.part] = byPart[x.part] || []).push(x); });
  const parts = window.PARTS.map(pt => pt.name).filter(n => byPart[n]); let cur = parts[0];
  const cell = x => { const ex = x.ex, on = picked.includes(x.v), inPlan = already.has(x.v);
    return `<button class="libitem ${on ? 'picked' : ''} ${inPlan ? 'inplan' : ''}" data-add="${x.v}" aria-pressed="${on}" ${inPlan ? 'disabled' : ''}><img src="${imgUrl(ex, 0)}" alt="" loading="lazy"><span>${esc(ex.n)}</span><small>${inPlan ? '已在今天的计划里' : esc(`${x.group} · ${ex.eq}`)}</small>${ex.ext ? `<em class="lib-tag">${esc(ex.kindName)}</em>` : ''}<i class="lib-check">${I.check}</i></button>`; };
  const footer = () => picked.length ? `<div class="lib-picked">${picked.map(v => `<button class="lib-chip" data-unpick="${v}">${esc(window.EX[v].n)}<span>×</span></button>`).join('')}</div><button class="pill ink wide" id="lib-ok">添加 ${picked.length} 个动作</button>` : '<p class="t-cap l3" style="text-align:center;margin:0">点动作选中，可以多选，切换部位不会丢</p>';
  const draw = () => sheet(`<h2>动作库</h2><div class="seg-wrap glass"><div class="seg-scroll" id="libParts">${parts.map(n => `<button data-pt="${esc(n)}" aria-pressed="${n === cur}">${esc(n)}</button>`).join('')}</div></div>
    <div class="chips"><button data-libext aria-pressed="${showExt}">显示补充动作</button></div>
    <div class="libgrid">${byPart[cur].filter(x => showExt || !x.ext).map(cell).join('')}</div>
    <p class="t-cap l3" style="text-align:center">没有标签的是表21-24 原表动作；带标签的是补充动作</p>
    <div class="lib-tray" id="libTray">${footer()}</div>`, m => {
    Kit.fadeEdges(m.querySelector('#libParts'));
    m.querySelector('[data-libext]').onclick = () => { showExt = S.libExt = !showExt; draw(); };
    m.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { cur = b.dataset.pt; Kit.haptic('light'); draw(); });
    const bindTray = () => {
      const t = m.querySelector('#libTray'); t.innerHTML = footer();
      t.querySelectorAll('[data-unpick]').forEach(b => b.onclick = () => { picked.splice(picked.indexOf(b.dataset.unpick), 1); const c = m.querySelector(`[data-add="${b.dataset.unpick}"]`); if (c) { c.classList.remove('picked'); c.setAttribute('aria-pressed', 'false'); } bindTray(); });
      const ok = t.querySelector('#lib-ok'); if (ok) ok.onclick = () => { const list = picked.slice(); close(); onPick(list); };
    };
    m.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
      const v = b.dataset.add, i = picked.indexOf(v);
      if (i >= 0) picked.splice(i, 1); else picked.push(v);
      b.classList.toggle('picked', i < 0); b.setAttribute('aria-pressed', i < 0); Kit.haptic('light'); bindTray();
    });
    bindTray();
  });
  draw();
}
function bigImage(ex) {
  sheet(`<h2>${esc(ex.n)}</h2><img class="bigimg" src="${imgUrl(ex, 0)}" alt="起始动作"><img class="bigimg" src="${imgUrl(ex, 1)}" alt="结束动作"><p class="t-foot l2">器械：${esc(ex.eq)}。${ex.ext ? `补充动作（${esc(ex.kindName)}）：${esc(ex.basis)}。` : ''}图片来自 free-exercise-db（公有领域）${ex.approx ? '，这是相近动作的示意' : ''}。</p>`);
}
let animT;
function animate() {
  clearInterval(animT);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // 只让最上面那张卡片的动作图动；切到后台就停
  let f = 0; animT = setInterval(() => { if (document.hidden || window.scrollY > 900) return; f = 1 - f; $$('.dc.top img[data-anim]').forEach(img => img.src = `img/ex/${img.dataset.anim}/${f}.jpg`); }, 1400);
}
window.Train = { view: viewTrain, bind: bindTrain, stop: () => clearInterval(animT), barSheet };
})();
