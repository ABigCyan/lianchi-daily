/* 我的：iOS 设置风格 —— 资料、计划、规则与出处、大模型、提醒、导入导出、更新 */
(() => {
const { APP_VERSION, REPO, E, $, $$, esc, today, DOW, src, LS, S, peek, tasksFor, dayInfo, toast, sheet, close, render } = C;
const { I } = Kit;
const DEF = {
  name: '', sex: 'M', age: '', height: '', weight: '', waist: '', targetWeight: '', bmrOverride: '', goal: 'auto', lift: true, level: 'new', place: 'gym', split: 'auto',
  parts: { chest: true, back: true, shoulder: true, arm: true, legs: true, abs: true }, focus: 'auto', femaleAbs: true,
  schedMode: 'weekly', liftDays: [0, 2, 4], skipHolidays: true, cardioSkipHolidays: false, liftTime: '18:00',
  cardio: [], cardioTime: '18:30', wake: '07:30', breakfast: '08:00', lunch: '12:00', dinner: '19:00', sleep: '23:30', sheet: 'auto',
  eggsMilk: true, budget: false, lunchCost: 30, gout: false, diabetes: false,
};
const back = (t = '我的') => `<button class="back" data-back>${I.left}${t}</button>`;
const ico = (svg, color) => `<span class="row-ico" style="background:${color}">${svg}</span>`;
const item = (sub, svg, color, title, val) => `<button class="row" data-sub="${sub}">${ico(svg, color)}<span class="row-main"><span class="row-title">${title}</span></span><span class="row-val chev">${val || ''}</span></button>`;

function viewMe() {
  if (S.sub && SUB[S.sub]) return SUB[S.sub].view();
  const p = S.profile, pl = S.plan, native = isNative();
  let h = Kit.largeTitle('我的', '');
  h += `<section class="mat card"><div style="display:flex;gap:16px;align-items:center"><div class="avatar">${esc((p.name || '我').slice(0, 1))}</div><div style="display:grid;gap:2px"><span class="t-title3">${esc(p.name || '我')}</span><span class="t-foot l2">${p.sex === 'M' ? '男' : '女'} · ${p.age} 岁 · ${p.height} cm · ${p.weight} kg · BMI ${pl.bmi.toFixed(1)}</span></div></div>
    <div class="stats"><div><span class="k">目标</span><span class="v">${pl.goal === 'cut' ? '减脂' : '增肌'}</span></div><div><span class="k">应吃 kcal</span><span class="v">${pl.f1}</span></div><div><span class="k">蛋白质 g</span><span class="v">${pl.prot}</span></div></div></section>`;
  h += `<section class="list mat">${item('plan', I.calendar, 'var(--blue)', '我的计划', esc(pl.sheet.name))}${item('rules', I.doc, 'var(--indigo)', '规则与出处', 'Excel 表号')}</section>`;
  h += `<section class="list mat">${item('profile', I.person2, 'var(--green)', '编辑资料', '')}${item('profile', I.flame, 'var(--orange)', '基础代谢', pl.bmr + (pl.bmrManual ? ' · 手动' : ' · 公式'))}${item('ai', I.sparkles, 'var(--purple)', '大模型接口', esc(S.ai.model || '未设置'))}
    <div class="row">${ico(I.bell, 'var(--red)')}<span class="row-main"><span class="row-title">按时间线提醒</span>${native ? '' : '<span class="row-sub">只在手机 App 里有效</span>'}</span><input type="checkbox" class="switch" id="nt-on" ${S.notify.on ? 'checked' : ''} ${native ? '' : 'disabled'} aria-label="按时间线提醒"></div>
    ${item('holiday', I.globe, 'var(--cyan)', '节假日', Object.keys(Object.assign({}, window.HOLIDAYS_BUNDLED, S.holidays)).length + ' 天')}</section>`;
  h += `<section class="list mat">${item('export', I.share, 'var(--blue)', '导出数据', '')}${item('import', I.download, 'var(--mint)', '导入数据', '')}</section>`;
  h += `<section class="list mat"><button class="row" id="up-check">${ico(I.download, 'var(--label3)')}<span class="row-main"><span class="row-title">检查更新</span></span><span class="row-val chev" id="up-msg">${APP_VERSION}</span></button>${item('about', I.info, 'var(--label3)', '关于', '')}</section>`;
  return h;
}
function bindMe() {
  if (S.sub && SUB[S.sub]) { $$('[data-back]').forEach(b => b.onclick = () => { S.sub = S.firstImport ? null : null; S.firstImport = false; render(); scrollTo(0, 0); }); return SUB[S.sub].bind && SUB[S.sub].bind(); }
  $$('[data-sub]').forEach(b => b.onclick = () => { S.sub = b.dataset.sub; render(); scrollTo(0, 0); });
  const nt = $('#nt-on'); if (nt) nt.onchange = async () => { Kit.haptic('light'); S.notify.on = nt.checked; LS.set('notify', S.notify); if (nt.checked) { const ok = await scheduleNotifs(true); if (!ok) { S.notify.on = false; LS.set('notify', S.notify); nt.checked = false; } } else cancelNotifs(); };
  $('#up-check').onclick = checkUpdate;
}

/* ---------- 资料表单 ---------- */
const CARDIO_KINDS = ['无', '跑步', ...window.CARDIO.filter(c => !c.run).map(c => c.label)];
function profileForm(first) {
  const p = Object.assign({}, DEF, S.profile || {}); p.parts = Object.assign({}, DEF.parts, p.parts || {});
  const sel = (id, opts, v) => `<select id="f-${id}">${opts.map(([k, t]) => `<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const inp = (id, label, v, ph, mode) => `<div class="frow"><label for="f-${id}">${label}</label><input id="f-${id}" value="${esc(v)}" placeholder="${esc(ph)}" inputmode="${mode || 'decimal'}"></div>`;
  const time = (id, label, v) => `<div class="frow"><label for="f-${id}">${label}</label><input type="time" id="f-${id}" value="${esc(v)}"></div>`;
  const tog = (id, label, on) => `<div class="frow"><label for="f-${id}">${label}</label><input type="checkbox" class="switch" id="f-${id}" ${on ? 'checked' : ''}></div>`;
  const days = (id, arr, cls) => `<div class="days ${cls || ''}" data-dows="${id}">${DOW.map((x, i) => `<button type="button" data-i="${i}" aria-pressed="${(arr || []).includes(i)}">${x}</button>`).join('')}</div>`;
  const formula = p.weight && p.height && p.age ? Math.round(p.weight * 9.99 + p.height * 6.25 - p.age * 4.92 + (p.sex === 'M' ? 5 : -161)) : '';
  const sheets = [['auto', '按训练时间自动']].concat(Object.entries(E.SHEETS).map(([k, v]) => [k, v.name]));
  const cardio = [0, 1, 2].map(i => { const a = p.cardio[i] || { kind: '无', minutes: 45, pace: 8, days: [] };
    return `<section class="fsec"><h3>有氧 ${i + 1}</h3><div class="list mat"><div class="frow"><label>项目</label><select data-c="${i}|kind">${CARDIO_KINDS.map(k => `<option ${a.kind === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
      <div class="frow"><label>每次分钟</label><input data-c="${i}|minutes" value="${esc(a.minutes)}" inputmode="numeric"></div>
      <div class="frow"><label>跑步配速</label><input data-c="${i}|pace" value="${esc(a.pace || '')}" placeholder="分钟/公里" inputmode="decimal"></div>
      <div class="frow"><label>运动心率</label><input data-c="${i}|hr" value="${esc(a.hr || '')}" placeholder="可选" inputmode="numeric"></div>
      <div class="frow"><label>静息心率</label><input data-c="${i}|rhr" value="${esc(a.rhr || '')}" placeholder="可选" inputmode="numeric"></div>
      <div class="frow stack">${days('cd' + i, a.days, 'mint')}</div></div></section>`; }).join('');
  return `<form class="form" id="pform">
  <section class="fsec"><h3>身体</h3><div class="list mat">
    <div class="frow"><label for="f-name">昵称</label><input id="f-name" value="${esc(p.name)}" placeholder="可不填" inputmode="text"></div>
    <div class="frow"><label for="f-sex">性别</label>${sel('sex', [['M', '男'], ['F', '女']], p.sex)}</div>
    ${inp('age', '年龄', p.age, '岁')}${inp('height', '身高', p.height, 'cm')}${inp('weight', '体重', p.weight, 'kg')}${inp('waist', '空腹腰围', p.waist, '可选 cm')}${inp('targetWeight', '目标体重', p.targetWeight, '可选 kg')}
    ${inp('bmrOverride', '基础代谢', p.bmrOverride, formula ? `公式 ${formula}` : '留空按公式')}
    <div class="frow"><label for="f-goal">目标</label>${sel('goal', [['auto', '自动判断'], ['cut', '减脂'], ['bulk', '增肌']], p.goal)}</div>
    ${tog('gout', '高尿酸 / 痛风', p.gout)}${tog('diabetes', '胰岛素抵抗 / 二糖', p.diabetes)}</div>
    <div class="list-footer">基础代谢留空时按表5 G13 公式计算；填了体测仪或医院测的数值会优先使用</div></section>
  <section class="fsec"><h3>力量训练</h3><div class="list mat">
    ${tog('lift', '做力量训练', p.lift !== false)}
    <div class="frow"><label for="f-level">经验</label>${sel('level', [['new', '新手'], ['some', '有基础'], ['vet', '老手']], p.level)}</div>
    <div class="frow"><label for="f-place">地点</label>${sel('place', [['gym', '健身房'], ['home', '家里']], p.place)}</div>
    <div class="frow"><label for="f-split">分化</label>${sel('split', [['auto', '自动'], ['three', '三分化 表21'], ['four_sh', '四分化·肩 表22'], ['four_arm', '四分化·手臂 表23'], ['home', '居家 表24']], p.split)}</div>
    <div class="frow"><label for="f-focus">四分化重点</label>${sel('focus', [['auto', '肩'], ['arm', '手臂']], p.focus)}</div>
    ${time('liftTime', '开始时间', p.liftTime)}
    <div class="frow"><label for="f-schedMode">训练日</label>${sel('schedMode', [['weekly', '固定星期几'], ['workdays', '所有工作日'], ['free', '不固定']], p.schedMode)}</div>
    <div class="frow stack">${days('liftDays', p.liftDays)}</div>
    <div class="frow stack"><span class="lbl l2 t-foot">想练的部位</span><div class="chips">${window.PARTS.map(pt => `<button type="button" data-part="${pt.id}" aria-pressed="${p.parts[pt.id] !== false}">${pt.name}</button>`).join('')}</div></div>
    ${tog('skipHolidays', '节假日跳过力训', p.skipHolidays !== false)}${tog('cardioSkipHolidays', '节假日也跳过有氧', p.cardioSkipHolidays)}</div></section>
  ${cardio}
  <section class="fsec"><h3>有氧时间</h3><div class="list mat">${time('cardioTime', '非力训日开始', p.cardioTime)}</div></section>
  <section class="fsec"><h3>作息和吃饭</h3><div class="list mat">
    ${time('wake', '起床', p.wake)}${time('breakfast', '早饭', p.breakfast)}${time('lunch', '午饭', p.lunch)}${time('dinner', '晚饭', p.dinner)}${time('sleep', '睡觉', p.sleep)}
    <div class="frow"><label for="f-sheet">饮食表</label>${sel('sheet', sheets, p.sheet)}</div>
    ${inp('lunchCost', '午饭价格', p.lunchCost, '元')}${tog('eggsMilk', '早饭能吃蛋奶', p.eggsMilk !== false)}${tog('budget', '省钱模式', p.budget)}</div>
    <div class="list-footer">省钱模式：午饭自助多吃肉和饭，晚饭用馒头加鸡蛋</div></section>
  <button class="pill ink wide" type="submit">${first ? '生成我的计划' : '保存'}</button><p class="err" id="ferr" role="alert"></p></form>`;
}
function bindProfile(first) {
  $$('[data-dows] button,[data-part]').forEach(b => b.onclick = () => { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); Kit.haptic('light'); });
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
    if (errs.length) { $('#ferr').textContent = '请检查：' + errs.join('、'); Kit.haptic('medium'); return; }
    p.startDate = p.startDate || today(); p.startWeight = p.startWeight || p.weight;
    S.profile = p; LS.set('profile', p); S.plan = E.build(p);
    Kit.haptic('success'); toast(first ? '计划已生成' : '已保存');
    S.sub = null; S.tab = first ? 'today' : 'me'; render(); scrollTo(0, 0); scheduleNotifs();
  };
}

/* ---------- 我的计划 ---------- */
function viewPlan() {
  const pl = S.plan, meals = pl.noLift ? pl.meals.rest : pl.meals[S.planDay || 'lift'];
  let h = back() + Kit.largeTitle('我的计划', `${pl.sheet.sheet} ${pl.sheet.name}${pl.training ? ' · ' + pl.training.splitName : ''}`);
  h += `<section class="mat card"><div class="stats"><div><span class="k">基础代谢</span><span class="v">${pl.bmr}</span></div><div><span class="k">${pl.noLift ? '每天' : '力训日'} kcal</span><span class="v">${pl.f1}</span></div>${pl.noLift ? '' : `<div><span class="k">休息日 kcal</span><span class="v">${pl.f2}</span></div>`}</div>
    <div class="tbl"><table><tbody><tr><td>碳水</td><td class="n">${pl.carbT} g</td>${pl.noLift ? '' : `<td class="n">${pl.carbR} g</td>`}</tr><tr><td>蛋白质</td><td class="n">${pl.prot} g</td>${pl.noLift ? '' : `<td class="n">${pl.prot} g</td>`}</tr><tr><td>脂肪</td><td class="n">${pl.fat} g</td>${pl.noLift ? '' : `<td class="n">${pl.fat} g</td>`}</tr></tbody></table></div>
    <div class="t-foot l2">${esc(pl.goalWhy.reason)}</div></section>`;
  h += `<section class="section"><div class="section-h"><h2>每餐</h2>${pl.noLift ? '' : `<div class="segmented"><button data-pd="lift" aria-pressed="${(S.planDay || 'lift') === 'lift'}">力训日</button><button data-pd="rest" aria-pressed="${S.planDay === 'rest'}">休息日</button></div>`}</div>
    <div class="list mat">${meals.map(m => `<div class="row" style="grid-template-columns:1fr auto"><span class="row-main"><span class="row-title"><span class="time">${m.time}</span>${esc(m.name)}</span><span class="row-sub">${esc([m.foods.c[0], m.foods.p[0]].filter(Boolean).join('；'))}</span></span><span class="row-val num t-foot">${m.c} / ${m.p}</span></div>`).join('')}</div><div class="list-footer">右边：碳水 g / 蛋白质 g</div></section>`;
  if (pl.training) h += `<section class="section"><div class="section-h"><h2>训练</h2><span class="t-foot l2">每周 ${pl.perWeek} 次</span></div><div class="list mat">${pl.training.days.map((d, i) => `<div class="row" style="grid-template-columns:auto 1fr">${ico(`<b style="font-size:13px">${i + 1}</b>`, 'var(--indigo)')}<span class="row-main"><span class="row-title">${esc(d.name)}</span><span class="row-sub">${d.groups.map(g => esc(g.name)).join('、')}</span></span></div>`).join('')}</div></section>`;
  h += `<section class="mat card"><span class="t-title3">未来两周</span>${calendar()}</section>`;
  if (pl.warnings.length) h += `<section class="section">${pl.warnings.map(w => `<div class="note warn mat">${esc(w.text)}</div>`).join('')}</section>`;
  return h;
}
function calendar() {
  const td = today(), start = E.addDays(td, -E.dow(td));
  let h = '<div class="heat">' + DOW.map(x => `<div class="hd">${x}</div>`).join('');
  for (let i = 0; i < 14; i++) {
    const d = E.addDays(start, i), info = dayInfo(d);
    const lab = info.type === 'lift' ? '练' : info.type === 'cardio' ? '氧' : info.type === 'holiday' ? '假' : (info.h && !info.h.off ? '班' : '休');
    const bg = { lift: 'var(--ink)', cardio: 'color-mix(in srgb,var(--ink) 18%,transparent)', holiday: 'color-mix(in srgb,var(--amber) 22%,transparent)', rest: 'var(--fill)' }[info.type];
    h += `<div class="h" style="background:${bg};${d === td ? 'box-shadow:inset 0 0 0 1.5px var(--accent);' : ''}display:grid;line-height:1.15;color:${info.type === 'lift' ? 'var(--bg)' : 'var(--ink2)'}"><b style="color:${info.type === 'lift' ? 'var(--bg)' : 'var(--ink)'}">${E.pd(d).getDate()}</b>${lab}</div>`;
  }
  return h + '</div><div class="t-cap l3">练：力训 · 氧：有氧 · 假：法定节假日 · 班：调休上班</div>';
}

/* ---------- 规则与出处 ---------- */
function viewRules() {
  const p = S.profile, pl = S.plan, R = window.RULES;
  const row = (a, b, c, s, app) => `<tr><td>${a}<br>${src(s, app)}</td><td class="n">${b}</td>${pl.noLift ? '' : `<td class="n">${c}</td>`}</tr>`;
  const para = keys => keys.map(k => `<p class="t-sub">${esc(R[k].text)} ${src(R[k].src)}</p>`).join('');
  let h = back() + Kit.largeTitle('规则与出处', '');
  h += `<p class="t-foot l2" style="padding:0 6px">全部规则来自${esc(window.SRC_BOOK)}。灰色标签是表号和单元格；橙色标签是 Excel 没给具体数值、本应用补充的做法。</p>`;
  h += `<section class="mat card"><span class="t-title3">1. 目标</span><p class="t-sub">${esc(pl.goalWhy.reason)} ${src(pl.goalWhy.src)}</p>${para(['noRecomp'])}</section>`;
  h += `<section class="mat card"><span class="t-title3">2. 热量与营养素</span><div class="tbl"><table><thead><tr><th>步骤</th><th class="n">${pl.noLift ? '每天' : '力训日'}</th>${pl.noLift ? '' : '<th class="n">休息日</th>'}</tr></thead><tbody>
    ${row('基础代谢' + (pl.bmrManual ? `（手动，公式为 ${pl.bmrFormula}）` : ''), pl.bmr, pl.bmr, pl.bmrManual ? '用户手动输入' : R.bmr.src, pl.bmrManual)}${row('无运动总消耗 ÷0.7', pl.b, pl.b, R.noExercise.src)}
    ${row('力训消耗', pl.noLift ? '—' : '+' + pl.c, '—', R.liftBurn.src)}${row('有氧（每周÷7）', '+' + pl.d, '+' + pl.d, R.cardioBurn.src)}${row('平衡热量', pl.e1, pl.e2, R.balance.src)}
    ${row(`应吃热量 ×${pl.factor}`, pl.f1, pl.f2, pl.goal === 'cut' ? R.cutFactor.src : R.bulkFactor.src)}${row('脂肪', pl.fat + 'g', pl.fat + 'g', R.fat.src)}
    ${row('蛋白质', `${pl.prot}g`, `${pl.prot}g`, R.split.src)}${row('碳水', `${pl.carbT}g`, `${pl.carbR}g`, R.split.src + '，' + R.quota.src)}</tbody></table></div>
    ${pl.notes.map(n => `<p class="t-sub">${esc(n.text)} ${src(n.src)}</p>`).join('')}</section>`;
  h += `<section class="mat card"><span class="t-title3">3. 饮食表与分餐</span><p class="t-sub">${esc(pl.sheet.sheet)}《${pl.goal === 'cut' ? '减脂' : '增肌'}-${esc(pl.sheet.name)}》：${esc(pl.sheet.how)} ${src(R.meals.src)} ${pl.noLift ? '' : src('按练前 2 小时内是否吃过正餐判断', 1)}</p>
    <p class="t-sub">每餐分多少 ${src('应用补充', 1)}：原表数值格子为空，按原表规则分配——练后餐最大（C12）、练前餐只垫碳水（I44）、零食只留 10% 碳水（E58）、早饭鸡蛋牛奶（J31）${p.budget ? '；省钱模式把肉和饭集中到自助午饭（参考表20 价格）' : ''}</p>
    ${para(['fatRule', 'veg', 'fruit', 'breakfast', 'preMeal', 'postMeal', 'snack', 'canteen', 'leanShort', 'alcohol'].concat(pl.goal === 'bulk' ? ['bulkNuts'] : []))}</section>`;
  h += `<section class="mat card"><span class="t-title3">4. 有氧</span>${pl.cardio.items.map(a => `<p class="t-sub">${esc(a.kind)} ${a.minutes} 分钟：每次约 ${a.perSession} kcal，每周 ${a.n} 次 ${src(a.src)}</p>`).join('') || '<p class="t-sub l2">没有设置有氧</p>'}${para(['cardioAdvice', 'cardioHobby', 'cardioTiming', 'cardioHR', 'cardioSwap'])}</section>`;
  if (pl.training) {
    const tr = pl.training;
    h += `<section class="mat card"><span class="t-title3">5. 训练：${esc(tr.splitName)}</span><p class="t-sub">${esc(tr.split.why)} ${src(tr.split.src)}</p>
      ${tr.days.map((d, i) => `<div style="display:grid;gap:4px"><b class="t-sub">Day${i + 1} ${esc(d.name)} ${src(d.src)}</b>${d.groups.map(g => `<div class="t-foot">${esc(g.name)} <span class="l2">${esc(g.text)}</span> ${src(g.src)}${g.movedNote ? src('不练腿，腹移到这天', 1) : ''}</div>`).join('')}</div>`).join('')}
      ${para(['freq', 'volume', 'rest', 'load', 'failure', 'legRotate', 'abs', 'chestExtra', 'oneRM'].concat(p.sex === 'F' ? ['female'] : []))}
      <p class="t-sub">新手前 4 周组数取下限、第 1-2 周用 12-15 次；每个动作不超过 4 组；新手先排器械动作；有基础者下胸隔次做；加重用双进阶 ${src('应用补充', 1)}</p></section>`;
  }
  h += `<section class="mat card"><span class="t-title3">6. 调整与停止</span>${para(['cutSpeed', 'cutAdjust', 'cut10kg', 'cutStop', 'bulkSpeed', 'bulkAdjust', 'bulkStop', 'scale', 'diabetes', 'gout'])}<p class="t-sub">热量分析里的每周体重变化按 1kg 脂肪约 7700 kcal 估算 ${src('应用补充', 1)}</p></section>`;
  h += `<section class="mat card"><span class="t-title3">7. 界面设计</span><p class="t-sub">中性底色的玻璃风格，颜色只用于“可点击”和“完成”；设计规则见仓库 DESIGN.md。</p></section>`;
  return h;
}

/* ---------- 大模型接口 ---------- */
function viewAI() {
  const ai = S.ai;
  return back() + Kit.largeTitle('大模型接口', '') + `<p class="t-foot l2" style="padding:0 6px">用于拍照、相册、文字估算饮食和热量分析。Key 只保存在这台手机上。</p>
  <section class="list mat"><div class="frow"><label for="ai-preset">服务商</label><select id="ai-preset">${AI.PRESETS.map(x => `<option value="${x.id}" ${ai.preset === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <div class="frow"><label for="ai-base">接口地址</label><input id="ai-base" value="${esc(ai.base)}" placeholder="https://…/v1" inputmode="url"></div>
    <div class="frow"><label for="ai-key">API Key</label><input id="ai-key" type="password" value="${esc(ai.key)}" autocomplete="off"></div></section>
  <button class="pill glass wide" id="ai-scan">扫描可用模型</button><p class="t-foot l2" id="ai-msg" style="text-align:center"></p>
  <section class="list mat"><div class="frow"><label for="ai-model">模型</label><select id="ai-model">${(ai.models || []).map(m => `<option value="${esc(m.id)}" ${ai.model === m.id ? 'selected' : ''}>${esc(m.id)}${m.vision ? '（图）' : ''}</option>`).join('')}${ai.model && !(ai.models || []).some(m => m.id === ai.model) ? `<option selected>${esc(ai.model)}</option>` : ''}</select></div>
    <div class="frow"><label for="ai-manual">手动模型 ID</label><input id="ai-manual" placeholder="可选" inputmode="text"></div></section>
  <div class="list-footer">带“（图）”的模型能看照片</div>
  <button class="pill ink wide" id="ai-save">保存</button>
  <details class="mat card"><summary class="t-headline">内置的饮食识别提示词</summary><pre class="t-foot l2" style="white-space:pre-wrap;margin:0">${esc(AI.systemPrompt())}</pre></details>`;
}
function bindAI() {
  $('#ai-preset').onchange = () => { const pr = AI.PRESETS.find(x => x.id === $('#ai-preset').value); if (pr.base) $('#ai-base').value = pr.base; };
  const collect = () => { const pr = AI.PRESETS.find(x => x.id === $('#ai-preset').value); return { ...S.ai, preset: pr.id, type: pr.type, base: $('#ai-base').value.trim(), key: $('#ai-key').value.trim() }; };
  $('#ai-scan').onclick = async () => {
    const cfg = collect(); $('#ai-msg').textContent = '扫描中…';
    try { const models = await AI.listModels(cfg); S.ai = { ...cfg, models, model: S.ai.model && models.some(m => m.id === S.ai.model) ? S.ai.model : AI.defaultModel(cfg, models) }; LS.set('ai', S.ai); Kit.haptic('success'); render(); toast(`找到 ${models.length} 个模型，已选 ${S.ai.model}`); }
    catch (e) { $('#ai-msg').textContent = e.message; }
  };
  $('#ai-save').onclick = () => { const cfg = collect(); const man = $('#ai-manual').value.trim(); S.ai = { ...cfg, model: man || ($('#ai-model') || {}).value || S.ai.model }; LS.set('ai', S.ai); Kit.haptic('success'); toast('已保存'); S.sub = null; render(); };
}

/* ---------- 导出 / 导入 ---------- */
function viewExport() {
  return back() + Kit.largeTitle('导出数据', '') + `<section class="list mat"><div class="frow"><label for="ex-ai">包含大模型接口</label><input type="checkbox" class="switch" id="ex-ai"></div></section>
  <div class="list-footer">包含时会带上接口地址和 API Key，不要发给别人</div>
  <button class="pill ink wide" id="ex-file">${I.share}导出为文件</button><button class="pill glass wide" id="ex-copy">复制到剪贴板</button>
  <p class="t-foot l2" style="text-align:center">导出文件会打开系统分享，可以存到“文件”、网盘或发给自己</p>`;
}
function backupText(withAI) {
  const data = LS.all(); if (!withAI) delete data['lcd:ai'];
  const days = Object.keys(data).filter(k => k.startsWith('lcd:m:')).reduce((s, k) => { try { return s + Object.keys(JSON.parse(data[k])).length; } catch (e) { return s; } }, 0);
  return { text: JSON.stringify({ app: 'lianchi-daily', version: APP_VERSION, at: new Date().toISOString(), includesAI: !!withAI, days, data }), days };
}
function bindExport() {
  $('#ex-copy').onclick = async () => { const { text } = backupText($('#ex-ai').checked); try { await navigator.clipboard.writeText(text); Kit.haptic('success'); toast('已复制'); } catch (e) { sheet(`<h2>复制下面内容</h2><textarea class="field-in" style="height:220px;font-size:11px;padding:10px">${esc(text)}</textarea>`); } };
  $('#ex-file').onclick = async () => {
    const withAI = $('#ex-ai').checked, { text, days } = backupText(withAI), name = `练吃日课备份-${today()}${withAI ? '-含模型' : ''}.json`;
    try {
      if (isNative() && window.capacitorFilesystemPluginCapacitor && window.capacitorShare) {
        const res = await window.capacitorFilesystemPluginCapacitor.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
        await window.capacitorShare.Share.share({ title: name, files: [res.uri], dialogTitle: '保存或发送备份' });
      } else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
      Kit.haptic('success'); toast(`已导出 ${days} 天记录`);
    } catch (e) { if (!/cancel/i.test(e.message || '')) toast('导出失败：' + (e.message || e)); }
  };
}
function viewImport() {
  return back(S.firstImport ? '返回' : '我的') + Kit.largeTitle('导入数据', '') + `<p class="t-foot l2" style="padding:0 6px">选择之前导出的备份文件，或粘贴备份内容。导入会覆盖这台手机上的同名数据。</p>
  <button class="pill ink wide" id="im-file">${I.download}选择备份文件</button><input type="file" id="im-input" accept=".json,application/json,text/plain" hidden>
  <section class="list mat"><div class="frow stack"><textarea class="field-in" id="im-text" style="height:120px;padding:10px 12px;font-size:12px" placeholder="或粘贴备份内容"></textarea></div><div class="frow"><label for="im-ai">导入大模型接口</label><input type="checkbox" class="switch" id="im-ai" checked></div></section>
  <button class="pill glass wide" id="im-ok">导入粘贴的内容</button><p class="err" id="im-err"></p>`;
}
function doImport(text) {
  try {
    const obj = JSON.parse(text);
    if (!obj || obj.app !== 'lianchi-daily' || !obj.data) throw new Error('不是练吃日课的备份文件');
    const keepAI = $('#im-ai').checked, entries = Object.entries(obj.data).filter(([k]) => k.startsWith('lcd:') && (keepAI || k !== 'lcd:ai'));
    sheet(`<h2>确认导入</h2><div class="sheet-sub">备份时间 ${esc((obj.at || '').slice(0, 16).replace('T', ' '))} · ${obj.days || '若干'} 天记录${obj.includesAI ? ' · 含大模型接口' : ''}</div><p class="t-sub l2" style="text-align:center">会覆盖这台手机上的同名数据</p><button class="pill ink wide" id="im-go">导入</button><button class="pill glass wide" id="im-x">取消</button>`, m => {
      m.querySelector('#im-x').onclick = close;
      m.querySelector('#im-go').onclick = () => { entries.forEach(([k, v]) => localStorage.setItem(k, v)); location.reload(); };
    });
  } catch (e) { $('#im-err').textContent = '导入失败：' + e.message; }
}
function bindImport() {
  $$('[data-back]').forEach(b => b.onclick = () => { S.sub = null; S.firstImport = false; render(); });
  $('#im-file').onclick = () => $('#im-input').click();
  $('#im-input').onchange = () => { const f = $('#im-input').files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => doImport(String(rd.result)); rd.readAsText(f); };
  $('#im-ok').onclick = () => doImport($('#im-text').value);
}

/* ---------- 节假日、关于 ---------- */
function viewHoliday() {
  const all = Object.assign({}, window.HOLIDAYS_BUNDLED, S.holidays), up = Object.entries(all).filter(([d]) => d >= today()).sort().slice(0, 12);
  return back() + Kit.largeTitle('节假日', '') + `<section class="list mat">${up.map(([d, [n, off]]) => `<div class="row" style="grid-template-columns:1fr auto"><span class="row-main"><span class="row-title">${esc(n)}</span><span class="row-sub num">${d}</span></span><span class="row-val" style="color:${off ? 'var(--amber)' : 'var(--accent)'}">${off ? '放假' : '补班'}</span></div>`).join('') || '<div class="row"><span class="row-title l2">暂无后续安排</span></div>'}</section>
  <div class="list-footer">数据来自国务院办公厅通知（holiday-cn 整理）。每年 11 月前后公布下一年安排。</div><button class="pill glass wide" id="hd-up">联网更新</button>`;
}
async function updateHolidays() {
  const y = new Date().getFullYear(); let n = 0;
  for (const year of [y, y + 1]) for (const base of ['https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/', 'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/']) {
    try { const res = await fetch(base + year + '.json'); if (!res.ok) continue; const d = await res.json(); (d.days || []).forEach(x => { S.holidays[x.date] = [x.name, x.isOffDay]; n++; }); break; } catch (e) { /* 换地址 */ }
  }
  LS.set('holidays', S.holidays); toast(n ? `已更新 ${n} 天` : '没有获取到数据'); render();
}
function viewAbout() {
  return back() + Kit.largeTitle('关于', '') + `<section class="mat card"><p class="t-sub">饮食和训练规则：${esc(window.SRC_BOOK)}。配套讲解：B站 BV1zu4m1N76R（饮食）、BV1Hk4y187jF（训练）。</p>
    <p class="t-sub">动作图片：free-exercise-db（公有领域）。节假日：holiday-cn。字体：Inter（SIL OFL 1.1）。打包：Capacitor。</p>
    <p class="t-sub">源代码：github.com/${REPO}</p><p class="t-foot l2">个人学习工具，不能代替医生建议。训练中头晕、胸闷或关节疼痛，请停止并就医。</p></section>`;
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
        list.push({ id: (i + 1) * 100 + k, title: t.title, body: String(t.kind === 'food' && t.meal ? `${t.meal.foods.c[0] || ''}；${t.meal.foods.p[0] || ''}` : (t.sub || t.note || '')).slice(0, 160), schedule: { at, allowWhileIdle: true } });
      });
    }
    if (list.length) await ln.schedule({ notifications: list });
    if (ask) toast(`已安排 ${list.length} 条提醒`);
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
      msg.textContent = '有新版本';
      sheet(`<h2>新版本 ${esc(rel.tag_name)}</h2><div class="t-foot l2" style="white-space:pre-wrap;max-height:40vh;overflow:auto">${esc((rel.body || '').slice(0, 800))}</div><a class="pill ink wide" href="${esc(apk ? apk.browser_download_url : rel.html_url)}" target="_blank" rel="noopener" style="text-decoration:none">下载安卓安装包</a><p class="t-cap l3" style="text-align:center">覆盖安装，数据会保留</p>`);
    } else msg.textContent = `已是最新 ${APP_VERSION}`;
  } catch (e) { msg.textContent = '检查失败'; toast('网络不稳定，稍后再试'); }
}

const SUB = {
  profile: { view: () => back() + Kit.largeTitle('编辑资料', '') + profileForm(false), bind: () => { $$('[data-back]').forEach(b => b.onclick = () => { S.sub = null; render(); }); bindProfile(false); } },
  plan: { view: viewPlan, bind: () => $$('[data-pd]').forEach(b => b.onclick = () => { S.planDay = b.dataset.pd; render(); }) },
  rules: { view: viewRules }, ai: { view: viewAI, bind: bindAI }, export: { view: viewExport, bind: bindExport }, import: { view: viewImport, bind: bindImport },
  holiday: { view: viewHoliday, bind: () => $('#hd-up').onclick = updateHolidays }, about: { view: viewAbout },
};
function viewFirst() {
  if (S.sub === 'import') return viewImport();
  return Kit.largeTitle('练吃日课', '按《健身Excel超级套表》生成你的饮食和训练计划') + `<section class="mat card"><p class="t-sub">填好资料就能生成计划。数据只保存在这台手机上。</p><button class="pill glass" id="importFirst" style="justify-self:start">${I.download}从备份导入</button></section>` + profileForm(true);
}
function bindFirst() { if (S.sub === 'import') { bindImport(); return; } bindProfile(true); }
window.Me = { view: viewMe, bind: bindMe, viewFirst, bindFirst, DEF, scheduleNotifs };
})();
