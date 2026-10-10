/* 数据：洞察卡组、热量、体重、坚持、奖章 */
(() => {
const { E, $, $$, esc, today, S, peek, pctOf, burnOf, intakeOf, targetOf, totals, weights, badges, levelOf, toast, head, render, DOW, metricsOn, metricSeries, allDays } = C;
const { I } = Kit;
const KCAL_PER_KG = 7700; // 应用补充：1kg 脂肪约 7700 kcal（Excel 未给出）
// 两张曲线各自的时间范围（天）；“缩放”滑块平时收起
const rng = { energy: 7, m: 14 }, zoomOpen = { energy: false, m: false };
let insightIdx = 0, metricIdx = 0, aiText = '';

// 最近 n 天（不管开始用 App 之前有没有数据，横轴都是完整的 n 天，切换范围才看得出区别）
function days(n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(E.addDays(today(), -i)); return out; }
function energyRows(n) { return days(n).map(d => { if (d < S.profile.startDate) return { d, none: true }; const i = intakeOf(d), b = burnOf(d), t = targetOf(d); return { d, in: i.kcal, c: i.c, p: i.p, out: b.total, target: t.kcal, tc: t.c, tp: t.p, logged: ((peek(d) || {}).food || []).length > 0 }; }); }
const maxDays = () => Math.max(30, Math.min(365, Math.round((E.pd(today()) - E.pd(S.profile.startDate)) / 864e5) + 1));
function rangeCtl(id, title) {
  const n = rng[id], max = maxDays();
  return `<div class="rng">${title ? `<span class="t-title3" style="margin-right:auto">${title}</span>` : ''}<div class="segmented" data-rg="${id}">${[7, 14, 30].map(v => `<button data-v="${v}" aria-pressed="${n === v}">${v} 天</button>`).join('')}</div><button class="zoom-btn ${zoomOpen[id] || ![7, 14, 30].includes(n) ? 'on' : ''}" data-zoom="${id}" aria-label="自由缩放" aria-expanded="${zoomOpen[id]}">${I.search}</button></div>
    <div class="rng-slider" ${zoomOpen[id] ? '' : 'hidden'}><input type="range" class="range" data-rs="${id}" min="3" max="${max}" step="1" value="${Math.min(n, max)}" aria-label="显示多少天"><span class="num" data-rv="${id}">${n} 天</span></div>`;
}
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
/* 平滑曲线：单调三次插值（Fritsch-Carlson），不会冲过数据点。返回每一段的路径，方便把“补出来的”段画成虚线 */
function smoothSegs(pts) {
  const n = pts.length; if (n < 2) return [];
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  const f = v => v.toFixed(1), out = [];
  for (let i = 0; i < n - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3; out.push(`M${f(x0)} ${f(y0)} C${f(x0 + h)} ${f(y0 + t[i] * h)} ${f(x1 - h)} ${f(y1 - t[i + 1] * h)} ${f(x1)} ${f(y1)}`); }
  return out;
}
const smooth = pts => { const s = smoothSegs(pts); return s.length ? s[0] + s.slice(1).map(x => x.replace(/^M[^C]*/, '')).join('') : pts.length ? `M${pts[0][0]} ${pts[0][1]}` : ''; };
// 日期刻度：天数多时隔几天标一次
function xLabels(list, X, H) {
  const n = list.length, every = n <= 10 ? 1 : n <= 16 ? 2 : n <= 35 ? 5 : n <= 70 ? 10 : 30;
  let g = '';
  list.forEach((d, i) => { if ((n - 1 - i) % every) return; const dd = E.pd(d); g += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${n > 10 && i !== n - 1 && dd.getDate() !== 1 ? dd.getDate() : (dd.getMonth() + 1) + '/' + dd.getDate()}</text>`; });
  return g;
}
/* 线性补值：没记录的日子按前后两次记录连线补上（只补两次记录之间的） */
function fillGaps(vals) {
  const out = vals.slice(), idx = vals.map((v, i) => v == null ? -1 : i).filter(i => i >= 0);
  for (let k = 0; k < idx.length - 1; k++) { const a = idx[k], b = idx[k + 1]; for (let i = a + 1; i < b; i++) out[i] = vals[a] + (vals[b] - vals[a]) * (i - a) / (b - a); }
  return out;
}
// 按“是真实记录还是补出来的”分段画：两端都是真实记录且相邻是实线，否则虚线
function seriesPath(daysVals, real, X, Y, style) {
  const pts = [], ix = [];
  daysVals.forEach((v, i) => { if (v != null) { pts.push([X(i), Y(v)]); ix.push(i); } });
  return smoothSegs(pts).map((seg, k) => { const a = ix[k], b = ix[k + 1], solid = real[a] && real[b] && b - a === 1; return `<path d="${seg}" fill="none" ${style} ${solid ? '' : 'stroke-dasharray="4 5" opacity=".75"'}/>`; }).join('');
}
function energyChart(rows) {
  const W = 600, H = 200, L = 40, R = 14, T = 14, B = 24, n = rows.length;
  const live = rows.filter(r => !r.none);
  const top = Math.ceil(Math.max(...live.map(r => Math.max(r.logged ? r.in : 0, r.out, r.target)), 1000) / 500) * 500;
  const bw = (W - L - R) / n, X = i => L + bw * (i + .5), Y = v => T + (H - T - B) * (1 - v / top);
  let g = '';
  for (let v = 0; v <= top; v += top / 4) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--sep)" stroke-width=".5"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  g += xLabels(rows.map(r => r.d), X, H);
  const first = rows.findIndex(r => !r.none);
  if (first > 0) g += `<rect x="${L}" y="${T}" width="${X(first) - bw / 2 - L}" height="${H - T - B}" fill="var(--fill)" rx="6"/><text x="${(L + X(first) - bw / 2) / 2}" y="${(T + H - B) / 2}" text-anchor="middle">开始前</text>`;
  const all = rows.map(() => true);
  // 应吃：虚线；消耗：浅色；摄入：深色，没记的日子按前后两天补上（虚线段、空心点）
  g += `<path d="${smooth(rows.map((r, i) => r.none ? null : [X(i), Y(r.target)]).filter(Boolean))}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="3 5" stroke-linecap="round"/>`;
  g += seriesPath(rows.map(r => r.none ? null : r.out), all, X, Y, 'stroke="var(--ink4)" stroke-width="2.4" stroke-linecap="round"');
  const raw = rows.map(r => r.logged ? r.in : null), filled = fillGaps(raw), real = raw.map(v => v != null);
  const inPts = filled.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
  if (inPts.length > 1) g += `<path d="${smooth(inPts)} L${inPts[inPts.length - 1][0].toFixed(1)} ${Y(0)} L${inPts[0][0].toFixed(1)} ${Y(0)} Z" fill="url(#eg)"/>`;
  g += seriesPath(filled, real, X, Y, 'stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round"');
  const dots = n <= 31;
  if (dots) rows.forEach((r, i) => { if (!r.none) g += `<circle cx="${X(i).toFixed(1)}" cy="${Y(r.out).toFixed(1)}" r="2.4" fill="var(--ink4)"/>`; });
  const lastI = raw.map((v, i) => v != null ? i : -1).filter(i => i >= 0).pop();
  filled.forEach((v, i) => { if (v == null || (!dots && i !== lastI)) return; g += real[i] ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === lastI ? 4.5 : 3}" fill="${i === lastI ? 'var(--accent)' : 'var(--ink)'}" stroke="var(--card-solid)" stroke-width="1.5"/>` : `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" fill="var(--card-solid)" stroke="var(--ink)" stroke-width="1.2"/>`; });
  if (lastI != null) { const x = X(lastI), y = Y(raw[lastI]); g += `<text x="${Math.min(x, W - R - 4)}" y="${Math.max(y - 10, T + 8)}" text-anchor="${x > W - 60 ? 'end' : 'middle'}" style="font-weight:600;fill:var(--ink)">${raw[lastI]}</text>`; }
  const note = rows.some(r => r.logged) ? (real.some((r, i) => !r && filled[i] != null) ? '<p class="t-cap l3" style="margin:4px 0 0">空心点和虚线：那天没记录，按前后两天补的</p>' : '') : '<p class="t-cap l3" style="margin:4px 0 0">还没有饮食记录，记录后会画出摄入曲线</p>';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="每日摄入与消耗"><defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ink)" stop-opacity=".12"/><stop offset="1" stop-color="var(--ink)" stop-opacity="0"/></linearGradient></defs>${g}</svg>${note}<div class="legend"><span><i style="background:var(--ink)"></i>摄入</span><span><i style="background:var(--ink4)"></i>消耗</span><span><i class="dash"></i>应吃</span></div>`;
}
/* 身体数据曲线（体重、腰围……）：点是实际记录，没记录的日子按前后补上（虚线）；体重另画 7 天平均（表17 B91 只比较 1-2 周平均） */
function metricChart(m, n) {
  const all = metricSeries(m.id);
  if (all.length < 2) return `<p class="t-sub l2">记录两天以上${m.name}后显示趋势。</p>`;
  const W = 600, H = 170, L = 40, R = 12, T = 12, B = 22, list = days(n);
  // 先在全部日子上补值（窗口边上也能连到窗口外的记录），再截取这个窗口
  const span = allDays(), byDay = Object.fromEntries(all.map(x => [x.d, x.w]));
  const full = fillGaps(span.map(d => byDay[d] != null ? byDay[d] : null));
  const at = Object.fromEntries(span.map((d, i) => [d, full[i]]));
  const vals = list.map(d => at[d] != null ? at[d] : null), real = list.map(d => byDay[d] != null);
  const avg = m.id === 'weight' ? list.map(d => { const i = span.indexOf(d); if (i < 0 || full[i] == null) return null; const w = full.slice(Math.max(0, i - 6), i + 1).filter(v => v != null); return w.reduce((a, b) => a + b, 0) / w.length; }) : null;
  const shown = vals.concat(avg || []).filter(v => v != null);
  if (!shown.length) return `<p class="t-sub l2">最近 ${n} 天没有${m.name}记录，把范围拉大看看。</p>`;
  let lo = Math.min(...shown), hi = Math.max(...shown); const pad = Math.max(.5, (hi - lo) * .15); lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
  const bw = (W - L - R) / list.length, X = i => L + bw * (i + .5), Y = v => T + (H - T - B) * (hi - v) / (hi - lo);
  let g = '';
  const stepY = (hi - lo) > 16 ? 5 : (hi - lo) > 8 ? 2 : 1;
  for (let v = lo; v <= hi; v += stepY) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--sep)" stroke-width=".5"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  g += xLabels(list, X, H);
  if (avg) g += `<path d="${smooth(avg.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean))}" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".18"/>`;
  g += seriesPath(vals, real, X, Y, 'stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round"');
  vals.forEach((v, i) => { if (v == null) return; if (real[i]) g += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.2" fill="var(--ink)" stroke="var(--card-solid)" stroke-width="1.5"/>`; else if (list.length <= 31) g += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.2" fill="var(--card-solid)" stroke="var(--ink)" stroke-width="1"/>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${m.name}趋势">${g}</svg><div class="legend"><span><i style="background:var(--ink)"></i>每次记录（虚线是补的）</span>${avg ? '<span><i class="band"></i>7 天平均</span>' : ''}</div>`;
}
function metricCard(m, n, of) {
  const all = metricSeries(m.id), inWin = all.filter(x => x.d >= E.addDays(today(), -(n - 1)));
  const last = all.length ? all[all.length - 1].w : (m.id === 'weight' ? +S.profile.weight : null);
  const ref = inWin.length ? inWin[0].w : last, dl = last != null && ref != null ? last - ref : 0;
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span class="t-title3">${m.name}${of ? `<span class="t-cap l3" style="margin-left:8px;font-weight:500">${of}</span>` : ''}</span><span class="num t-headline">${last != null ? `${(+last).toFixed(1)} ${m.unit}` : '—'} <span class="l2 t-sub">${inWin.length > 1 ? (dl > 0 ? '+' : '') + dl.toFixed(1) : ''}</span></span></div>
    ${rangeCtl('m')}${metricChart(m, n)}${m.note ? `<p class="t-cap l3" style="margin:6px 0 0">${esc(m.note)}</p>` : ''}`;
}
/* 坚持日历：按月显示，‹ › 或左右滑切换月份 */
let calMonth = null;
function heat() {
  const td = today(), ym = calMonth || td.slice(0, 7), first = ym + '-01';
  const [y, m] = ym.split('-').map(Number), n = new Date(y, m, 0).getDate();
  const minYm = S.profile.startDate.slice(0, 7), maxYm = td.slice(0, 7);
  let h = DOW.map(x => `<div class="hd">${x}</div>`).join('');
  for (let i = 0; i < E.dow(first); i++) h += '<div class="h blank" aria-hidden="true"></div>';
  let good = 0, lifts = 0, meals = 0;
  for (let k = 1; k <= n; k++) {
    const d = ym + '-' + String(k).padStart(2, '0'), r = peek(d), pc = pctOf(r), fut = d > td || d < S.profile.startDate, hol = C.holiday(d);
    if (!fut) { if (pc >= .8) good++; if (r && r.done && r.done.lift) lifts++; if (r && (r.food || []).length) meals++; }
    const lv = fut ? 'fut' : pc >= 1 ? 'l3' : pc >= .8 ? 'l2' : pc > 0 ? 'l1' : hol && hol.off ? 'hol' : '';
    h += `<div class="h ${lv} ${d === td ? 'now' : ''}" title="${d}">${k}${!fut && r && r.done && r.done.lift ? '<i class="lift"></i>' : ''}</div>`;
  }
  return `<div class="cal-h"><button class="gbtn" data-cal="-1" aria-label="上个月" ${ym <= minYm ? 'disabled' : ''}>${I.left}</button><b>${y} 年 ${m} 月</b><button class="gbtn" data-cal="1" aria-label="下个月" ${ym >= maxYm ? 'disabled' : ''}>${I.right}</button></div>
    <div class="heat" id="cal">${h}</div><div class="cal-sum"><span>达标 <b class="num">${good}</b> 天</span><span>力训 <b class="num">${lifts}</b> 次</span><span>记饮食 <b class="num">${meals}</b> 天</span></div>`;
}
function shiftMonth(dir) {
  const td = today(), ym = calMonth || td.slice(0, 7), [y, m] = ym.split('-').map(Number), dt = new Date(y, m - 1 + dir, 1);
  const nym = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
  if (nym < S.profile.startDate.slice(0, 7) || nym > td.slice(0, 7)) return false;
  calMonth = nym; return true;
}
/* ---------- 奖章：铜 / 银 / 金 / 白金四档金属色的徽章，没拿到的是浅灰底 + 进度环 ---------- */
const TIER = { 1: '铜', 2: '银', 3: '金', 4: '白金' };
const MEDAL_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${[
  [1, '#F3CDA6', '#B97A45'], [2, '#F4F6F9', '#A2ABB7'], [3, '#FCE7A6', '#CC962C'], [4, '#6B7380', '#1B1F25']].map(([t, a, b]) =>
  `<linearGradient id="md${t}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><linearGradient id="mf${t}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('')}</defs></svg>`;
// 外圈是 20 个齿的花边（像奖章的边），里面一个圆面放图标
const ROSETTE = (() => { const pts = []; for (let i = 0; i < 40; i++) { const a = Math.PI * i / 20 - Math.PI / 2, r = i % 2 ? 28.2 : 30.5; pts.push(`${(32 + r * Math.cos(a)).toFixed(2)},${(32 + r * Math.sin(a)).toFixed(2)}`); } return pts.join(' '); })();
const STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z"/></svg>';
const TREND = up => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${up ? 'M4 17l6-6 4 4 6-7M15 8h5v5' : 'M4 7l6 6 4-4 6 7M15 16h5v-5'}"/></svg>`;
const FLAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4M6 4.5h11l-2.2 4 2.2 4H6"/></svg>';
const MICON = { first: STAR, streak: I.flame, perfect: STAR, lift: I.train, run: I.run, scale: I.scale, meal: I.food, down: TREND(false), up: TREND(true), target: FLAG };
function medalArt(b, big) {
  const C2 = 2 * Math.PI * 26, t = b.tier;
  return `<span class="md ${big ? 'big' : ''} t${t}"><svg viewBox="0 0 64 64" aria-hidden="true">
    <polygon points="${ROSETTE}" class="md-rim" ${b.got ? `style="fill:url(#md${t})"` : ''}/>
    <circle cx="32" cy="32" r="22.5" class="md-face" ${b.got ? `style="fill:url(#mf${t});stroke:rgba(255,255,255,.35)"` : ''}/>
    ${b.got ? '<ellipse cx="26" cy="22" rx="11" ry="6" fill="#fff" opacity=".22" transform="rotate(-25 26 22)"/>' : `<circle cx="32" cy="32" r="26" class="md-prog" stroke-dasharray="${(C2 * b.pct).toFixed(1)} ${C2.toFixed(1)}" transform="rotate(-90 32 32)"/>`}
  </svg><span class="md-ico">${MICON[b.kind] || STAR}</span></span>`;
}
const fmtProg = b => b.kind === 'target' ? '未到' : `${b.kind === 'down' || b.kind === 'up' || b.kind === 'run' ? Math.round(b.cur * 10) / 10 : Math.floor(b.cur)} / ${b.need}`;
function medalSheet(b) {
  C.sheet(`<div class="md-sheet ${b.got ? 'got' : ''}">${medalArt(b, true)}<h2>${esc(b.name)}</h2><div class="sheet-sub">${b.got ? TIER[b.tier] + '牌 · 已获得' : '还没获得'}</div>
    <p class="t-sub l2" style="text-align:center;margin:0">${esc(b.desc)}</p>
    ${b.got ? '' : `<div class="progress" style="width:100%"><i style="width:${Math.round(b.pct * 100)}%"></i></div><div class="t-foot l2">进度 ${fmtProg(b)}</div>`}</div>`);
}
function viewData() {
  const rows = energyRows(Math.max(7, rng.energy)).filter(r => !r.none), an = analysis(rows), t = totals(), lv = levelOf(t.points), bs = badges();
  let h = head('数据', null, `${S.plan.goal === 'cut' ? '减脂' : '增肌'} · 第 ${C.weekOf(today())} 周`);
  const cards = an.out.map((a, i) => ({ key: String(i), cls: '', html: `<div class="dc-kind" style="--k:${a.cls === 'warn' ? 'var(--orange)' : a.cls === 'ok' ? 'var(--green)' : 'var(--blue)'}"><span class="ico">${a.cls === 'warn' ? I.info : a.cls === 'ok' ? I.check : I.data}</span><span>洞察 ${i + 1}/${an.out.length}</span></div><div class="dc-title" style="font-size:24px">${esc(a.title)}</div><div class="dc-sub" style="font-size:16px;line-height:1.45">${esc(a.text)}</div>` }));
  const ordered = cards.slice(insightIdx % cards.length).concat(cards.slice(0, insightIdx % cards.length));
  h += `<section class="section"><div class="section-h"><h2>洞察</h2><span class="t-foot l2">左右滑看下一条</span></div>${Kit.deck('insDeck', ordered, '', { r: '下一条', l: '下一条' })}
    ${an.sum ? `<div class="deck-ctrl" style="grid-template-columns:1fr"><button class="pill glass" id="aiWeek">${I.sparkles}AI 分析</button></div>` : ''}${aiText ? `<section class="note mat" style="white-space:pre-wrap">${esc(aiText)}<div class="t-cap l3" style="margin-top:6px">AI 分析仅供参考 · ${esc(S.ai.model)}</div></section>` : ''}</section>`;
  h += `<section class="mat card">${rangeCtl('energy', '热量')}${energyChart(energyRows(rng.energy))}</section>`;
  // 身体数据：只记体重时和原来一样一张卡；多选了腰围等，就做成可以左右滑的卡组
  const ms = metricsOn();
  if (ms.length === 1) h += `<section class="mat card metric-card">${metricCard(ms[0], rng.m)}</section>`;
  else {
    const k = metricIdx % ms.length, ord = ms.slice(k).concat(ms.slice(0, k));
    h += `<section class="section"><div class="section-h"><h2>身体数据</h2><span class="t-foot l2">左右滑看下一项</span></div>${Kit.deck('mDeck', ord.map((m, i) => ({ key: m.id, cls: 'metric-card', html: metricCard(m, rng.m, `${(k + i) % ms.length + 1}/${ms.length}`) })), '', { r: '下一项', l: '上一项' })}</section>`;
  }
  h += `<section class="mat card"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="t-title3">坚持</span><span class="t-sub l2">${lv.name} · <span class="num">${t.points}</span> 能量</span></div>
    <div class="stat-grid"><div class="stat"><span class="k">连续达标</span><span class="v">${t.cur}<small>天</small></span></div><div class="stat"><span class="k">最长连续</span><span class="v">${t.best}<small>天</small></span></div>
    <div class="stat"><span class="k">累计力训</span><span class="v">${t.lifts}<small>次</small></span></div><div class="stat"><span class="k">记录饮食</span><span class="v">${t.meals}<small>餐</small></span></div></div>
    ${heat()}<div class="t-cap l3">颜色越深完成得越多，小点是练了力训；浅黄是节假日，不影响连续记录</div></section>`;
  const got = bs.filter(b => b.got).length;
  h += `<section class="mat card"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="t-title3">奖章</span><span class="t-sub l2 num">${got} / ${bs.length}</span></div>
    <div class="progress"><i style="width:${Math.round(got / bs.length * 100)}%"></i></div>${MEDAL_DEFS}<div class="medals">${bs.map((b, i) => `<button class="medal ${b.got ? 'got' : ''}" data-medal="${i}" aria-label="${esc(b.name)}，${b.got ? '已获得' : '还没获得'}">${medalArt(b)}<span class="mn">${esc(b.name)}</span><span class="mp">${b.got ? TIER[b.tier] : fmtProg(b)}</span></button>`).join('')}</div></section>`;
  return h;
}
function bindData() {
  Kit.bindDeck('insDeck', () => { insightIdx++; render(); }, () => { insightIdx++; render(); });
  const keep = fn => () => { const y = scrollY; fn(); render(); scrollTo(0, y); };
  $$('[data-rg] button').forEach(b => b.onclick = keep(() => { rng[b.parentElement.dataset.rg] = +b.dataset.v; Kit.haptic('light'); }));
  $$('[data-zoom]').forEach(b => b.onclick = keep(() => { const id = b.dataset.zoom; zoomOpen[id] = !zoomOpen[id]; Kit.haptic('light'); }));
  // 缩放滑块：拖动时只更新天数和曲线，松手再整页刷新
  $$('[data-rs]').forEach(sl => {
    const id = sl.dataset.rs;
    sl.oninput = () => { const v = +sl.value; $$(`[data-rv="${id}"]`).forEach(x => x.textContent = v + ' 天'); if (v !== rng[id]) { rng[id] = v; Kit.haptic('tick'); const card = sl.closest('.card,.dc'); const svg = card && card.querySelector('svg.chart'); if (svg) { const tmp = document.createElement('div'); tmp.innerHTML = id === 'energy' ? energyChart(energyRows(v)) : metricChart(metricsOn().find(m => m.id === (card.dataset.key || metricsOn()[metricIdx % metricsOn().length].id)) || metricsOn()[0], v); const ns = tmp.querySelector('svg.chart'); if (ns) svg.replaceWith(ns); } } };
    sl.onchange = keep(() => {});
  });
  const bs = badges();
  $$('[data-medal]').forEach(b => b.onclick = () => { Kit.haptic('light'); medalSheet(bs[+b.dataset.medal]); });
  // 日历：按钮或左右滑切换月份
  $$('[data-cal]').forEach(b => b.onclick = keep(() => { if (shiftMonth(+b.dataset.cal)) Kit.haptic('light'); }));
  const cal = $('#cal');
  if (cal) { let x0 = null; cal.addEventListener('pointerdown', e => { x0 = e.clientX; }); cal.addEventListener('pointerup', e => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50 && shiftMonth(dx < 0 ? 1 : -1)) { Kit.haptic('light'); keep(() => {})(); } }); }
  const ms = metricsOn();
  if (ms.length > 1) Kit.bindDeck('mDeck', () => { metricIdx++; render(); }, () => { metricIdx = (metricIdx + ms.length - 1) % ms.length; render(); });
  const ab = $('#aiWeek');
  if (ab) ab.onclick = async () => {
    if (!S.ai.key || !S.ai.model) { toast('先到“我的 → 大模型接口”设置'); return; }
    const rows = energyRows(Math.max(7, rng.energy)).filter(r => !r.none), an = analysis(rows);
    ab.disabled = true; ab.innerHTML = `${I.sparkles}分析中…`;
    try {
      aiText = await AI.analyzeWeek(S.ai, { 目标: S.plan.goal === 'cut' ? '减脂' : '增肌', 天数: an.L.length, ...an.sum, 最近体重: weights().slice(-14).map(x => ({ 日期: x.d, 体重kg: x.w })), 每日: rows.filter(r => r.logged).map(r => ({ 日期: r.d, 摄入: r.in, 消耗: r.out, 碳水: r.c, 蛋白质: r.p })) });
      Kit.haptic('success'); render();
    } catch (e) { toast(e.message); ab.disabled = false; ab.innerHTML = `${I.sparkles}AI 分析`; }
  };
}
window.Data = { view: viewData, bind: bindData };
})();
