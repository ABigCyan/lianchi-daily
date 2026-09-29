/* 新手引导：欢迎（可导入备份）→ 身体信息 → 训练与作息 → 大模型（可跳过）→ 你的计划 */
window.Guide = (() => {
const { E, $, $$, esc, S, LS, today, DOW, toast, render } = C;
const { I } = Kit;
let step = 0, draft = null, ai = null;
const TITLES = ['欢迎', '身体', '训练与作息', '大模型', '你的计划'];

function start() { step = 0; draft = JSON.parse(JSON.stringify(Object.assign({}, Me.DEF, S.profile || {}))); ai = Object.assign({}, S.ai); S.guideOn = true; }
function seg(name, opts, v) { return `<div class="segmented" data-seg="${name}">${opts.map(([k, t]) => `<button type="button" data-v="${k}" aria-pressed="${String(v) === String(k)}">${t}</button>`).join('')}</div>`; }
function inp(id, label, v, ph, unit) { return `<div class="frow"><label for="g-${id}">${label}</label><input id="g-${id}" value="${esc(v)}" placeholder="${esc(ph)}" inputmode="decimal"${unit ? ` aria-label="${label}（${unit}）"` : ''}></div>`; }
function time(id, label, v) { return `<div class="frow"><label for="g-${id}">${label}</label><input type="time" id="g-${id}" value="${esc(v)}"></div>`; }

function view() {
  if (!draft) start();
  const progress = step === 0 ? '' : `<div class="guide-steps">${[1, 2, 3, 4].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
  const top = `<div class="guide-top">${step > 0 ? `<button class="back" data-gback>${I.left}${TITLES[step - 1]}</button>` : '<span></span>'}${step < 4 ? `<button class="link" data-gskip style="color:var(--ink3)">${step === 3 ? '跳过这一步' : '跳过引导'}</button>` : '<span></span>'}</div>`;
  let h = top + progress;
  if (step === 0) {
    h += `<div class="guide-hero"><div class="guide-mark">${I.train}</div><h1>练吃日课</h1><p>按《健身Excel超级套表》的规则，算好你每天吃什么、练什么，再一项项打勾完成。</p></div>
      <section class="list mat">${[[I.calendar, '每天一张时间线', '称重、每餐分量、训练、有氧，到点提醒'], [I.train, '训练照着做', '动作、组数、次数、换动作，都来自原表'], [I.food, '吃了什么随手记', '拍照、相册或手动，热量自动算']].map(([ic, t, s]) => `<div class="row menu-row" style="grid-template-columns:48px 1fr"><span class="row-ico">${ic}</span><span class="row-main"><span class="row-title">${t}</span><span class="row-sub">${s}</span></span></div>`).join('')}</section>
      <div class="guide-actions"><button class="pill ink wide" data-gnext>开始设置</button><button class="pill glass wide" id="g-import">${I.download}我有备份，直接导入</button><input type="file" id="g-file" accept=".json,application/json,text/plain" hidden>
      <p class="t-cap l3" style="text-align:center">数据只保存在这台手机上</p></div>`;
  } else if (step === 1) {
    h += `<div class="guide-head"><h1>先认识一下你</h1><p>用来算基础代谢和每天应吃多少（表5 G13）</p></div>
      <section class="list mat"><div class="frow"><span class="lbl">性别</span>${seg('sex', [['M', '男'], ['F', '女']], draft.sex)}</div>
      ${inp('age', '年龄', draft.age, '岁')}${inp('height', '身高', draft.height, 'cm')}${inp('weight', '体重', draft.weight, 'kg')}${inp('waist', '空腹腰围', draft.waist, '可选 cm')}${inp('targetWeight', '目标体重', draft.targetWeight, '可选 kg')}</section>
      <p class="list-footer">腰围用来判断是否向心肥胖（表5 C10），不知道可以不填</p><p class="err" id="g-err"></p>
      <div class="guide-actions"><button class="pill ink wide" data-gnext>下一步</button></div>`;
  } else if (step === 2) {
    h += `<div class="guide-head"><h1>训练和作息</h1><p>决定用哪张饮食表、哪套训练分化</p></div>
      <section class="list mat"><div class="frow"><span class="lbl">经验</span>${seg('level', [['new', '新手'], ['some', '有基础'], ['vet', '老手']], draft.level)}</div>
      <div class="frow"><span class="lbl">地点</span>${seg('place', [['gym', '健身房'], ['home', '家里']], draft.place)}</div>
      <div class="frow stack"><span class="lbl l2 t-foot">哪几天练</span><div class="days" data-gdays>${DOW.map((x, i) => `<button type="button" data-i="${i}" aria-pressed="${(draft.liftDays || []).includes(i)}">${x}</button>`).join('')}</div></div>
      ${time('liftTime', '开始训练', draft.liftTime)}</section>
      <section class="list mat">${time('wake', '起床', draft.wake)}${time('lunch', '午饭', draft.lunch)}${time('dinner', '晚饭', draft.dinner)}${time('sleep', '睡觉', draft.sleep)}</section>
      <section class="list mat"><div class="frow stack"><span class="lbl l2 t-foot">想练的部位</span><div class="chips" data-gparts>${window.PARTS.map(pt => `<button type="button" data-p="${pt.id}" aria-pressed="${(draft.parts || {})[pt.id] !== false}">${pt.name}</button>`).join('')}</div></div>
      <div class="frow"><label for="g-budget">省钱模式</label><input type="checkbox" class="switch" id="g-budget" ${draft.budget ? 'checked' : ''}></div></section>
      <p class="list-footer">省钱模式：午饭是自助就多吃肉和饭，晚饭用馒头加鸡蛋。有氧和更多选项之后可以在“我的 → 编辑资料”里设置。</p><p class="err" id="g-err"></p>
      <div class="guide-actions"><button class="pill ink wide" data-gnext>下一步</button></div>`;
  } else if (step === 3) {
    h += `<div class="guide-head"><h1>接入大模型</h1><p>拍照估算热量、热量分析会用到。不设置也能正常使用，之后可以在“我的”里再填。</p></div>
      <section class="list mat"><div class="frow"><label for="g-preset">服务商</label><select id="g-preset">${AI.PRESETS.map(x => `<option value="${x.id}" ${ai.preset === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      <div class="frow"><label for="g-base">接口地址</label><input id="g-base" value="${esc(ai.base)}" inputmode="url" placeholder="https://…/v1"></div>
      <div class="frow"><label for="g-key">API Key</label><input id="g-key" type="password" value="${esc(ai.key)}" autocomplete="off"></div>
      <div class="frow"><label for="g-model">模型</label><select id="g-model">${(ai.models || []).map(m => `<option value="${esc(m.id)}" ${ai.model === m.id ? 'selected' : ''}>${esc(m.id)}${m.vision ? '（图）' : ''}</option>`).join('') || '<option value="">先扫描</option>'}</select></div></section>
      <p class="list-footer" id="g-msg">Key 只保存在这台手机上</p>
      <div class="guide-actions"><button class="pill glass wide" id="g-scan">扫描可用模型</button><button class="pill ink wide" data-gnext>下一步</button></div>`;
  } else {
    const plan = E.build(normalized());
    h += `<div class="guide-head"><h1>你的计划</h1><p>${esc(plan.goalWhy.reason)}</p></div>
      <section class="mat card hero"><div class="hero-top"><div class="fig hero-fig">${plan.f1}<small>kcal</small></div><div class="hero-cap">${plan.noLift ? '每天应吃' : '力训日应吃'}<br><span class="l3">${plan.noLift ? '' : '休息日 ' + plan.f2}</span></div></div>
      <div class="stats"><div><span class="k">目标</span><span class="v">${plan.goal === 'cut' ? '减脂' : '增肌'}</span></div><div><span class="k">蛋白质 g</span><span class="v">${plan.prot}</span></div><div><span class="k">碳水 g</span><span class="v">${plan.carbT}</span></div></div></section>
      <section class="list mat"><div class="row menu-row" style="grid-template-columns:48px 1fr auto"><span class="row-ico">${I.food}</span><span class="row-main"><span class="row-title">饮食表</span></span><span class="row-val">${esc(plan.sheet.sheet)} ${esc(plan.sheet.name)}</span></div>
      ${plan.training ? `<div class="row menu-row" style="grid-template-columns:48px 1fr auto"><span class="row-ico">${I.train}</span><span class="row-main"><span class="row-title">训练</span></span><span class="row-val">${esc(plan.training.splitName.replace('健身房', ''))} · 每周 ${plan.perWeek} 次</span></div>` : ''}
      <div class="row menu-row" style="grid-template-columns:48px 1fr auto"><span class="row-ico">${I.sparkles}</span><span class="row-main"><span class="row-title">大模型</span></span><span class="row-val">${esc(ai.key && ai.model ? ai.model : '未设置')}</span></div></section>
      <p class="list-footer">每一步怎么算、出自 Excel 哪张表，都在“我的 → 规则与出处”里</p>
      <div class="guide-actions"><button class="pill ink wide" id="g-done">开始使用</button></div>`;
  }
  return `<div class="guide">${h}</div>`;
}
function normalized() {
  const p = Object.assign({}, draft);
  p.age = +p.age; p.height = +p.height; p.weight = +p.weight; p.waist = +p.waist || ''; p.targetWeight = +p.targetWeight || '';
  if (!S.profile) { const w = E.tm(p.wake || '07:30'); p.breakfast = E.mt(w + 25); }
  return p;
}
function collect() {
  const v = id => ($('#g-' + id) || {}).value;
  $$('[data-seg]').forEach(sg => { const on = sg.querySelector('[aria-pressed="true"]'); if (on) draft[sg.dataset.seg] = on.dataset.v; });
  if (step === 1) ['age', 'height', 'weight', 'waist', 'targetWeight'].forEach(k => draft[k] = (v(k) || '').trim());
  if (step === 2) {
    ['liftTime', 'wake', 'lunch', 'dinner', 'sleep'].forEach(k => draft[k] = v(k) || draft[k]);
    draft.liftDays = $$('[data-gdays] button').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => +b.dataset.i);
    draft.parts = {}; $$('[data-gparts] button').forEach(b => draft.parts[b.dataset.p] = b.getAttribute('aria-pressed') === 'true');
    draft.budget = $('#g-budget').checked; draft.schedMode = 'weekly';
  }
  if (step === 3) { const pr = AI.PRESETS.find(x => x.id === v('preset')); ai = { ...ai, preset: pr.id, type: pr.type, base: (v('base') || '').trim(), key: (v('key') || '').trim(), model: v('model') || ai.model }; }
}
function validate() {
  const e = [];
  if (step === 1) { const p = normalized(); if (!(p.age >= 14 && p.age <= 80)) e.push('年龄'); if (!(p.height >= 130 && p.height <= 220)) e.push('身高'); if (!(p.weight >= 35 && p.weight <= 200)) e.push('体重'); }
  if (step === 2) { if (!draft.liftDays.length) e.push('至少选一天训练'); if (!Object.values(draft.parts).some(Boolean)) e.push('至少选一个部位'); }
  if (e.length) { const el = $('#g-err'); if (el) el.textContent = '请检查：' + e.join('、'); Kit.haptic('medium'); return false; }
  return true;
}
function go(n) { step = n; Kit.haptic('light'); render(); scrollTo(0, 0); }
function finish() {
  const p = normalized();
  p.startDate = p.startDate || today(); p.startWeight = p.startWeight || p.weight;
  S.profile = p; LS.set('profile', p); S.plan = E.build(p);
  if (ai.key || ai.model) { S.ai = ai; LS.set('ai', ai); }
  LS.set('guideNext', false); S.guideOn = false; draft = null; S.tab = 'today';
  Kit.haptic('success'); render(); scrollTo(0, 0); toast('计划已生成'); Me.scheduleNotifs();
}
function skipAll() { LS.set('guideNext', false); S.guideOn = false; draft = null; render(); scrollTo(0, 0); }
function bind() {
  $$('[data-seg] button').forEach(b => b.onclick = () => { b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); Kit.haptic('light'); });
  $$('[data-gdays] button,[data-gparts] button').forEach(b => b.onclick = () => { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); Kit.haptic('light'); });
  const back = $('[data-gback]'); if (back) back.onclick = () => { collect(); go(step - 1); };
  const skip = $('[data-gskip]'); if (skip) skip.onclick = () => { if (step === 3) { collect(); go(4); } else skipAll(); };
  const next = $('[data-gnext]'); if (next) next.onclick = () => { if (step > 0) collect(); if (step > 0 && !validate()) return; go(step + 1); };
  const imp = $('#g-import'); if (imp) imp.onclick = () => $('#g-file').click();
  const file = $('#g-file'); if (file) file.onchange = () => { const f = file.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => Me.doImport(String(rd.result), true); rd.readAsText(f); };
  const pr = $('#g-preset'); if (pr) pr.onchange = () => { const x = AI.PRESETS.find(y => y.id === pr.value); if (x.base) $('#g-base').value = x.base; };
  const scan = $('#g-scan');
  if (scan) scan.onclick = async () => {
    collect(); $('#g-msg').textContent = '扫描中…';
    try { const models = await AI.listModels(ai); ai = { ...ai, models, model: AI.defaultModel(ai, models), chatModel: AI.defaultChatModel(ai, models) }; Kit.haptic('success'); render(); toast(`找到 ${models.length} 个模型，已选 ${ai.model}`); }
    catch (e) { $('#g-msg').textContent = e.message; }
  };
  const done = $('#g-done'); if (done) done.onclick = finish;
}
return { start, view, bind };
})();
