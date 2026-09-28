/* 数据：热量分析、体重、打卡、奖章 */
(() => {
const { E, $, $$, esc, today, S, peek, pctOf, allDays, burnOf, intakeOf, targetOf, streaks, totals, weights, badges, levelOf, toast, sheet, close, head, render, DOW } = C;
const KCAL_PER_KG = 7700; // 应用补充：1kg 脂肪约 7700 kcal（Excel 未给出）

function days(n) { const out = []; for (let i = n - 1; i >= 0; i--) { const d = E.addDays(today(), -i); if (d >= S.profile.startDate) out.push(d); } return out; }
function energyRows(n) {
  return days(n).map(d => { const i = intakeOf(d), b = burnOf(d), t = targetOf(d); return { d, in: i.kcal, c: i.c, p: i.p, out: b.total, target: t.kcal, tc: t.c, tp: t.p, logged: ((peek(d) || {}).food || []).length > 0 }; });
}
function energyChart(rows) {
  if (!rows.length) return '<p class="sm sub">还没有数据。</p>';
  const W = 600, H = 200, L = 40, R = 8, T = 10, B = 26;
  const max = Math.max(...rows.map(r => Math.max(r.in, r.out, r.target)), 1000);
  const top = Math.ceil(max / 500) * 500;
  const bw = (W - L - R) / rows.length, Y = v => T + (H - T - B) * (1 - v / top);
  let g = '';
  for (let v = 0; v <= top; v += top / 4) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  rows.forEach((r, i) => {
    const x = L + i * bw, w = Math.min(14, bw * .32);
    g += `<rect x="${x + bw / 2 - w - 1}" y="${Y(r.out)}" width="${w}" height="${Y(0) - Y(r.out)}" rx="3" fill="var(--line)"/>`;
    if (r.logged) g += `<rect x="${x + bw / 2 + 1}" y="${Y(r.in)}" width="${w}" height="${Y(0) - Y(r.in)}" rx="3" fill="var(--food)"/>`;
    g += `<line x1="${x + bw * .12}" x2="${x + bw * .88}" y1="${Y(r.target)}" y2="${Y(r.target)}" stroke="var(--train)" stroke-width="2" stroke-dasharray="3 3"/>`;
    const dd = E.pd(r.d); g += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${rows.length > 10 ? dd.getDate() : (dd.getMonth() + 1) + '/' + dd.getDate()}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="每日摄入与消耗">${g}</svg>
    <div class="legend"><span><i style="background:var(--food)"></i>摄入</span><span><i style="background:var(--line)"></i>消耗</span><span><i style="background:var(--train);height:3px;vertical-align:3px"></i>应吃</span></div>`;
}
function analysis(rows) {
  const L = rows.filter(r => r.logged), p = S.profile, pl = S.plan, out = [];
  if (L.length < 3) { out.push({ cls: '', text: `最近只有 ${L.length} 天记录了饮食。至少记录 3 天，才能分析热量。` }); return { out, L }; }
  const avg = k => Math.round(L.reduce((s, r) => s + r[k], 0) / L.length);
  const ain = avg('in'), aout = avg('out'), atg = avg('target'), ap = avg('p'), atp = avg('tp');
  const gap = aout - ain, wk = gap * 7 / KCAL_PER_KG;
  if (ain > atg * 1.1) out.push({ cls: 'warn', text: `记录的摄入平均 ${ain} kcal，比应吃的 ${atg} 高 ${Math.round((ain / atg - 1) * 100)}%。原表的应吃热量已经预留了没记到的部分（表5 G19），记录到的最好不超过应吃。先看碳水：主食减一点。` });
  else if (ain < atg * 0.8) out.push({ cls: 'warn', text: `记录的摄入平均 ${ain} kcal，比应吃的 ${atg} 低 ${Math.round((1 - ain / atg) * 100)}%。吃得太少容易饿、掉肌肉；如果是漏记了，尽量每餐都记。` });
  else out.push({ cls: 'ok', text: `记录的摄入平均 ${ain} kcal，和应吃的 ${atg} kcal 接近，执行得不错。` });
  if (ap < atp * 0.85) out.push({ cls: 'warn', text: `蛋白质平均 ${ap}g，目标 ${atp}g，差 ${atp - ap}g。瘦肉要吃够，食堂瘦肉不够可以加鸡蛋、牛肉干（表17 第10问）。` });
  out.push({ cls: '', text: `平均消耗 ${aout} kcal，平均缺口 ${gap} kcal/天。按 1kg 脂肪约 7700 kcal 估算，每周约${gap >= 0 ? '减' : '增'} ${Math.abs(wk).toFixed(2)}kg（估算为应用补充，以实际体重为准）。` });
  const adv = E.advice(p, pl, weights(), today());
  adv.forEach(a => out.push({ cls: a.cls, text: a.text }));
  return { out, L, sum: { 平均摄入kcal: ain, 平均消耗kcal: aout, 应吃kcal: atg, 平均蛋白质g: ap, 蛋白质目标g: atp, 平均碳水g: avg('c'), 碳水目标g: avg('tc'), 平均缺口kcal: gap } };
}
function weightChart() {
  const ws = weights();
  if (ws.length < 2) return '<p class="sm sub">记录两天以上体重后显示趋势。</p>';
  const pts = ws.slice(-90), W = 600, H = 180, L = 40, R = 10, T = 10, B = 24;
  const d0 = pts[0].d, span = Math.max(1, (E.pd(pts[pts.length - 1].d) - E.pd(d0)) / 864e5);
  let lo = Math.floor(Math.min(...pts.map(x => x.w)) - .5), hi = Math.ceil(Math.max(...pts.map(x => x.w)) + .5);
  const X = d => L + (W - L - R) * ((E.pd(d) - E.pd(d0)) / 864e5) / span, Y = w => T + (H - T - B) * (hi - w) / (hi - lo);
  const step = hi - lo > 8 ? 2 : 1; let g = '';
  for (let v = lo; v <= hi; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  const ma = pts.map(x => { const win = pts.filter(y => y.d <= x.d && y.d > E.addDays(x.d, -7)); return { d: x.d, w: win.reduce((s, y) => s + y.w, 0) / win.length }; });
  const line = ma.map((x, i) => (i ? 'L' : 'M') + X(x.d).toFixed(1) + ' ' + Y(x.w).toFixed(1)).join(' ');
  const dots = pts.map(x => `<circle cx="${X(x.d).toFixed(1)}" cy="${Y(x.w).toFixed(1)}" r="2.5" fill="var(--faint)"/>`).join('');
  const last = ma[ma.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="体重趋势">${g}${dots}<path d="${line}" fill="none" stroke="var(--train)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${X(last.d)}" cy="${Y(last.w)}" r="4.5" fill="var(--train)"/></svg><div class="legend"><span>点：每天体重</span><span><i style="background:var(--train)"></i>7 天平均</span></div>`;
}
function heat() {
  const td = today(); let start = E.addDays(td, -27); start = E.addDays(start, -E.dow(start));
  let h = DOW.map(x => `<div class="hd">${x}</div>`).join('');
  for (let d = start; d <= E.addDays(td, 6 - E.dow(td)); d = E.addDays(d, 1)) {
    const pc = pctOf(peek(d)), fut = d > td || d < S.profile.startDate, hol = C.holiday(d);
    const bg = fut ? 'var(--fill)' : pc >= 1 ? 'var(--done)' : pc >= .8 ? 'color-mix(in srgb,var(--done) 65%,var(--card))' : pc > 0 ? 'color-mix(in srgb,var(--done) 25%,var(--card))' : hol && hol.off ? 'var(--warn-soft)' : 'var(--fill)';
    h += `<div class="h" style="background:${bg};${pc >= .8 && !fut ? 'color:#fff;' : ''}${d === td ? 'outline:2px solid var(--ink);' : ''}${fut ? 'opacity:.4' : ''}">${E.pd(d).getDate()}</div>`;
  }
  return `<div class="heat">${h}</div>`;
}
let range = 7;
function viewData() {
  const rows = energyRows(range), an = analysis(rows), t = totals(), lv = levelOf(t.points), bs = badges();
  const ws = weights(), w0 = +S.profile.startWeight || +S.profile.weight, wl = ws.length ? ws[ws.length - 1].w : w0;
  let h = head('数据');
  h += `<div class="card"><div class="row between"><h2 style="font-size:17px">热量</h2><div class="seg" style="width:140px"><button data-rg="7" aria-pressed="${range === 7}">7 天</button><button data-rg="14" aria-pressed="${range === 14}">14 天</button></div></div>${energyChart(rows)}
    <div class="stack">${an.out.map(a => `<div class="note sm ${a.cls}">${esc(a.text)}</div>`).join('')}</div>
    ${an.sum ? '<button class="btn ghost block" id="aiWeek">让 AI 分析这段时间</button><div id="aiOut"></div>' : ''}</div>`;
  h += `<div class="card"><div class="row between"><h2 style="font-size:17px">体重</h2><span class="sm sub num">${wl.toFixed ? wl.toFixed(1) : wl} kg · ${(wl - w0 > 0 ? '+' : '') + (wl - w0).toFixed(1)}</span></div>${weightChart()}</div>`;
  h += `<div class="card"><div class="row between"><h2 style="font-size:17px">坚持</h2><span class="sm sub">${lv.name} · <span class="num">${t.points}</span> 能量</span></div>
    <div class="lv"><i style="width:${lv.max ? 100 : Math.round(lv.into / lv.need * 100)}%"></i></div>
    <div class="kv"><div class="stat"><span class="k">连续达标</span><span class="v">${t.cur}<small>天</small></span></div><div class="stat"><span class="k">最长连续</span><span class="v">${t.best}<small>天</small></span></div>
    <div class="stat"><span class="k">累计力训</span><span class="v">${t.lifts}<small>次</small></span></div><div class="stat"><span class="k">记录饮食</span><span class="v">${t.meals}<small>餐</small></span></div></div>
    ${heat()}<p class="xs faint">越绿完成得越多；浅红是节假日，不影响连续记录</p></div>`;
  h += `<div class="card"><div class="row between"><h2 style="font-size:17px">奖章</h2><span class="xs sub num">${bs.filter(b => b.got).length}/${bs.length}</span></div><div class="badges">${bs.map((b, i) => `<div class="badge ${b.got ? 'got' : ''}"><span class="m">${i + 1}</span>${esc(b.name)}</div>`).join('')}</div></div>`;
  return h;
}
function bindData() {
  $$('[data-rg]').forEach(b => b.onclick = () => { range = +b.dataset.rg; render(); });
  const ab = $('#aiWeek');
  if (ab) ab.onclick = async () => {
    if (!S.ai.key || !S.ai.model) { toast('请先在“我的 → 大模型接口”里填好接口'); return; }
    const an = analysis(energyRows(range));
    const ws = weights().slice(-14).map(x => ({ 日期: x.d, 体重kg: x.w }));
    ab.disabled = true; ab.textContent = '分析中…';
    try {
      const text = await AI.analyzeWeek(S.ai, { 目标: S.plan.goal === 'cut' ? '减脂' : '增肌', 天数: an.L.length, ...an.sum, 最近体重: ws, 每日: energyRows(range).filter(r => r.logged).map(r => ({ 日期: r.d, 摄入: r.in, 消耗: r.out, 碳水: r.c, 蛋白质: r.p })) });
      $('#aiOut').innerHTML = `<div class="note sm" style="white-space:pre-wrap">${esc(text)}</div><p class="xs faint">AI 分析仅供参考（模型：${esc(S.ai.model)}）</p>`;
    } catch (e) { $('#aiOut').innerHTML = `<div class="note warn sm">${esc(e.message)}</div>`; }
    ab.disabled = false; ab.textContent = '让 AI 分析这段时间';
  };
}
window.Data = { view: viewData, bind: bindData };
})();
