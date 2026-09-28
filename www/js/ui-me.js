/* 我的：资料、计划、规则与出处、大模型、提醒、导入导出、更新 */
(() => {
const { APP_VERSION, REPO, E, $, $$, esc, today, DOW, src, LS, S, peek, tasksFor, dayInfo, toast, sheet, close, render } = C;

const DEF = {
  name: '', sex: 'M', age: '', height: '', weight: '', waist: '', targetWeight: '', bmrOverride: '', goal: 'auto', lift: true, level: 'new', place: 'gym', split: 'auto',
  parts: { chest: true, back: true, shoulder: true, arm: true, legs: true, abs: true }, focus: 'auto', femaleAbs: true,
  schedMode: 'weekly', liftDays: [0, 2, 4], skipHolidays: true, cardioSkipHolidays: false, liftTime: '18:00',
  cardio: [], cardioTime: '18:30', wake: '07:30', breakfast: '08:00', lunch: '12:00', dinner: '19:00', sleep: '23:30', sheet: 'auto',
  eggsMilk: true, budget: false, lunchCost: 30, gout: false, diabetes: false,
};
const back = `<button class="back" data-back>‹ 我的</button>`;

function viewMe() {
  if (S.sub && SUB[S.sub]) return SUB[S.sub].view();
  const p = S.profile, pl = S.plan;
  let h = `<div class="head"><h1>我的</h1></div>`;
  h += `<div class="card"><div class="profile-head"><div class="avatar">${esc((p.name || '我').slice(0, 1))}</div><div class="stack" style="gap:2px"><b>${esc(p.name || '我')}</b><span class="sm sub">${p.sex === 'M' ? '男' : '女'} · ${p.age} 岁 · ${p.height}cm · ${p.weight}kg · BMI ${pl.bmi.toFixed(1)}</span></div></div>
    <div class="stats3"><div class="stat"><span class="k">目标</span><span class="v" style="font-size:17px">${pl.goal === 'cut' ? '减脂' : '增肌'}</span></div><div class="stat"><span class="k">${pl.noLift ? '每天' : '力训日'}应吃</span><span class="v" style="font-size:17px">${pl.f1}</span></div><div class="stat"><span class="k">蛋白质</span><span class="v" style="font-size:17px">${pl.prot}<small>g</small></span></div></div></div>`;
  const aiLabel = S.ai.model ? esc(S.ai.model) : '未设置';
  const native = isNative();
  h += `<div class="menu"><button data-sub="plan"><span>我的计划</span><span class="mv">${esc(pl.sheet.name)}${pl.training ? ' · ' + esc(pl.training.splitName.replace('健身房', '')) : ''}</span></button>
    <button data-sub="rules"><span>规则与出处</span><span class="mv">Excel 表号和单元格</span></button></div>`;
  h += `<div class="menu"><button data-sub="profile"><span>编辑资料</span><span class="mv">身高体重、训练、作息</span></button>
    <button data-sub="profile"><span>基础代谢</span><span class="mv">${pl.bmr} kcal${pl.bmrManual ? '（手动）' : '（公式）'}</span></button>
    <button data-sub="ai"><span>大模型接口</span><span class="mv">${aiLabel}</span></button>
    <label class="mi switch"><span>按时间线提醒${native ? '' : '<br><span class="xs sub">只在安卓 App 里有效</span>'}</span><input type="checkbox" id="nt-on" ${S.notify.on ? 'checked' : ''} ${native ? '' : 'disabled'}></label>
    <button data-sub="holiday"><span>节假日数据</span><span class="mv">${Object.keys(Object.assign({}, window.HOLIDAYS_BUNDLED, S.holidays)).length} 天</span></button></div>`;
  h += `<div class="menu"><button data-sub="export"><span>导出数据</span><span class="mv"></span></button><button data-sub="import"><span>导入数据</span><span class="mv"></span></button></div>`;
  h += `<div class="menu"><button id="up-check"><span>检查更新</span><span class="mv" id="up-msg">版本 ${APP_VERSION}</span></button><button data-sub="about"><span>关于与致谢</span><span class="mv"></span></button></div>`;
  return h;
}
function bindMe() {
  if (S.sub && SUB[S.sub]) { $$('[data-back]').forEach(b => b.onclick = () => { S.sub = null; render(); scrollTo(0, 0); }); return SUB[S.sub].bind && SUB[S.sub].bind(); }
  $$('[data-sub]').forEach(b => b.onclick = () => { S.sub = b.dataset.sub; render(); scrollTo(0, 0); });
  const nt = $('#nt-on'); if (nt) nt.onchange = async () => { S.notify.on = nt.checked; LS.set('notify', S.notify); if (nt.checked) { const ok = await scheduleNotifs(true); if (!ok) { S.notify.on = false; LS.set('notify', S.notify); nt.checked = false; } } else cancelNotifs(); };
  $('#up-check').onclick = checkUpdate;
}

/* ---------- 资料表单 ---------- */
const CARDIO_KINDS = ['无', '跑步', ...window.CARDIO.filter(c => !c.run).map(c => c.label)];
function profileForm(first) {
  const p = Object.assign({}, DEF, S.profile || {}); p.parts = Object.assign({}, DEF.parts, p.parts || {});
  const sel = (id, opts, v) => `<select class="in" id="f-${id}">${opts.map(([k, t]) => `<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const num = (id, v, ph) => `<input class="in num" id="f-${id}" value="${esc(v)}" placeholder="${esc(ph)}" inputmode="decimal">`;
  const time = (id, v) => `<input class="in" type="time" id="f-${id}" value="${esc(v)}">`;
  const dows = (id, arr, cls) => `<div class="dows ${cls || ''}" data-dows="${id}">${DOW.map((x, i) => `<button type="button" data-i="${i}" aria-pressed="${(arr || []).includes(i)}">${x}</button>`).join('')}</div>`;
  const tog = (id, on, label) => `<label class="switch">${label}<input type="checkbox" id="f-${id}" ${on ? 'checked' : ''}></label>`;
  const formula = p.weight && p.height && p.age ? Math.round(p.weight * 9.99 + p.height * 6.25 - p.age * 4.92 + (p.sex === 'M' ? 5 : -161)) : '';
  const cardio = [0, 1, 2].map(i => { const a = p.cardio[i] || { kind: '无', minutes: 45, pace: 8, days: [] };
    return `<div class="stack" style="${i ? 'border-top:1px solid var(--line);padding-top:12px' : ''}"><div class="fgrid"><div class="field"><label>有氧 ${i + 1}</label><select class="in" data-c="${i}|kind">${CARDIO_KINDS.map(k => `<option ${a.kind === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
      <div class="field"><label>每次分钟</label><input class="in num" data-c="${i}|minutes" value="${esc(a.minutes)}" inputmode="numeric"></div>
      <div class="field"><label>跑步配速 分/公里</label><input class="in num" data-c="${i}|pace" value="${esc(a.pace || '')}" placeholder="8" inputmode="decimal"></div>
      <div class="field"><label>运动/静息心率（可选）</label><div class="row" style="flex-wrap:nowrap;gap:6px"><input class="in num" data-c="${i}|hr" value="${esc(a.hr || '')}" placeholder="130" inputmode="numeric"><input class="in num" data-c="${i}|rhr" value="${esc(a.rhr || '')}" placeholder="65" inputmode="numeric"></div></div></div>${dows('cd' + i, a.days, 'cardio')}</div>`; }).join('');
  const sheets = [['auto', '按训练时间自动选']].concat(Object.entries(E.SHEETS).map(([k, v]) => [k, `${v.name}（${v.cut}/${v.bulk}）`]));
  return `<form class="form" id="pform">
  <div class="group"><h3>身体</h3><div class="fgrid">
    <div class="field"><label for="f-name">昵称</label><input class="in" id="f-name" value="${esc(p.name)}" placeholder="可不填"></div>
    <div class="field"><label for="f-sex">性别</label>${sel('sex', [['M', '男'], ['F', '女']], p.sex)}</div>
    <div class="field"><label for="f-age">年龄</label>${num('age', p.age, '24')}</div><div class="field"><label for="f-height">身高 cm</label>${num('height', p.height, '172')}</div>
    <div class="field"><label for="f-weight">体重 kg</label>${num('weight', p.weight, '80')}</div><div class="field"><label for="f-waist">空腹腰围 cm</label>${num('waist', p.waist, '可选')}</div>
    <div class="field"><label for="f-targetWeight">目标体重 kg</label>${num('targetWeight', p.targetWeight, '可选')}</div>
    <div class="field"><label for="f-bmrOverride">基础代谢 kcal</label>${num('bmrOverride', p.bmrOverride, formula ? `留空按公式：${formula}` : '留空按公式计算')}</div>
    <div class="field" style="grid-column:1/-1"><label for="f-goal">目标</label>${sel('goal', [['auto', '按 BMI 和腰围自动判断'], ['cut', '减脂'], ['bulk', '增肌']], p.goal)}</div></div>
    ${tog('gout', p.gout, '高尿酸 / 痛风')}${tog('diabetes', p.diabetes, '胰岛素抵抗 / 二型糖尿病')}</div>
  <div class="group"><h3>力量训练</h3>${tog('lift', p.lift !== false, '做力量训练')}
    <div class="fgrid"><div class="field"><label for="f-level">经验</label>${sel('level', [['new', '新手'], ['some', '有基础'], ['vet', '老手']], p.level)}</div>
    <div class="field"><label for="f-place">地点</label>${sel('place', [['gym', '健身房'], ['home', '家里']], p.place)}</div>
    <div class="field"><label for="f-split">分化</label>${sel('split', [['auto', '自动'], ['three', '三分化（表21）'], ['four_sh', '四分化·肩（表22）'], ['four_arm', '四分化·手臂（表23）'], ['home', '居家（表24）']], p.split)}</div>
    <div class="field"><label for="f-liftTime">开始时间</label>${time('liftTime', p.liftTime)}</div>
    <div class="field" style="grid-column:1/-1"><label for="f-schedMode">训练日</label>${sel('schedMode', [['weekly', '固定星期几'], ['workdays', '所有工作日（含调休补班）'], ['free', '不固定，每天自己决定']], p.schedMode)}</div></div>
    ${dows('liftDays', p.liftDays)}
    <div class="field"><label>想练的部位</label><div class="pills">${window.PARTS.map(pt => `<button type="button" data-part="${pt.id}" aria-pressed="${p.parts[pt.id] !== false}">${pt.name}</button>`).join('')}</div></div>
    <div class="field"><label for="f-focus">四分化重点</label>${sel('focus', [['auto', '肩'], ['arm', '手臂']], p.focus)}</div>
    ${tog('skipHolidays', p.skipHolidays !== false, '法定节假日自动跳过力训')}${tog('cardioSkipHolidays', p.cardioSkipHolidays, '有氧也在节假日跳过')}</div>
  <div class="group"><h3>有氧</h3>${cardio}<div class="field"><label for="f-cardioTime">有氧开始时间（非力训日）</label>${time('cardioTime', p.cardioTime)}</div></div>
  <div class="group"><h3>作息和吃饭</h3><div class="fgrid">
    <div class="field"><label for="f-wake">起床</label>${time('wake', p.wake)}</div><div class="field"><label for="f-breakfast">早饭</label>${time('breakfast', p.breakfast)}</div>
    <div class="field"><label for="f-lunch">午饭</label>${time('lunch', p.lunch)}</div><div class="field"><label for="f-dinner">晚饭</label>${time('dinner', p.dinner)}</div>
    <div class="field"><label for="f-sleep">睡觉</label>${time('sleep', p.sleep)}</div><div class="field"><label for="f-lunchCost">午饭价格 元</label>${num('lunchCost', p.lunchCost, '30')}</div>
    <div class="field" style="grid-column:1/-1"><label for="f-sheet">饮食表</label>${sel('sheet', sheets, p.sheet)}</div></div>
    ${tog('eggsMilk', p.eggsMilk !== false, '早饭能吃鸡蛋和牛奶')}${tog('budget', p.budget, '省钱模式：午饭自助多吃，晚饭馒头鸡蛋')}</div>
  <button class="btn primary block" type="submit">${first ? '生成我的计划' : '保存'}</button><p class="err" id="ferr" role="alert"></p></form>`;
}
function bindProfile(first) {
  $$('[data-dows] button').forEach(b => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'));
  $$('[data-part]').forEach(b => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'));
  const imp = $('#importFirst'); if (imp) imp.onclick = () => { S.sub = 'import'; S.firstImport = true; render(); };
  $('#pform').onsubmit = e => {
    e.preventDefault();
    const v = id => $('#f-' + id).value.trim(), ck = id => $('#f-' + id).checked;
    const days = id => $$(`[data-dows="${id}"] button`).filter(b => b.getAttribute('aria-pressed') === 'true').map(b => +b.dataset.i);
    const parts = {}; $$('[data-part]').forEach(b => parts[b.dataset.part] = b.getAttribute('aria-pressed') === 'true');
    const cardio = [0, 1, 2].map(i => { const g = f => ($(`[data-c="${i}|${f}"]`) || {}).value; return { kind: g('kind'), minutes: +g('minutes') || 0, pace: +g('pace') || 8, hr: +g('hr') || '', rhr: +g('rhr') || '', days: days('cd' + i) }; }).filter(a => a.kind !== '无' && a.minutes > 0 && a.days.length);
    const p = Object.assign({}, S.profile || {}, {
      name: v('name'), sex: v('sex'), age: +v('age'), height: +v('height'), weight: +v('weight'), waist: +v('waist') || '', targetWeight: +v('targetWeight') || '', bmrOverride: +v('bmrOverride') || '',
      goal: v('goal'), gout: ck('gout'), diabetes: ck('diabetes'), lift: ck('lift'), level: v('level'), place: v('place'), split: v('split'), focus: v('focus'),
      liftTime: v('liftTime'), schedMode: v('schedMode'), liftDays: days('liftDays'), skipHolidays: ck('skipHolidays'), cardioSkipHolidays: ck('cardioSkipHolidays'), parts, cardio, cardioTime: v('cardioTime'),
      wake: v('wake'), breakfast: v('breakfast'), lunch: v('lunch'), dinner: v('dinner'), sleep: v('sleep'), lunchCost: +v('lunchCost') || 30, sheet: v('sheet'), eggsMilk: ck('eggsMilk'), budget: ck('budget'),
    });
    const errs = [];
    if (!(p.age >= 14 && p.age <= 80)) errs.push('年龄'); if (!(p.height >= 130 && p.height <= 220)) errs.push('身高'); if (!(p.weight >= 35 && p.weight <= 200)) errs.push('体重');
    if (p.bmrOverride && !(p.bmrOverride >= 800 && p.bmrOverride <= 4000)) errs.push('基础代谢（800-4000）');
    if (p.lift && p.schedMode === 'weekly' && !p.liftDays.length) errs.push('至少选一天力训');
    if (p.lift && !Object.values(parts).some(Boolean)) errs.push('至少选一个部位');
    if (p.goal === 'bulk' && !p.lift) errs.push('增肌必须做力训（表13 E24）');
    if (errs.length) { $('#ferr').textContent = '请检查：' + errs.join('、'); return; }
    p.startDate = p.startDate || today(); p.startWeight = p.startWeight || p.weight;
    S.profile = p; LS.set('profile', p); S.plan = E.build(p);
    toast(first ? '计划已生成' : '已保存，计划已更新');
    S.sub = null; S.tab = first ? 'today' : 'me'; render(); scrollTo(0, 0); scheduleNotifs();
  };
}

/* ---------- 我的计划（简要） ---------- */
function viewPlan() {
  const p = S.profile, pl = S.plan;
  const meals = pl.noLift ? pl.meals.rest : pl.meals[S.planDay || 'lift'];
  let h = back + `<div class="head"><h1>我的计划</h1></div>`;
  h += `<div class="card"><div class="stats3"><div class="stat"><span class="k">目标</span><span class="v" style="font-size:17px">${pl.goal === 'cut' ? '减脂' : '增肌'}</span></div><div class="stat"><span class="k">基础代谢</span><span class="v" style="font-size:17px">${pl.bmr}</span></div><div class="stat"><span class="k">脂肪</span><span class="v" style="font-size:17px">${pl.fat}<small>g</small></span></div></div>
    <div class="tbl"><table><thead><tr><th></th><th class="n">${pl.noLift ? '每天' : '力训日'}</th>${pl.noLift ? '' : '<th class="n">休息日</th>'}</tr></thead><tbody>
    <tr><td>应吃热量</td><td class="n">${pl.f1}</td>${pl.noLift ? '' : `<td class="n">${pl.f2}</td>`}</tr><tr><td>碳水 g</td><td class="n">${pl.carbT}</td>${pl.noLift ? '' : `<td class="n">${pl.carbR}</td>`}</tr><tr><td>蛋白质 g</td><td class="n">${pl.prot}</td>${pl.noLift ? '' : `<td class="n">${pl.prot}</td>`}</tr></tbody></table></div>
    <p class="sm sub">${esc(pl.goalWhy.reason)}</p></div>`;
  h += `<div class="card"><div class="row between"><h2 style="font-size:17px">${esc(pl.sheet.sheet)} ${esc(pl.sheet.name)}</h2>${pl.noLift ? '' : `<div class="seg" style="width:150px"><button data-pd="lift" aria-pressed="${(S.planDay || 'lift') === 'lift'}">力训日</button><button data-pd="rest" aria-pressed="${S.planDay === 'rest'}">休息日</button></div>`}</div>
    ${meals.map(m => `<div class="food-item"><span class="stack" style="gap:0"><span class="fn">${esc(m.name)} <span class="xs faint num">${m.time}</span></span><span class="fm">${esc(m.foods.c[0] || '')}${m.foods.c[0] && m.foods.p[0] ? '；' : ''}${esc(m.foods.p[0] || '')}</span></span><span class="fk sm">${m.c}/${m.p}</span></div>`).join('')}
    <p class="xs faint">右边数字：碳水 g / 蛋白质 g</p></div>`;
  if (pl.training) h += `<div class="card"><h2 style="font-size:17px">${esc(pl.training.splitName)} · 每周 ${pl.perWeek} 次</h2>${pl.training.days.map((d, i) => `<div class="food-item"><span class="stack" style="gap:0"><span class="fn">Day${i + 1} ${esc(d.name)}</span><span class="fm">${d.groups.map(g => esc(g.name)).join('、')}</span></span></div>`).join('')}</div>`;
  h += `<div class="card"><h2 style="font-size:17px">未来两周</h2>${calendar()}</div>`;
  if (pl.warnings.length) h += `<div class="card">${pl.warnings.map(w => `<div class="note warn sm">${esc(w.text)}</div>`).join('')}</div>`;
  return h;
}
function calendar() {
  const td = today(); const start = E.addDays(td, -E.dow(td));
  let h = '<div class="heat">' + DOW.map(x => `<div class="hd">${x}</div>`).join('');
  for (let i = 0; i < 14; i++) {
    const d = E.addDays(start, i), info = dayInfo(d);
    const lab = info.type === 'lift' ? '练' : info.type === 'cardio' ? '氧' : info.type === 'holiday' ? '假' : (info.h && !info.h.off ? '班' : '休');
    const bg = { lift: 'var(--train-soft)', cardio: 'var(--cardio-soft)', holiday: 'var(--warn-soft)', rest: 'var(--fill)' }[info.type];
    h += `<div class="h" style="background:${bg};${d === td ? 'outline:2px solid var(--ink);' : ''}display:grid;gap:0;line-height:1.2"><b style="color:var(--ink)">${E.pd(d).getDate()}</b>${lab}</div>`;
  }
  return h + '</div><p class="xs faint">练：力训 · 氧：有氧 · 假：法定节假日 · 班：调休上班</p>';
}

/* ---------- 规则与出处（完整） ---------- */
function viewRules() {
  const p = S.profile, pl = S.plan, R = window.RULES;
  const row = (a, b, c, s, app) => `<tr><td>${a}<br>${src(s, app)}</td><td class="n">${b}</td>${pl.noLift ? '' : `<td class="n">${c}</td>`}</tr>`;
  let h = back + `<div class="head"><h1>规则与出处</h1></div><p class="sm sub">全部规则来自${esc(window.SRC_BOOK)}。灰色标签是表号和单元格，橙色标签是 Excel 没给具体数值、本应用补充的做法。</p>`;
  h += `<div class="card"><h2 style="font-size:17px">1. 目标</h2><p class="sm">${esc(pl.goalWhy.reason)} ${src(pl.goalWhy.src)}</p><p class="xs sub">${esc(R.noRecomp.text)} ${src(R.noRecomp.src)}</p></div>`;
  h += `<div class="card"><h2 style="font-size:17px">2. 热量与营养素</h2><div class="tbl"><table><thead><tr><th>步骤</th><th class="n">${pl.noLift ? '每天' : '力训日'}</th>${pl.noLift ? '' : '<th class="n">休息日</th>'}</tr></thead><tbody>
    ${row('基础代谢' + (pl.bmrManual ? `（手动，公式为 ${pl.bmrFormula}）` : ''), pl.bmr, pl.bmr, pl.bmrManual ? '用户手动输入' : R.bmr.src, pl.bmrManual)}
    ${row('无运动总消耗 ÷0.7', pl.b, pl.b, R.noExercise.src)}${row('力训消耗', pl.noLift ? '—' : '+' + pl.c, '—', R.liftBurn.src)}
    ${row('有氧（每周÷7）', '+' + pl.d, '+' + pl.d, R.cardioBurn.src)}${row('平衡热量', pl.e1, pl.e2, R.balance.src)}
    ${row(`应吃热量 ×${pl.factor}`, pl.f1, pl.f2, pl.goal === 'cut' ? R.cutFactor.src : R.bulkFactor.src)}${row('脂肪', pl.fat + 'g', pl.fat + 'g', R.fat.src)}
    ${row('蛋白质', `${pl.prot}g<br><span class="xs sub">${pl.qP}/kg</span>`, pl.prot + 'g', R.split.src)}${row('碳水', `${pl.carbT}g<br><span class="xs sub">${pl.qT}/kg</span>`, `${pl.carbR}g<br><span class="xs sub">${pl.qR}/kg</span>`, R.split.src + '，' + R.quota.src)}</tbody></table></div>
    ${pl.notes.map(n => `<p class="sm">${esc(n.text)} ${src(n.src)}</p>`).join('')}</div>`;
  h += `<div class="card"><h2 style="font-size:17px">3. 饮食表与分餐</h2><p class="sm">${esc(pl.sheet.sheet)}《${pl.goal === 'cut' ? '减脂' : '增肌'}-${esc(pl.sheet.name)}》：${esc(pl.sheet.how)} ${src(R.meals.src)} ${pl.noLift ? '' : src('按练前 2 小时内是否吃过正餐判断', 1)}</p>
    <p class="sm">每餐分多少 ${src('应用补充', 1)}：原表数值格子为空，按原表规则分配——练后餐最大（C12）、练前餐只垫碳水（I44）、零食只留 10% 碳水（E58）、早饭鸡蛋牛奶（J31）${p.budget ? '；省钱模式把肉和饭集中到自助午饭（参考表20 价格）' : ''}</p>
    ${['fatRule', 'veg', 'fruit', 'breakfast', 'preMeal', 'postMeal', 'snack', 'canteen', 'leanShort', 'alcohol'].concat(pl.goal === 'bulk' ? ['bulkNuts'] : []).map(k => `<p class="sm">${esc(R[k].text)} ${src(R[k].src)}</p>`).join('')}</div>`;
  const cw = pl.cardio;
  h += `<div class="card"><h2 style="font-size:17px">4. 有氧</h2>${cw.items.map(a => `<p class="sm">${esc(a.kind)} ${a.minutes} 分钟：每次约 ${a.perSession} kcal，每周 ${a.n} 次 ${src(a.src)}</p>`).join('') || '<p class="sm sub">没有设置有氧</p>'}
    ${['cardioAdvice', 'cardioHobby', 'cardioTiming', 'cardioHR', 'cardioSwap'].map(k => `<p class="sm">${esc(R[k].text)} ${src(R[k].src)}</p>`).join('')}</div>`;
  if (pl.training) {
    const tr = pl.training;
    h += `<div class="card"><h2 style="font-size:17px">5. 训练：${esc(tr.splitName)}</h2><p class="sm">${esc(tr.split.why)} ${src(tr.split.src)}</p>
      ${tr.days.map((d, i) => `<div class="stack" style="gap:4px"><b class="sm">Day${i + 1} ${esc(d.name)} ${src(d.src)}</b>${d.groups.map(g => `<div class="sm"><b>${esc(g.name)}</b> <span class="sub">${esc(g.text)}</span> ${src(g.src)}${g.movedNote ? src('不练腿，腹移到这天', 1) : ''}</div>`).join('')}</div>`).join('')}
      ${['freq', 'volume', 'rest', 'load', 'failure', 'legRotate', 'abs', 'chestExtra', 'oneRM'].concat(p.sex === 'F' ? ['female'] : []).map(k => `<p class="sm">${esc(R[k].text)} ${src(R[k].src)}</p>`).join('')}
      <p class="sm">新手前 4 周组数取下限、第 1-2 周用 12-15 次；每个动作不超过 4 组；新手先排器械动作；有基础者下胸隔次做；加重节奏用双进阶 ${src('应用补充', 1)}</p></div>`;
  }
  h += `<div class="card"><h2 style="font-size:17px">6. 调整与停止</h2>${['cutSpeed', 'cutAdjust', 'cut10kg', 'cutStop', 'bulkSpeed', 'bulkAdjust', 'bulkStop', 'scale', 'diabetes', 'gout'].map(k => `<p class="sm">${esc(R[k].text)} ${src(R[k].src)}</p>`).join('')}
    <p class="sm">热量分析里的“每周体重变化”按 1kg 脂肪约 7700 kcal 估算 ${src('应用补充', 1)}</p></div>`;
  h += `<p class="xs faint" style="text-align:center">完整算法说明见仓库 ALGORITHM.md</p>`;
  return h;
}

/* ---------- 大模型接口 ---------- */
function viewAI() {
  const ai = S.ai;
  return back + `<div class="head"><h1>大模型接口</h1></div><p class="sm sub">用于拍照、相册、文字估算饮食和热量分析。Key 只保存在这台手机上。</p>
  <div class="group"><div class="field"><label for="ai-preset">服务商</label><select class="in" id="ai-preset">${AI.PRESETS.map(x => `<option value="${x.id}" ${ai.preset === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="ai-base">接口地址</label><input class="in" id="ai-base" value="${esc(ai.base)}" placeholder="https://…/v1"></div>
    <div class="field"><label for="ai-key">API Key</label><input class="in" id="ai-key" type="password" value="${esc(ai.key)}" autocomplete="off"></div>
    <button class="btn ghost block" id="ai-scan">扫描可用模型</button><p class="xs sub" id="ai-msg"></p>
    <div class="field"><label for="ai-model">模型（带“图”的能看照片）</label><select class="in" id="ai-model">${(ai.models || []).map(m => `<option value="${esc(m.id)}" ${ai.model === m.id ? 'selected' : ''}>${esc(m.id)}${m.vision ? '（图）' : ''}</option>`).join('')}${ai.model && !(ai.models || []).some(m => m.id === ai.model) ? `<option selected>${esc(ai.model)}</option>` : ''}</select></div>
    <div class="field"><label for="ai-manual">或手动填模型 ID</label><input class="in" id="ai-manual" placeholder="例如 qwen3-vl-plus"></div>
    <button class="btn primary block" id="ai-save">保存</button></div>
  <details class="card"><summary class="sm"><b>内置的饮食识别提示词</b></summary><pre class="xs sub" style="white-space:pre-wrap;margin:0">${esc(AI.systemPrompt())}</pre></details>`;
}
function bindAI() {
  $('#ai-preset').onchange = () => { const pr = AI.PRESETS.find(x => x.id === $('#ai-preset').value); if (pr.base) $('#ai-base').value = pr.base; };
  const collect = () => { const pr = AI.PRESETS.find(x => x.id === $('#ai-preset').value); return { ...S.ai, preset: pr.id, type: pr.type, base: $('#ai-base').value.trim(), key: $('#ai-key').value.trim() }; };
  $('#ai-scan').onclick = async () => {
    const cfg = collect(); $('#ai-msg').textContent = '扫描中…';
    try { const models = await AI.listModels(cfg); S.ai = { ...cfg, models, model: S.ai.model && models.some(m => m.id === S.ai.model) ? S.ai.model : AI.defaultModel(cfg, models) }; LS.set('ai', S.ai); render(); toast(`找到 ${models.length} 个模型，已选 ${S.ai.model}`); }
    catch (e) { $('#ai-msg').textContent = e.message; }
  };
  $('#ai-save').onclick = () => { const cfg = collect(); const man = $('#ai-manual').value.trim(); S.ai = { ...cfg, model: man || ($('#ai-model') || {}).value || S.ai.model }; LS.set('ai', S.ai); toast('已保存'); S.sub = null; render(); };
}

/* ---------- 导出 / 导入 ---------- */
function viewExport() {
  return back + `<div class="head"><h1>导出数据</h1></div><p class="sm sub">导出资料、打卡、训练和饮食记录，用来备份或换手机。</p>
  <div class="group">${`<label class="switch">包含大模型接口信息<br><span class="xs sub">含接口地址和 API Key，不要发给别人</span><input type="checkbox" id="ex-ai"></label>`}
    <button class="btn primary block" id="ex-file">导出为文件</button><button class="btn ghost block" id="ex-copy">复制到剪贴板</button></div>
  <p class="xs faint">安卓上“导出为文件”会打开系统分享，可以存到文件管理、网盘或发给自己的微信。</p>`;
}
function backupText(withAI) {
  const data = LS.all();
  if (!withAI) delete data['lcd:ai'];
  const days = Object.keys(data).filter(k => k.startsWith('lcd:m:')).reduce((s, k) => { try { return s + Object.keys(JSON.parse(data[k])).length; } catch (e) { return s; } }, 0);
  return { text: JSON.stringify({ app: 'lianchi-daily', version: APP_VERSION, at: new Date().toISOString(), includesAI: !!withAI, days, data }), days };
}
function bindExport() {
  $('#ex-copy').onclick = async () => { const { text } = backupText($('#ex-ai').checked); try { await navigator.clipboard.writeText(text); toast('已复制'); } catch (e) { sheet(`<h2>复制下面内容</h2><textarea class="in num" style="min-height:220px;font-size:11px">${esc(text)}</textarea>`); } };
  $('#ex-file').onclick = async () => {
    const withAI = $('#ex-ai').checked, { text, days } = backupText(withAI);
    const name = `练吃日课备份-${today()}${withAI ? '-含模型' : ''}.json`;
    try {
      if (isNative() && window.capacitorFilesystemPluginCapacitor && window.capacitorShare) {
        const FS = window.capacitorFilesystemPluginCapacitor.Filesystem, SH = window.capacitorShare.Share;
        const res = await FS.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
        await SH.share({ title: name, files: [res.uri], dialogTitle: '保存或发送备份' });
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      }
      toast(`已导出 ${days} 天记录`);
    } catch (e) { if (!/cancel/i.test(e.message || '')) toast('导出失败：' + (e.message || e)); }
  };
}
function viewImport() {
  return (S.firstImport ? '<button class="back" data-back>‹ 返回</button>' : back) + `<div class="head"><h1>导入数据</h1></div><p class="sm sub">选择之前导出的备份文件，或粘贴备份内容。导入会覆盖这台手机上的同名数据。</p>
  <div class="group"><button class="btn primary block" id="im-file">选择备份文件</button><input type="file" id="im-input" accept=".json,application/json,text/plain" hidden>
    <div class="field"><label for="im-text">或粘贴内容</label><textarea class="in num" id="im-text" style="font-size:12px"></textarea></div>
    <label class="switch">导入备份里的大模型接口<input type="checkbox" id="im-ai" checked></label>
    <button class="btn ghost block" id="im-ok">导入粘贴的内容</button><p class="err" id="im-err"></p></div>`;
}
function doImport(text) {
  try {
    const obj = JSON.parse(text);
    if (!obj || obj.app !== 'lianchi-daily' || !obj.data) throw new Error('不是练吃日课的备份文件');
    const keepAI = $('#im-ai').checked;
    const entries = Object.entries(obj.data).filter(([k]) => k.startsWith('lcd:') && (keepAI || k !== 'lcd:ai'));
    sheet(`<h2>确认导入</h2><p class="sm">备份时间：${esc((obj.at || '').slice(0, 16).replace('T', ' '))}，${obj.days || '若干'} 天记录${obj.includesAI ? '，含大模型接口' : ''}。导入会覆盖这台手机上的同名数据。</p><button class="btn primary block" id="im-go">导入</button><button class="btn ghost block" id="im-x">取消</button>`, () => {
      $('#im-x').onclick = close;
      $('#im-go').onclick = () => { entries.forEach(([k, v]) => localStorage.setItem(k, v)); location.reload(); };
    });
  } catch (e) { $('#im-err').textContent = '导入失败：' + e.message; }
}
function bindImport() {
  if (S.firstImport) $$('[data-back]').forEach(b => b.onclick = () => { S.sub = null; S.firstImport = false; render(); });
  $('#im-file').onclick = () => $('#im-input').click();
  $('#im-input').onchange = () => { const f = $('#im-input').files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => doImport(String(rd.result)); rd.readAsText(f); };
  $('#im-ok').onclick = () => doImport($('#im-text').value);
}

/* ---------- 节假日、关于 ---------- */
function viewHoliday() {
  const all = Object.assign({}, window.HOLIDAYS_BUNDLED, S.holidays);
  const up = Object.entries(all).filter(([d]) => d >= today()).sort().slice(0, 12);
  return back + `<div class="head"><h1>节假日数据</h1></div><div class="card"><p class="sm">数据来自国务院办公厅通知（holiday-cn 整理）。每年 11 月前后公布下一年安排，公布后点下面更新。</p>
    ${up.map(([d, [n, off]]) => `<div class="food-item"><span class="fn sm">${d} ${esc(n)}</span><span class="tag ${off ? 'warn' : 'train'}">${off ? '放假' : '补班'}</span></div>`).join('') || '<p class="sm sub">暂无后续安排</p>'}
    <button class="btn ghost block" id="hd-up">联网更新</button></div>`;
}
async function updateHolidays() {
  const y = new Date().getFullYear(); let n = 0;
  for (const year of [y, y + 1]) for (const base of ['https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/', 'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/']) {
    try { const res = await fetch(base + year + '.json'); if (!res.ok) continue; const d = await res.json(); (d.days || []).forEach(x => { S.holidays[x.date] = [x.name, x.isOffDay]; n++; }); break; } catch (e) { /* 换地址 */ }
  }
  LS.set('holidays', S.holidays); toast(n ? `已更新 ${n} 天` : '没有获取到数据，请检查网络'); render();
}
function viewAbout() {
  return back + `<div class="head"><h1>关于</h1></div><div class="card sm">
    <p>饮食和训练规则：${esc(window.SRC_BOOK)}。配套讲解：B站 BV1zu4m1N76R（饮食）、BV1Hk4y187jF（训练）。</p>
    <p>动作图片：free-exercise-db（公有领域）。节假日：holiday-cn。打包：Capacitor。</p>
    <p>源代码：github.com/${REPO}</p><p class="sub">个人学习工具，不能代替医生建议。训练中头晕、胸闷或关节疼痛，请停止并就医。</p></div>`;
}

/* ---------- 提醒 ---------- */
function isNative() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
function LN() { return window.capacitorLocalNotifications && window.capacitorLocalNotifications.LocalNotifications; }
async function cancelNotifs() { const ln = LN(); if (!ln || !isNative()) return; try { const p = await ln.getPending(); if (p.notifications.length) await ln.cancel({ notifications: p.notifications.map(n => ({ id: n.id })) }); } catch (e) { /* 忽略 */ } }
async function scheduleNotifs(ask) {
  const ln = LN(); if (!ln || !isNative() || !S.profile) return false;
  if (!S.notify.on && !ask) return false;
  try {
    let perm = await ln.checkPermissions();
    if (perm.display !== 'granted') { if (!ask) return false; perm = await ln.requestPermissions(); }
    if (perm.display !== 'granted') { toast('没有通知权限'); return false; }
    await cancelNotifs();
    const now = Date.now(), list = [];
    for (let i = 0; i < 7; i++) {
      const d = E.addDays(today(), i), { tasks } = tasksFor(d), r = peek(d) || { done: {} };
      tasks.forEach((t, k) => {
        if (t.optional || (r.done && r.done[t.id])) return;
        const [hh, mm] = t.time.split(':').map(Number); const at = E.pd(d); at.setHours(hh, mm, 0, 0);
        if (E.tm(t.time) < E.tm(S.profile.wake) - 60) at.setDate(at.getDate() + 1);
        if (at.getTime() <= now + 30000) return;
        list.push({ id: (i + 1) * 100 + k, title: `${t.time} ${t.title}`, body: String(t.kind === 'food' && t.meal ? `${t.meal.foods.c[0] || ''}；${t.meal.foods.p[0] || ''}` : (t.sub || t.note || '')).slice(0, 160), schedule: { at, allowWhileIdle: true } });
      });
    }
    if (list.length) await ln.schedule({ notifications: list });
    if (ask) toast(`已安排未来 7 天 ${list.length} 条提醒`);
    return true;
  } catch (e) { toast('设置提醒失败：' + (e.message || e)); return false; }
}

/* ---------- 更新 ---------- */
function newer(a, b) { const x = a.replace(/^v/, '').split('.').map(Number), y = b.replace(/^v/, '').split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; }
async function checkUpdate() {
  const msg = $('#up-msg'); msg.textContent = '检查中…';
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('GitHub 返回 ' + res.status);
    const rel = await res.json(), apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name));
    if (newer(rel.tag_name || '0', APP_VERSION)) {
      msg.textContent = '有新版本 ' + rel.tag_name;
      sheet(`<h2>新版本 ${esc(rel.tag_name)}</h2><div class="sm sub" style="white-space:pre-wrap">${esc((rel.body || '').slice(0, 600))}</div><a class="btn primary block" href="${esc(apk ? apk.browser_download_url : rel.html_url)}" target="_blank" rel="noopener" style="text-decoration:none">下载安装包</a><p class="xs faint">下载后覆盖安装，数据会保留。</p>`);
    } else msg.textContent = `已是最新 ${APP_VERSION}`;
  } catch (e) { msg.textContent = '检查失败，网络不稳定可稍后再试'; }
}

const SUB = {
  profile: { view: () => back + '<div class="head"><h1>编辑资料</h1></div>' + profileForm(false), bind: () => bindProfile(false) },
  plan: { view: viewPlan, bind: () => $$('[data-pd]').forEach(b => b.onclick = () => { S.planDay = b.dataset.pd; render(); }) },
  rules: { view: viewRules }, ai: { view: viewAI, bind: bindAI }, export: { view: viewExport, bind: bindExport }, import: { view: viewImport, bind: bindImport },
  holiday: { view: viewHoliday, bind: () => $('#hd-up').onclick = updateHolidays }, about: { view: viewAbout },
};
function viewFirst() {
  if (S.sub === 'import') return viewImport();
  return `<div class="stack" style="padding-top:18px;gap:6px"><h1 style="font-size:28px;font-weight:800">练吃日课</h1><p class="sub">按《健身Excel超级套表》的规则，生成你的饮食和训练计划。数据只保存在这台手机上。</p><button class="btn ghost sm" id="importFirst" style="justify-self:start">从备份导入</button></div>` + profileForm(true);
}
function bindFirst() { if (S.sub === 'import') { bindImport(); return; } bindProfile(true); }
window.Me = { view: viewMe, bind: bindMe, viewFirst, bindFirst, DEF, scheduleNotifs };
})();
