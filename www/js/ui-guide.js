/* 新手引导：欢迎（可导入备份）→ 身体信息 → 训练与作息 → 关于你（AI 记忆，可跳过）→ 大模型（可跳过）→ 外观 → 你的计划 */
window.Guide = (() => {
const { E, $, $$, esc, S, LS, today, DOW, toast, render } = C;
const { I } = Kit;
let step = 0, draft = null, ai = null;
const TITLES = ['欢迎', '身体', '训练与作息', '关于你', '大模型', '外观', '你的计划'];
const LAST = TITLES.length - 1;
const MEM_CHIPS = ['左膝受过伤，不做深蹲', '腰不好，避免硬拉', '家里只有哑铃', '在公司食堂吃午饭', '不吃牛肉', '乳糖不耐受', '每周二四加班', '想在三个月内减到目标体重'];

function start() { step = 0; draft = JSON.parse(JSON.stringify(Object.assign({}, Me.DEF, S.profile || {}))); draft._mem = []; ai = Object.assign({}, S.ai); S.guideOn = true; }
function seg(name, opts, v) { return `<div class="segmented" data-seg="${name}">${opts.map(([k, t]) => `<button type="button" data-v="${k}" aria-pressed="${String(v) === String(k)}">${t}</button>`).join('')}</div>`; }
function inp(id, label, v, ph, unit) { return `<div class="frow"><label for="g-${id}">${label}</label><input id="g-${id}" value="${esc(v)}" placeholder="${esc(ph)}" inputmode="decimal"${unit ? ` aria-label="${label}（${unit}）"` : ''}></div>`; }
function time(id, label, v) { return `<div class="frow"><label for="g-${id}">${label}</label><input type="time" id="g-${id}" value="${esc(v)}"></div>`; }

function view() {
  if (!draft) start();
  const progress = step === 0 ? '' : `<div class="guide-steps" style="grid-template-columns:repeat(${LAST},1fr)">${[...Array(LAST)].map((_, k) => k + 1).map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
  const top = `<div class="guide-top">${step > 0 ? `<button class="back" data-gback>${I.left}${TITLES[step - 1]}</button>` : '<span></span>'}${step < LAST ? `<button class="link" data-gskip style="color:var(--ink3)">${step >= 3 ? '跳过这一步' : '跳过引导'}</button>` : '<span></span>'}</div>`;
  let h = top + progress;
  if (step === 0) {
    h += `<div class="guide-hero"><img class="guide-logo" src="img/icon-512.png" alt=""><h1>练好吃对</h1><p>按《健身Excel超级套表》的规则，算好你每天吃什么、练什么，再一项项打勾完成。</p></div>
      <section class="list mat">${[[I.calendar, '每天一张时间线', '称重、每餐分量、训练、有氧，到点提醒；凌晨 4 点才换下一天'], [I.train, '训练照着做', '动作、组数、次数都来自原表；按上次的重量给建议，可以换动作'], [I.food, '吃了什么随手记', '拍照可以附一句说明，或者说一句话、从表19 选食物'], [I.sparkles, '有问题问助手', '只按套表回答并标出处；能帮你改计划，会记住你的情况']].map(([ic, t, s2]) => `<div class="row menu-row" style="grid-template-columns:48px 1fr"><span class="row-ico">${ic}</span><span class="row-main"><span class="row-title">${t}</span><span class="row-sub" style="white-space:normal">${s2}</span></span></div>`).join('')}</section>
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
    h += `<div class="guide-head"><h1>说说你的情况</h1><p>伤病、器械、忌口、作息这类长期有效的事，助手回答和改计划时都会考虑。以后在“我的 → AI 记忆”里随时能改。</p></div>
      <section class="list mat"><div class="frow stack"><div class="mem-add"><input class="field-in" id="g-mem" placeholder="写一句，比如：右肩做推举会疼" enterkeyhint="done"><button class="tbtn" id="g-mem-add">加上</button></div>
      <div class="chips" id="g-mem-chips">${MEM_CHIPS.map(t => `<button type="button" data-t="${esc(t)}" aria-pressed="${draft._mem.includes(t)}">${esc(t)}</button>`).join('')}</div></div></section>
      <section class="list mat" id="g-mem-list">${memList()}</section>
      <div class="guide-actions"><button class="pill ink wide" data-gnext>下一步</button></div>`;
  } else if (step === 4) {
    h += `<div class="guide-head"><h1>接入大模型</h1><p>助手、拍照估算热量、热量分析会用到。不设置也能正常使用，之后可以在“我的 → 大模型接口”里再填；没网时可以用“我的 → 内置模型”。</p></div>
      <section class="list mat"><div class="frow"><label for="g-preset">服务商</label><select id="g-preset">${AI.PRESETS.map(x => `<option value="${x.id}" ${ai.preset === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      <div class="frow"><label for="g-base">接口地址</label><input id="g-base" value="${esc(ai.base)}" inputmode="url" placeholder="https://…/v1"></div>
      <div class="frow"><label for="g-key">API Key</label><input id="g-key" type="password" value="${esc(ai.key)}" autocomplete="off"></div>
      ${(ai.models || []).length ? `<div class="frow"><label for="g-chat">助手模型</label><select id="g-chat">${ai.models.filter(m => !m.vision).map(m => `<option value="${esc(m.id)}" ${ai.chatModel === m.id ? 'selected' : ''}>${esc(m.id)}</option>`).join('') || '<option value="">和看图模型一样</option>'}</select></div>` : ''}
      <div class="frow"><label for="g-model">看图模型</label><select id="g-model">${(ai.models || []).map(m => `<option value="${esc(m.id)}" ${ai.model === m.id ? 'selected' : ''}>${esc(m.id)}${m.vision ? '（图）' : ''}</option>`).join('') || '<option value="">先扫描</option>'}</select></div></section>
      <p class="list-footer" id="g-msg">Key 只保存在这台手机上</p>
      <div class="guide-actions"><button class="pill glass wide" id="g-scan">扫描可用模型</button><button class="pill ink wide" data-gnext>下一步</button></div>`;
  } else if (step === 5) {
    const l = Look.get();
    h += `<div class="guide-head"><h1>挑个样子</h1><p>点一下马上能看到效果，之后在“我的 → 外观与头像”里还能改。</p></div>
      <section class="list mat"><div class="frow"><span class="lbl">模式</span>${seg('mode', [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']], l.mode)}</div>
      <div class="frow stack"><span class="lbl l2 t-foot">主题色</span><div class="swatches">${Look.ACCENTS.map(x => `<button type="button" class="sw" data-gaccent="${x[0]}" aria-pressed="${l.accent === x[0]}" aria-label="${x[1]}"><span style="background:${x[2] === 'ink' ? 'var(--ink)' : x[2]}"></span><small>${x[1]}</small></button>`).join('')}</div></div>
      <div class="frow stack"><span class="lbl l2 t-foot">卡片风格</span><div class="styles">${Look.STYLES.map(([k, n]) => `<button type="button" class="st-tile" data-gstyle="${k}" aria-pressed="${(l.style || 'glass') === k}" aria-label="${n}"><span class="st-prev st-${k}"><i></i><b></b></span><small>${n}</small></button>`).join('')}</div></div></section>
      <div class="guide-actions"><button class="pill ink wide" data-gnext>下一步</button></div>`;
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
function memList() {
  const list = draft._mem || [];
  return list.length ? list.map((t, i) => `<div class="row" style="grid-template-columns:1fr auto"><span class="row-main"><span class="row-title" style="white-space:normal">${esc(t)}</span></span><button class="link red" data-gmdel="${i}">去掉</button></div>`).join('')
    : '<div class="row" style="grid-template-columns:1fr"><span class="row-sub" style="white-space:normal">还没有。点上面的例子，或者自己写一句；没有也可以直接下一步。</span></div>';
}
function normalized() {
  const p = Object.assign({}, draft);
  p.age = +p.age; p.height = +p.height; p.weight = +p.weight; p.waist = +p.waist || ''; p.targetWeight = +p.targetWeight || '';
  if (!S.profile) { const w = E.tm(p.wake || '07:30'); p.breakfast = E.mt(w + 25); }
  return p;
}
function collect() {
  const v = id => ($('#g-' + id) || {}).value;
  $$('[data-seg]').forEach(sg => { if (sg.dataset.seg === 'mode') return; const on = sg.querySelector('[aria-pressed="true"]'); if (on) draft[sg.dataset.seg] = on.dataset.v; }); // 外观的模式直接写进外观设置，不进资料
  if (step === 1) ['age', 'height', 'weight', 'waist', 'targetWeight'].forEach(k => draft[k] = (v(k) || '').trim());
  if (step === 2) {
    ['liftTime', 'wake', 'lunch', 'dinner', 'sleep'].forEach(k => draft[k] = v(k) || draft[k]);
    draft.liftDays = $$('[data-gdays] button').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => +b.dataset.i);
    draft.parts = {}; $$('[data-gparts] button').forEach(b => draft.parts[b.dataset.p] = b.getAttribute('aria-pressed') === 'true');
    draft.budget = $('#g-budget').checked; draft.schedMode = 'weekly';
  }
  if (step === 4) { const pr = AI.PRESETS.find(x => x.id === v('preset')); ai = { ...ai, preset: pr.id, type: pr.type, base: (v('base') || '').trim(), key: (v('key') || '').trim(), model: v('model') || ai.model, chatModel: v('chat') != null ? v('chat') : ai.chatModel }; }
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
  (draft._mem || []).forEach(t => Memory.add(t, null, 'user'));
  LS.set('seenVersion', C.APP_VERSION); // 新装的不用再看“这一版新功能”
  LS.set('guideNext', false); S.guideOn = false; draft = null; S.tab = 'today';
  Kit.haptic('success'); render(); scrollTo(0, 0); toast('计划已生成'); Me.scheduleNotifs();
}
function skipAll() { LS.set('guideNext', false); S.guideOn = false; draft = null; render(); scrollTo(0, 0); }
function bind() {
  $$('[data-seg] button').forEach(b => b.onclick = () => { b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); Kit.haptic('light'); });
  $$('[data-gdays] button,[data-gparts] button').forEach(b => b.onclick = () => { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); Kit.haptic('light'); });
  const back = $('[data-gback]'); if (back) back.onclick = () => { collect(); go(step - 1); };
  const skip = $('[data-gskip]'); if (skip) skip.onclick = () => { if (step >= 3) { collect(); go(step + 1); } else skipAll(); };
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
  // 关于你：例子一点就加，再点去掉；自己写的回车或“加上”
  const memBox = () => $('#g-mem-list');
  const redraw = () => { const l = memBox(); if (l) { l.innerHTML = memList(); bindMemDel(); } };
  const bindMemDel = () => $$('[data-gmdel]').forEach(b => b.onclick = () => { const t = draft._mem[+b.dataset.gmdel]; draft._mem.splice(+b.dataset.gmdel, 1); redraw(); $$('#g-mem-chips button').forEach(c => { if (c.dataset.t === t) c.setAttribute('aria-pressed', 'false'); }); });
  const addMem = t => { t = String(t || '').trim(); if (t.length < 2) return; if (!draft._mem.includes(t)) draft._mem.push(t); redraw(); };
  $$('#g-mem-chips button').forEach(b => b.onclick = () => { const on = b.getAttribute('aria-pressed') === 'true'; if (on) { draft._mem = draft._mem.filter(x => x !== b.dataset.t); redraw(); } else addMem(b.dataset.t); b.setAttribute('aria-pressed', String(!on)); Kit.haptic('light'); });
  const gm = $('#g-mem'), gma = $('#g-mem-add');
  if (gm) { const add2 = () => { addMem(gm.value); gm.value = ''; }; gma.onclick = add2; gm.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); add2(); } }; bindMemDel(); }
  // 外观：点了马上生效
  if (step === 5) $$('[data-seg="mode"] button').forEach(b => b.addEventListener('click', () => Look.set({ mode: b.dataset.v })));
  $$('[data-gaccent]').forEach(b => b.onclick = () => { Look.set({ accent: b.dataset.gaccent }); Kit.haptic('light'); render(); });
  $$('[data-gstyle]').forEach(b => b.onclick = () => { Look.set({ style: b.dataset.gstyle }); Kit.haptic('light'); render(); });
}
/* 这一版新功能：更新后第一次打开时弹一次，“我的 → 更新与引导”里可以再看 */
const WHATS_NEW = {
  '1.12.0': [
    ['看 UP 主演示', '动作“要点”里点一段演示，用 B站 官方播放器从 UP 主在器械上做这个动作的那一秒开始放（要联网）。'],
    ['UP 主干货', '好人松松、Gandy、东哥、谭成义讲解视频里的要点和常见错误，按动作整理，链接直接跳到那个时间点。和套表不同时以套表为准。'],
    ['怎么做', '每个动作都有“准备 / 动作 / 注意”三句话。'],
    ['助手会查 UP 主干货', '问动作细节、没发力感时，助手先按套表答，再补上 UP 主的经验和视频链接。'],
  ],
  '1.11.0': [
    ['AI 记忆可以编辑', '“我的 → AI 记忆”里点“编辑”，能改文字、换分类或删除；改过的会标“你改过”。'],
    ['拍照记饮食可以附说明', '拍完先确认照片，写一句“米饭吃了一半”“酱汁没吃”，或点常用说明，识别时按你说的算。'],
    ['新手引导更新', '新增“说说你的情况”（直接存进 AI 记忆）和“挑个样子”（模式、主题色、卡片风格），大模型那步可以分别选助手和看图模型。'],
    ['动作要点', '训练页每个动作多了“要点”：按套表写明这个动作是什么关节活动、练到哪些肌肉（表21-24 + 表28，带行号）。B站 UP 主的干货整理好后会加进来，注明出处和视频链接。'],
  ],
};
function whatsNew(force) {
  const v = C.APP_VERSION, items = WHATS_NEW[v];
  if (!items || (!force && LS.get('seenVersion') === v)) return false;
  LS.set('seenVersion', v);
  C.sheet(`<h2>这一版新功能</h2><div class="sheet-sub">练好吃对 ${esc(v)}</div><div class="list" style="background:var(--fill3)">${items.map(([t, d]) => `<div class="row" style="grid-template-columns:1fr"><span class="row-main"><span class="row-title">${esc(t)}</span><span class="row-sub" style="white-space:normal">${esc(d)}</span></span></div>`).join('')}</div><button class="pill ink wide" id="wn-ok">知道了</button>`, m => m.querySelector('#wn-ok').onclick = C.close);
  return true;
}
/* 系统返回键：退回上一步；已经在第一页就返回 false */
function back() { if (!S.guideOn || step === 0) return false; collect(); go(step - 1); return true; }
return { start, view, bind, back, whatsNew };
})();
