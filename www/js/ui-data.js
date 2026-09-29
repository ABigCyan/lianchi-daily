/* 数据：洞察卡组、热量、体重、坚持、奖章 */
(() => {
const { E, $, $$, esc, today, S, peek, pctOf, burnOf, intakeOf, targetOf, totals, weights, badges, levelOf, toast, head, render, DOW } = C;
const { I } = Kit;
const KCAL_PER_KG = 7700; // 应用补充：1kg 脂肪约 7700 kcal（Excel 未给出）
let range = 7, insightIdx = 0, aiText = '';

function days(n) { const out = []; for (let i = n - 1; i >= 0; i--) { const d = E.addDays(today(), -i); if (d >= S.profile.startDate) out.push(d); } return out; }
function energyRows(n) { return days(n).map(d => { const i = intakeOf(d), b = burnOf(d), t = targetOf(d); return { d, in: i.kcal, c: i.c, p: i.p, out: b.total, target: t.kcal, tc: t.c, tp: t.p, logged: ((peek(d) || {}).food || []).length > 0 }; }); }
function analysis(rows) {
  const L = rows.filter(r => r.logged), out = [];
  if (L.length < 3) { out.push({ cls: '', title: '记录还不够', text: `最近 ${rows.length} 天里只有 ${L.length} 天记录了饮食。至少记录 3 天，才能分析热量。` }); }
  let sum = null;
  if (L.length >= 3) {
    const avg = k => Math.round(L.reduce((s, r) => s + r[k], 0) / L.length);
    const ain = avg('in'), aout = avg('out'), atg = avg('target'), ap = avg('p'), atp = avg('tp'), gap = aout - ain, wk = gap * 7 / KCAL_PER_KG;
    if (ain > atg * 1.1) out.push({ cls: 'warn', title: '吃得偏多', text: `记录的摄入平均 ${ain} kcal，比应吃的 ${atg} 高 ${Math.round((ain / atg - 1) * 100)}%。原表的应吃热量已经预留了没记到的部分（表5 G19），先减一点主食。` });
    else if (ain < atg * 0.8) out.push({ cls: 'warn', title: '吃得偏少', text: `记录的摄入平均 ${ain} kcal，比应吃的 ${atg} 低 ${Math.round((1 - ain / atg) * 100)}%。吃太少容易饿、掉肌肉；如果是漏记，尽量每餐都记。` });
    else out.push({ cls: 'ok', title: '摄入合适', text: `记录的摄入平均 ${ain} kcal，和应吃的 ${atg} kcal 接近。` });
    if (ap < atp * 0.85) out.push({ cls: 'warn', title: '蛋白质不够', text: `平均 ${ap}g，目标 ${atp}g，每天差 ${atp - ap}g。瘦肉要吃够，不够可以加鸡蛋、牛肉干（表17 第10问）。` });
    out.push({ cls: '', title: `每天缺口 ${gap} kcal`, text: `平均消耗 ${aout}，平均摄入 ${ain}。按 1kg 脂肪约 7700 kcal 估算，每周约${gap >= 0 ? '减' : '增'} ${Math.abs(wk).toFixed(2)}kg（应用补充，以实际体重为准）。` });
    sum = { 平均摄入kcal: ain, 平均消耗kcal: aout, 应吃kcal: atg, 平均蛋白质g: ap, 蛋白质目标g: atp, 平均碳水g: avg('c'), 碳水目标g: avg('tc'), 平均缺口kcal: gap };
  }
  E.advice(S.profile, S.plan, weights(), today()).forEach(a => out.push({ cls: a.cls, title: a.cls === 'ok' ? '体重进度正常' : a.cls === 'warn' ? '体重进度需要注意' : '体重进度', text: a.text }));
  return { out, L, sum };
}
function energyChart(rows) {
  const W = 600, H = 190, L = 40, R = 6, T = 8, B = 24;
  const top = Math.ceil(Math.max(...rows.map(r => Math.max(r.in, r.out, r.target)), 1000) / 500) * 500;
  const bw = (W - L - R) / rows.length, Y = v => T + (H - T - B) * (1 - v / top);
  let g = '';
  for (let v = 0; v <= top; v += top / 4) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--sep)" stroke-width=".5"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  rows.forEach((r, i) => {
    const x = L + i * bw, w = Math.min(13, bw * .3);
    g += `<rect x="${x + bw / 2 - w - 1.5}" y="${Y(r.out)}" width="${w}" height="${Y(0) - Y(r.out)}" rx="${w / 2}" fill="var(--ink4)"/>`;
    if (r.logged) g += `<rect x="${x + bw / 2 + 1.5}" y="${Y(r.in)}" width="${w}" height="${Y(0) - Y(r.in)}" rx="${w / 2}" fill="var(--ink)"/>`;
    g += `<line x1="${x + bw * .14}" x2="${x + bw * .86}" y1="${Y(r.target)}" y2="${Y(r.target)}" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 4"/>`;
    const dd = E.pd(r.d); g += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${rows.length > 10 ? dd.getDate() : (dd.getMonth() + 1) + '/' + dd.getDate()}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="每日摄入与消耗">${g}</svg><div class="legend"><span><i style="background:var(--ink)"></i>摄入</span><span><i style="background:var(--ink4)"></i>消耗</span><span><i style="background:var(--accent)"></i>应吃</span></div>`;
}
function weightChart() {
  const ws = weights(); if (ws.length < 2) return '<p class="t-sub l2">记录两天以上体重后显示趋势。</p>';
  const pts = ws.slice(-90), W = 600, H = 170, L = 40, R = 10, T = 10, B = 20;
  const d0 = pts[0].d, span = Math.max(1, (E.pd(pts[pts.length - 1].d) - E.pd(d0)) / 864e5);
  const lo = Math.floor(Math.min(...pts.map(x => x.w)) - .5), hi = Math.ceil(Math.max(...pts.map(x => x.w)) + .5);
  const X = d => L + (W - L - R) * ((E.pd(d) - E.pd(d0)) / 864e5) / span, Y = w => T + (H - T - B) * (hi - w) / (hi - lo);
  let g = ''; for (let v = lo; v <= hi; v += (hi - lo > 8 ? 2 : 1)) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--sep)" stroke-width=".5"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  const ma = pts.map(x => { const win = pts.filter(y => y.d <= x.d && y.d > E.addDays(x.d, -7)); return { d: x.d, w: win.reduce((s, y) => s + y.w, 0) / win.length }; });
  const line = ma.map((x, i) => (i ? 'L' : 'M') + X(x.d).toFixed(1) + ' ' + Y(x.w).toFixed(1)).join(' ');
  const area = line + ` L${X(ma[ma.length - 1].d).toFixed(1)} ${H - B} L${X(ma[0].d).toFixed(1)} ${H - B} Z`;
  const last = ma[ma.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="体重趋势"><defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ink)" stop-opacity=".12"/><stop offset="1" stop-color="var(--ink)" stop-opacity="0"/></linearGradient></defs>${g}<path d="${area}" fill="url(#wg)"/>${pts.map(x => `<circle cx="${X(x.d).toFixed(1)}" cy="${Y(x.w).toFixed(1)}" r="2.2" fill="var(--ink4)"/>`).join('')}<path d="${line}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(last.d)}" cy="${Y(last.w)}" r="5" fill="var(--accent)" stroke="var(--glass-strong)" stroke-width="2"/></svg><div class="legend"><span>点：每天体重</span><span><i style="background:var(--ink)"></i>7 天平均</span></div>`;
}
function heat() {
  const td = today(); let start = E.addDays(td, -27); start = E.addDays(start, -E.dow(start));
  let h = DOW.map(x => `<div class="hd">${x}</div>`).join('');
  for (let d = start; d <= E.addDays(td, 6 - E.dow(td)); d = E.addDays(d, 1)) {
    const pc = pctOf(peek(d)), fut = d > td || d < S.profile.startDate, hol = C.holiday(d);
    const bg = fut ? 'var(--fill)' : pc >= 1 ? 'var(--ink)' : pc >= .8 ? 'color-mix(in srgb,var(--ink) 60%,transparent)' : pc > 0 ? 'color-mix(in srgb,var(--ink) 18%,transparent)' : hol && hol.off ? 'color-mix(in srgb,var(--amber) 22%,transparent)' : 'var(--fill)';
    h += `<div class="h" style="background:${bg};${pc >= .8 && !fut ? 'color:var(--bg);' : ''}${d === td ? 'box-shadow:inset 0 0 0 1.5px var(--accent);' : ''}${fut ? 'opacity:.35' : ''}">${E.pd(d).getDate()}</div>`;
  }
  return `<div class="heat">${h}</div>`;
}
function viewData() {
  const rows = energyRows(range), an = analysis(rows), t = totals(), lv = levelOf(t.points), bs = badges();
  const ws = weights(), w0 = +S.profile.startWeight || +S.profile.weight, wl = ws.length ? ws[ws.length - 1].w : w0;
  let h = head('数据', null, `${S.plan.goal === 'cut' ? '减脂' : '增肌'} · 第 ${C.weekOf(today())} 周`);
  const cards = an.out.map((a, i) => ({ key: String(i), cls: '', html: `<div class="dc-kind" style="--k:${a.cls === 'warn' ? 'var(--orange)' : a.cls === 'ok' ? 'var(--green)' : 'var(--blue)'}"><span class="ico">${a.cls === 'warn' ? I.info : a.cls === 'ok' ? I.check : I.data}</span><span>洞察 ${i + 1}/${an.out.length}</span></div><div class="dc-title" style="font-size:24px">${esc(a.title)}</div><div class="dc-sub" style="font-size:16px;line-height:1.45">${esc(a.text)}</div>` }));
  const ordered = cards.slice(insightIdx % cards.length).concat(cards.slice(0, insightIdx % cards.length));
  h += `<section class="section"><div class="section-h"><h2>洞察</h2><span class="t-foot l2">左右滑看下一条</span></div>${Kit.deck('insDeck', ordered, '', { r: '下一条', l: '下一条' })}
    ${an.sum ? `<div class="deck-ctrl" style="grid-template-columns:1fr"><button class="pill glass" id="aiWeek">${I.sparkles}AI 分析</button></div>` : ''}${aiText ? `<section class="note mat" style="white-space:pre-wrap">${esc(aiText)}<div class="t-cap l3" style="margin-top:6px">AI 分析仅供参考 · ${esc(S.ai.model)}</div></section>` : ''}</section>`;
  h += `<section class="mat card"><div style="display:flex;justify-content:space-between;align-items:center"><span class="t-title3">热量</span><div class="segmented"><button data-rg="7" aria-pressed="${range === 7}">7 天</button><button data-rg="14" aria-pressed="${range === 14}">14 天</button></div></div>${energyChart(rows)}</section>`;
  h += `<section class="mat card"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="t-title3">体重</span><span class="num t-headline">${(+wl).toFixed(1)} kg <span class="l2 t-sub">${(wl - w0 > 0 ? '+' : '') + (wl - w0).toFixed(1)}</span></span></div>${weightChart()}</section>`;
  h += `<section class="mat card"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="t-title3">坚持</span><span class="t-sub l2">${lv.name} · <span class="num">${t.points}</span> 能量</span></div>
    <div class="stat-grid"><div class="stat"><span class="k">连续达标</span><span class="v">${t.cur}<small>天</small></span></div><div class="stat"><span class="k">最长连续</span><span class="v">${t.best}<small>天</small></span></div>
    <div class="stat"><span class="k">累计力训</span><span class="v">${t.lifts}<small>次</small></span></div><div class="stat"><span class="k">记录饮食</span><span class="v">${t.meals}<small>餐</small></span></div></div>
    ${heat()}<div class="t-cap l3">颜色越深完成得越多；浅黄是节假日，不影响连续记录</div></section>`;
  h += `<section class="mat card"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="t-title3">奖章</span><span class="t-sub l2 num">${bs.filter(b => b.got).length}/${bs.length}</span></div><div class="medals">${bs.map((b, i) => `<div class="medal ${b.got ? 'got' : ''}"><span class="m">${b.got ? I.check.replace('<svg', '<svg width="24" height="24"') : i + 1}</span>${esc(b.name)}</div>`).join('')}</div></section>`;
  return h;
}
function bindData() {
  Kit.bindDeck('insDeck', () => { insightIdx++; render(); }, () => { insightIdx++; render(); });
  $$('[data-rg]').forEach(b => b.onclick = () => { range = +b.dataset.rg; Kit.haptic('light'); render(); });
  const ab = $('#aiWeek');
  if (ab) ab.onclick = async () => {
    if (!S.ai.key || !S.ai.model) { toast('先到“我的 → 大模型接口”设置'); return; }
    const rows = energyRows(range), an = analysis(rows);
    ab.disabled = true; ab.innerHTML = `${I.sparkles}分析中…`;
    try {
      aiText = await AI.analyzeWeek(S.ai, { 目标: S.plan.goal === 'cut' ? '减脂' : '增肌', 天数: an.L.length, ...an.sum, 最近体重: weights().slice(-14).map(x => ({ 日期: x.d, 体重kg: x.w })), 每日: rows.filter(r => r.logged).map(r => ({ 日期: r.d, 摄入: r.in, 消耗: r.out, 碳水: r.c, 蛋白质: r.p })) });
      Kit.haptic('success'); render();
    } catch (e) { toast(e.message); ab.disabled = false; ab.innerHTML = `${I.sparkles}AI 分析`; }
  };
}
window.Data = { view: viewData, bind: bindData };
})();
