/* 饮食：圆环 + 记录按钮 + 各餐（拍照 / 相册 / 手动 / 文字 AI） */
(() => {
const { E, $, $$, esc, today, S, peek, rec, save, tasksFor, scoreDay, intakeOf, targetOf, burnOf, badges, celebrate, toast, sheet, close, head, bindHead, render, uid } = C;
const { I } = Kit;

function mealsOf(d) { return tasksFor(d).meals; }
function mealOf(d, key) { return mealsOf(d).find(m => m.key === key) || { key: 'extra', name: '加餐', c: 0, p: 0 }; }
function nearestMeal(d) { const meals = mealsOf(d), nm = C.dayMin(E.mt(new Date().getHours() * 60 + new Date().getMinutes())); let b = meals[0]; meals.forEach(m => { if (Math.abs(C.dayMin(m.time) - nm) < Math.abs(C.dayMin(b.time) - nm)) b = m; }); return b; }

function viewFood() {
  const d = S.day, r = peek(d) || {}, e = intakeOf(d), t = targetOf(d), b = burnOf(d), future = d > today();
  let h = head('饮食', d, S.plan.goal === 'cut' ? '减脂期' : '增肌期');
  const bar = (v, max) => `<span class="bar ${v > max * 1.1 ? 'over' : ''}"><i style="width:${max ? Math.min(100, Math.round(v / max * 100)) : 0}%"></i></span>`;
  h += `<section class="mat card hero"><div class="hero-top"><div class="fig hero-fig">${e.kcal}<small>/ ${t.kcal} kcal</small></div><div class="hero-cap">已吃<br><span class="l3">消耗 ${b.total}</span></div></div>
    <div class="progress"><i style="width:${t.kcal ? Math.min(100, Math.round(e.kcal / t.kcal * 100)) : 0}%"></i></div>
    <div class="stats"><div><span class="k">碳水 g</span><span class="v">${e.c}<small>/${t.c}</small></span>${bar(e.c, t.c)}</div>
    <div><span class="k">蛋白质 g</span><span class="v">${e.p}<small>/${t.p}</small></span>${bar(e.p, t.p)}</div>
    <div><span class="k">脂肪 g</span><span class="v">${e.f}<small>/${t.f}</small></span>${bar(e.f, t.f)}</div></div></section>`;
  if (!future) h += `<div class="action-grid">${[['camera', I.camera, '拍照'], ['album', I.photo, '相册导入'], ['manual', I.pencil, '手动添加']].map(([k, ic, n]) => `<button class="action" data-add="${k}"><span class="ai">${ic}</span>${n}</button>`).join('')}</div>`;
  const meals = mealsOf(d), foods = r.food || [];
  h += `<section class="section"><div class="section-h"><h2>各餐</h2><span>目标 碳水 / 蛋白质</span></div><div class="list mat">`;
  meals.forEach(m => {
    const logged = foods.filter(f => f.meal === m.key);
    const lc = logged.reduce((s, f) => s + f.total.carbs_g, 0), lp = logged.reduce((s, f) => s + f.total.protein_g, 0);
    h += `<button class="row" ${future ? '' : `data-meal="${m.key}"`}><span class="time">${m.time}</span><span class="row-main"><span class="row-title">${esc(m.name)}</span><span class="row-sub">${logged.length ? `已记 ${lc} / ${lp} g` : '还没记录'}</span></span><span class="row-val">${m.c} / ${m.p}${future ? '' : `<span class="tbtn" style="height:28px;padding:0 10px;margin-left:8px;font-size:13px;display:inline-grid;place-items:center">记录</span>`}</span></button>`;
    logged.forEach(f => h += entryRow(f, foods.indexOf(f)));
  });
  foods.filter(f => !meals.some(m => m.key === f.meal)).forEach(f => h += entryRow(f, foods.indexOf(f)));
  h += `</div><div class="list-footer">“应吃”已预留原表的 10-20% 余量（表5 G19）；AI 估算只做参考</div></section>`;
  return h;
}
function entryRow(f, i) {
  return `<button class="row" data-f="${i}"><span></span><span class="row-main"><span class="row-title">${esc(f.items.map(x => x.name).join('、') || '（空）')}</span><span class="row-sub">${f.source === 'ai' ? 'AI 估算' : '手动'} · 碳水 ${f.total.carbs_g} · 蛋白 ${f.total.protein_g}</span></span><span class="row-val num">${f.total.kcal}</span></button>`;
}
function bindFood() {
  bindHead();
  $$('[data-add]').forEach(b => b.onclick = () => { Kit.haptic('light'); const k = b.dataset.add; if (k === 'manual') addSheet(null, 'manual'); else pickImage(null, k === 'camera'); });
  $$('[data-meal]').forEach(b => b.onclick = () => addSheet(b.dataset.meal));
  $$('[data-f]').forEach(b => b.onclick = () => showEntry(peek(S.day).food[+b.dataset.f], +b.dataset.f));
}
function mealChips(d, cur) {
  const meals = mealsOf(d).concat([{ key: 'extra', name: '加餐' }]);
  return `<div class="seg-wrap glass"><div class="seg-scroll" id="fm-meals">${meals.map(m => `<button data-fm="${m.key}" aria-pressed="${m.key === cur}">${esc(m.name.replace(/（.*）/, ''))}</button>`).join('')}</div></div>`;
}
/* 最近吃过的食物（近 30 天，按次数） */
function recentFoods() {
  const n = new Map();
  for (let i = 0; i < 30; i++) ((peek(E.addDays(today(), -i)) || {}).food || []).forEach(e => e.items.forEach(it => {
    const f = it.fid ? FoodDB.byId(it.fid) : FoodDB.list.find(x => String(it.name).startsWith(x.n + ' '));
    if (f) n.set(f, (n.get(f) || 0) + 1);
  }));
  return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]);
}
const per = f => { const u = f.unit === 'g' ? 100 : 1, m = FoodDB.calc(f, u); return `${f.unit === 'g' ? '每100g' : '每' + f.unit} · 碳水 ${m.c} · 蛋白 ${m.p} · ${m.kcal} kcal`; };
/* 记录饮食：选食物（搜索 / 分类 / 最近 / 说一句话，多选后一次添加）、自己填、AI 估算 */
function addSheet(mealKey, mode, preset) {
  const d = S.day;
  mealKey = mealKey || nearestMeal(d).key;
  let tab = mode === 'manual' || preset ? 'pick' : 'menu';
  const recent = recentFoods();
  let cat = recent.length ? '最近' : FoodDB.CATS[0], q = '';
  const sel = (preset || []).map(x => ({ f: x.f, amt: x.amt, ask: x.ask || '' }));
  const draw = () => {
    let body = '';
    if (tab === 'menu') body = `${mealChips(d, mealKey)}<div class="action-grid">${[['camera', I.camera, '拍照'], ['album', I.photo, '相册'], ['manual', I.pencil, '选食物']].map(([k, ic, n]) => `<button class="action" data-src="${k}"><span class="ai">${ic}</span>${n}</button>`).join('')}</div>`;
    else {
      body = `${mealChips(d, mealKey)}<div class="segmented"><button data-tab="pick" aria-pressed="${tab === 'pick'}">选食物</button><button data-tab="own" aria-pressed="${tab === 'own'}">自己填</button><button data-tab="text" aria-pressed="${tab === 'text'}">AI 估算</button></div>`;
      if (tab === 'pick') body += `<div class="fd-say"><input class="field-in" id="fd-say" placeholder="直接说：一根香蕉、两个鸡蛋、150g米饭" enterkeyhint="done"><button class="tbtn" id="fd-parse">识别</button></div>
        <div class="fd-sel" id="fd-sel" hidden></div>
        <div class="fd-search">${I.search}<input id="fd-q" placeholder="搜索表19 的食物" enterkeyhint="search" value="${esc(q)}"></div>
        <div class="chips fd-cats">${(recent.length ? ['最近'] : []).concat(FoodDB.CATS).map(c => `<button data-cat="${c}" aria-pressed="${c === cat && !q}">${c}</button>`).join('')}</div>
        <div class="list fd-list" id="fd-list"></div><p class="t-cap l3" style="text-align:center;margin:0">营养率来自表19、表17 B45；点一下加入，可以多选</p>
        <div class="fd-tray" id="fd-tray" hidden></div>`;
      if (tab === 'own') body += `<div class="list" style="background:var(--fill3)"><div class="frow"><label for="fo-n">名称</label><input id="fo-n" placeholder="例如：黄焖鸡"></div><div class="frow"><label for="fo-c">碳水 g</label><input id="fo-c" inputmode="decimal"></div><div class="frow"><label for="fo-p">蛋白质 g</label><input id="fo-p" inputmode="decimal"></div><div class="frow"><label for="fo-f">脂肪 g</label><input id="fo-f" inputmode="decimal"></div><div class="frow"><label for="fo-k">热量 kcal</label><input id="fo-k" inputmode="decimal" placeholder="空着自动算"></div></div><button class="pill ink wide" id="fo-ok">添加</button>`;
      if (tab === 'text') body += `<div class="list" style="background:var(--fill3)"><div class="frow stack"><textarea class="field-in" id="ft-t" style="height:96px;padding:10px 12px;font-family:var(--font)" placeholder="例如：一碗米饭，青椒肉丝半份，一个卤鸡腿去皮"></textarea></div></div><button class="pill ink wide" id="ft-ok">${I.sparkles}让 AI 估算</button><p class="t-cap l3" style="text-align:center;margin:0">表里没有的菜（比如黄焖鸡）用这个，需要联网和云端大模型</p>`;
    }
    sheet(`<h2>记录饮食</h2>${body}`, m => {
      const $q = s => m.querySelector(s);
      Kit.fadeEdges($q('#fm-meals'));
      m.querySelectorAll('[data-fm]').forEach(b => b.onclick = () => { mealKey = b.dataset.fm; Kit.haptic('light'); m.querySelectorAll('[data-fm]').forEach(x => x.setAttribute('aria-pressed', x === b)); const ok = $q('#fd-ok'); if (ok) ok.textContent = `添加 ${sel.length} 项到${mealOf(d, mealKey).name.replace(/（.*）/, '')}`; });
      m.querySelectorAll('[data-src]').forEach(b => b.onclick = () => { const k = b.dataset.src; if (k === 'manual') { tab = 'pick'; draw(); } else { close(); pickImage(mealKey, k === 'camera'); } });
      m.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
      if (tab === 'pick') bindPick(m);
      if (tab === 'own') $q('#fo-ok').onclick = () => { const n = $q('#fo-n').value.trim() || '手动记录', c = +$q('#fo-c').value || 0, p = +$q('#fo-p').value || 0, f = +$q('#fo-f').value || 0, k = +$q('#fo-k').value || (c * 4 + p * 4 + f * 9);
        if (!k) { toast('至少填一个数'); return; } saveEntry(d, mealOf(d, mealKey), { items: [{ name: n, grams: 0, carbs_g: Math.round(c), protein_g: Math.round(p), fat_g: Math.round(f), kcal: Math.round(k), category: '其他', note: '' }], source: 'manual', flags: [], advice: '' }); };
      if (tab === 'text') $q('#ft-ok').onclick = () => { const txt = $q('#ft-t').value.trim(); if (!txt) { toast('先写吃了什么'); return; } runAI(d, mealOf(d, mealKey), null, txt); };
    });
  };
  // 选食物：列表、已选托盘都只局部刷新，输入框不丢焦点
  const bindPick = m => {
    const $q = s => m.querySelector(s), listEl = $q('#fd-list'), trayEl = $q('#fd-tray');
    const has = f => sel.some(x => x.f === f);
    const drawList = () => {
      const items = q ? FoodDB.search(q) : cat === '最近' ? recent : FoodDB.search('', cat);
      let h = '', sub = null;
      items.slice(0, 120).forEach(f => {
        if (!q && cat !== '最近' && f.sub !== sub) { sub = f.sub; h += `<div class="fd-sub">${esc(sub)}</div>`; }
        h += `<button class="fd-row ${has(f) ? 'on' : ''}" data-fid="${f.id}"><span class="fd-n">${esc(f.n)}</span><span class="fd-m">${per(f)}</span><span class="fd-add">${has(f) ? I.check : I.plus}</span></button>`;
      });
      listEl.innerHTML = h || `<div class="fd-empty">表19 里没有“${esc(q)}”。可以用“自己填”，或者联网后用“AI 估算”。</div>`;
      listEl.querySelectorAll('[data-fid]').forEach(b => b.onclick = () => { const f = FoodDB.byId(b.dataset.fid), i = sel.findIndex(x => x.f === f); if (i >= 0) sel.splice(i, 1); else sel.push({ f, amt: FoodDB.defAmt(f), ask: '' }); Kit.haptic('light'); drawList(); drawTray(); });
    };
    const total = () => sel.reduce((t, x) => { const c = FoodDB.calc(x.f, +x.amt || 0); return { c: t.c + c.c, p: t.p + c.p, kcal: t.kcal + c.kcal }; }, { c: 0, p: 0, kcal: 0 });
    const sumText = () => { const t = total(); return `碳水 ${t.c}g · 蛋白质 ${t.p}g · <b>${t.kcal} kcal</b>`; };
    // 已选的放在上面（可以改分量），底部固定一条：合计 + 添加按钮
    const selEl = $q('#fd-sel');
    const drawTray = () => {
      selEl.hidden = trayEl.hidden = !sel.length;
      if (!sel.length) { selEl.innerHTML = trayEl.innerHTML = ''; return; }
      selEl.innerHTML = `<div class="fd-sel-h"><span>已选 ${sel.length} 项</span><button class="link" id="fd-clear">清空</button></div>${sel.map((x, i) => `<div class="fd-item ${x.ask ? 'ask' : ''}"><div class="fd-it"><b>${esc(x.f.n)}</b><span>${x.ask ? esc(x.ask) : esc(FoodDB.note(x.f))}</span></div>
        <div class="fd-amt"><button data-dn="${i}" aria-label="减少">−</button><input data-amt="${i}" inputmode="decimal" value="${x.amt == null ? '' : x.amt}" placeholder="?" aria-label="${esc(x.f.n)} 的${x.f.unit === 'g' ? '克数' : '数量'}"><em>${x.f.unit === 'g' ? 'g' : x.f.unit}</em><button data-up="${i}" aria-label="增加">+</button></div>
        <button class="fd-x" data-rm="${i}" aria-label="去掉 ${esc(x.f.n)}">×</button></div>`).join('')}`;
      trayEl.innerHTML = `<div class="fd-sum" id="fd-sum">${sumText()}</div><button class="pill ink wide" id="fd-ok">添加 ${sel.length} 项到${esc(mealOf(d, mealKey).name.replace(/（.*）/, ''))}</button>`;
      selEl.querySelectorAll('[data-amt]').forEach(inp => inp.oninput = () => { const x = sel[+inp.dataset.amt]; x.amt = inp.value === '' ? null : +inp.value; x.ask = ''; inp.closest('.fd-item').classList.remove('ask'); $q('#fd-sum').innerHTML = sumText(); });
      const bump = (i, dir) => { const x = sel[i], st = FoodDB.step(x.f); x.amt = Math.max(0, Math.round(((+x.amt || 0) + dir * st) * 100) / 100); x.ask = ''; Kit.haptic('light'); drawTray(); };
      selEl.querySelectorAll('[data-up]').forEach(b => b.onclick = () => bump(+b.dataset.up, 1));
      selEl.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => bump(+b.dataset.dn, -1));
      selEl.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { sel.splice(+b.dataset.rm, 1); drawList(); drawTray(); });
      $q('#fd-clear').onclick = () => { sel.length = 0; drawList(); drawTray(); };
      $q('#fd-ok').onclick = () => {
        const bad = sel.find(x => !(+x.amt > 0));
        if (bad) { toast(`请填“${bad.f.n}”的${bad.f.unit === 'g' ? '克数' : '数量'}`); const i = selEl.querySelector(`[data-amt="${sel.indexOf(bad)}"]`); if (i) i.focus(); return; }
        saveEntry(d, mealOf(d, mealKey), { items: sel.map(x => FoodDB.item(x.f, +x.amt)), source: 'manual', flags: [], advice: '' });
      };
    };
    $q('#fd-q').oninput = e => { q = e.target.value.trim(); m.querySelectorAll('[data-cat]').forEach(b => b.setAttribute('aria-pressed', !q && b.dataset.cat === cat)); drawList(); };
    m.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; q = ''; $q('#fd-q').value = ''; m.querySelectorAll('[data-cat]').forEach(x => x.setAttribute('aria-pressed', x === b)); Kit.haptic('light'); drawList(); listEl.scrollIntoView({ block: 'nearest' }); });
    // 说一句话：按规则拆成食物和分量（不用大模型，离线也能用）
    const parse = () => {
      const t = $q('#fd-say').value.trim(); if (!t) { toast('先写吃了什么'); return; }
      const r = FoodDB.parse(t);
      if (r.meal && mealsOf(d).some(x => x.key === r.meal)) { mealKey = r.meal; m.querySelectorAll('[data-fm]').forEach(x => x.setAttribute('aria-pressed', x.dataset.fm === mealKey)); }
      r.items.forEach(x => { const old = sel.find(y => y.f === x.f); if (old) { old.amt = x.amt == null ? old.amt : x.amt; old.ask = x.ask; } else sel.push({ f: x.f, amt: x.amt, ask: x.ask }); });
      if (r.items.length) { $q('#fd-say').value = ''; Kit.haptic('success'); }
      if (r.unknown.length) toast(`表19 里没有：${r.unknown.join('、')}，可以用“自己填”或“AI 估算”`);
      else if (!r.items.length) toast('没认出食物，换个说法试试，比如“两个鸡蛋”');
      drawList(); drawTray();
    };
    $q('#fd-parse').onclick = parse;
    $q('#fd-say').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); parse(); } };
    drawList(); drawTray();
  };
  draw();
}
async function pickImage(mealKey, camera) {
  // 有云端看图模型就用云端；没有（或没网）但下载了内置模型的看图组件，就在手机上识别
  const cloud = S.ai.key && S.ai.model && navigator.onLine, local = !cloud && LocalAI.prefs().enabled && await LocalAI.visionReady();
  if (!cloud && !local) { toast('先到“我的 → 大模型接口”设置，或在“我的 → 内置模型”下载看图组件'); return; }
  const d = S.day, m = mealOf(d, mealKey || nearestMeal(d).key), inp = $('#photoInput');
  if (camera) inp.setAttribute('capture', 'environment'); else inp.removeAttribute('capture');
  inp.value = '';
  inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { const data = await AI.compress(f); confirmPhoto(d, m, data, local, mealKey, camera); } catch (e) { toast(e.message); } };
  inp.click();
}
/* 拍完先确认：可以补一句说明（是什么、吃了多少、哪些没吃），识别时一起交给模型 */
const NOTE_CHIPS = ['只吃了一半', '米饭没吃完', '油比较多', '酱汁没吃', '肉是去皮的', '这是两人份'];
function confirmPhoto(d, m, data, local, mealKey, camera) {
  sheet(`<h2>${esc(m.name)}</h2><div class="sheet-sub">补充说明能让估算更准（可不填）</div>
    <img class="bigimg" src="${data}" alt="餐食照片">
    <textarea class="field-in" id="ph-note" rows="2" maxlength="120" placeholder="比如：鸡胸肉沙拉，酱汁另放没吃；米饭大概吃了一半" style="height:auto;padding:12px;line-height:1.5;resize:none"></textarea>
    <div class="chips" id="ph-chips">${NOTE_CHIPS.map(t => `<button data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <button class="pill ink wide" id="ph-go">开始识别</button><button class="pill glass wide" id="ph-re">${camera ? '重拍' : '换一张'}</button>`, mm => {
    const ta = mm.querySelector('#ph-note');
    mm.querySelectorAll('#ph-chips button').forEach(b => b.onclick = () => { const t = b.dataset.t; if (!ta.value.includes(t)) ta.value = (ta.value.trim() ? ta.value.trim().replace(/[，,；;。]$/, '') + '，' : '') + t; b.setAttribute('aria-pressed', 'true'); Kit.haptic('light'); });
    mm.querySelector('#ph-go').onclick = () => { const note = ta.value.trim(); if (local) runLocal(d, m, data, note); else runAI(d, m, data, null, note); };
    mm.querySelector('#ph-re').onclick = () => { close(); pickImage(mealKey, camera); };
  });
}
/* 离线拍照：内置图文模型列出“食物 克数”，按表19 算，打开“选食物”让你核对分量再添加 */
async function runLocal(d, meal, dataUrl, note) {
  sheet(`<h2>正在识别</h2><div class="sheet-sub">内置模型在手机上看照片，一般 10-60 秒</div><img class="bigimg" src="${dataUrl}" alt="餐食照片"><div class="progress"><i style="width:60%;animation:fade 1s infinite alternate"></i></div>`);
  try {
    const r = await LocalBrain.foodsFromPhoto(dataUrl, null, note);
    if (!r.items.length) { sheet(`<h2>没认出表19 里的食物</h2><p class="t-sub l2" style="text-align:center">${esc(r.raw || '照片看不清')}</p><button class="pill glass wide" id="x">用“选食物”自己选</button>`, mm => mm.querySelector('#x').onclick = () => addSheet(meal.key, 'manual')); return; }
    Kit.haptic('success');
    addSheet(meal.key, 'manual', r.items.map(x => ({ f: x.f, amt: x.amt || FoodDB.defAmt(x.f), ask: '照片估的分量，核对一下' })));
    if (r.unknown.length) toast(`表19 里没有：${r.unknown.join('、')}，可以用“自己填”补上`);
  } catch (err) { sheet(`<h2>识别失败</h2><p class="t-sub l2" style="text-align:center">${esc(err.message || err)}</p><button class="pill glass wide" id="x">好</button>`, mm => mm.querySelector('#x').onclick = close); }
}
async function runAI(d, meal, dataUrl, text, note) {
  if (!S.ai.key || !S.ai.model) { close(); toast('先到“我的 → 大模型接口”设置'); return; }
  sheet(`<h2>正在估算</h2><div class="sheet-sub">大模型${dataUrl ? '正在看照片' : '正在按描述'}估算分量，一般 5-30 秒</div><div class="progress"><i style="width:60%;animation:fade 1s infinite alternate"></i></div>`);
  try {
    const r = await AI.analyze(S.ai, dataUrl, { meal: meal.name, goal: S.plan.goal, target: { c: meal.c, p: meal.p }, eaten: intakeOf(d), day: targetOf(d), text, note });
    r.source = 'ai'; r.model = S.ai.model; if (note) r.note = note; Kit.haptic('success');
    showEntry({ ...r, meal: meal.key, mealName: meal.name }, -1, dataUrl);
  } catch (err) { sheet(`<h2>估算失败</h2><p class="t-sub l2" style="text-align:center">${esc(err.message || err)}</p><button class="pill glass wide" id="x">好</button>`, m => m.querySelector('#x').onclick = close); }
}
function recompute(f) { f.total = f.items.reduce((s, x) => ({ carbs_g: s.carbs_g + x.carbs_g, protein_g: s.protein_g + x.protein_g, fat_g: s.fat_g + x.fat_g, kcal: s.kcal + x.kcal }), { carbs_g: 0, protein_g: 0, fat_g: 0, kcal: 0 }); }
function saveEntry(d, meal, f) {
  const r = rec(d), before = badges().filter(b => b.got).length;
  f.id = f.id || uid(); f.meal = meal.key; f.mealName = meal.name; f.time = E.mt(new Date().getHours() * 60 + new Date().getMinutes());
  recompute(f); r.food = r.food || []; r.food.push(f);
  if (meal.key !== 'extra' && tasksFor(d).tasks.some(t => t.id === 'meal-' + meal.key)) r.done['meal-' + meal.key] = true;
  scoreDay(d); close(); Kit.haptic('success'); render(); toast('已记录'); celebrate(before);
}
function showEntry(f, idx, dataUrl) {
  const isNew = idx < 0, d = S.day;
  const draw = () => {
    recompute(f);
    const rows = f.items.map((it, i) => `<tr><td>${esc(it.name)}${it.category && it.category !== '其他' ? `<br><span class="t-cap l2">${esc(it.category)}</span>` : ''}</td><td class="n">${it.grams ? `<input class="field-in" style="width:58px;height:34px;text-align:right;padding:0 8px" data-g="${i}" value="${it.grams}" inputmode="decimal">` : '—'}</td><td class="n" data-c="${i}">${it.carbs_g}</td><td class="n" data-p="${i}">${it.protein_g}</td><td class="n" data-k="${i}">${it.kcal}</td></tr>`).join('');
    const tot = () => `<b class="num">${f.total.kcal} kcal</b> <span class="l2">· 碳水 ${f.total.carbs_g}g · 蛋白质 ${f.total.protein_g}g · 脂肪 ${f.total.fat_g}g</span>`;
    sheet(`<h2>${esc(f.mealName || '')}</h2>${f.source === 'ai' ? `<div class="sheet-sub">AI 估算 · 把握度 ${Math.round((f.confidence || 0) * 100)}%</div>` : ''}
      ${dataUrl ? `<img class="bigimg" src="${dataUrl}" alt="餐食照片">` : ''}${f.note ? `<div class="t-foot l2" style="text-align:center">你的说明：${esc(f.note)}</div>` : ''}
      <div class="tbl"><table><thead><tr><th>食物</th><th class="n">克</th><th class="n">碳水</th><th class="n">蛋白</th><th class="n">kcal</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="l2">没有识别到食物</td></tr>'}</tbody></table></div>
      <div class="t-sub" style="text-align:center" id="fs-tot">${tot()}</div>
      ${(f.flags || []).map(x => `<div class="note warn" style="background:var(--fill3)">${esc(x)}</div>`).join('')}${f.advice ? `<div class="note" style="background:var(--fill3)">${esc(f.advice)}</div>` : ''}
      ${isNew ? '<button class="pill ink wide" id="fs-save">保存</button>' : '<button class="pill glass wide" id="fs-del" style="color:var(--red)">删除这条</button>'}`, m => {
      // 改克数：只更新这一行和合计，不重画整个面板（原来会跳回顶部、键盘也会收起）；按第一次的每克营养算，改多少次都不累积误差
      m.querySelectorAll('[data-g]').forEach(inp => inp.oninput = () => {
        const i = +inp.dataset.g, it = f.items[i], g = +inp.value; if (!(g >= 0) || inp.value === '') return;
        if (!it._per) it._per = { carbs_g: it.carbs_g / it.grams, protein_g: it.protein_g / it.grams, fat_g: it.fat_g / it.grams, kcal: it.kcal / it.grams };
        ['carbs_g', 'protein_g', 'fat_g', 'kcal'].forEach(x => it[x] = Math.round(it._per[x] * g)); it.grams = Math.round(g);
        recompute(f);
        const q = sel => m.querySelector(sel);
        q(`[data-c="${i}"]`).textContent = it.carbs_g; q(`[data-p="${i}"]`).textContent = it.protein_g; q(`[data-k="${i}"]`).textContent = it.kcal; q('#fs-tot').innerHTML = tot();
        if (!isNew) save(d);
      });
      if (!isNew) m.querySelectorAll('[data-g]').forEach(inp => inp.onchange = () => render());
      const sv = m.querySelector('#fs-save'); if (sv) sv.onclick = () => saveEntry(d, mealOf(d, f.meal), f);
      const dl = m.querySelector('#fs-del'); if (dl) dl.onclick = () => { rec(d).food.splice(idx, 1); save(d); close(); render(); toast('已删除'); };
    });
  };
  draw();
}
window.Food = { view: viewFood, bind: bindFood, addSheet, saveEntry, mealOf, mealsOf };
})();
