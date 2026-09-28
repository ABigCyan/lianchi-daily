/* 饮食：摄入记录（拍照 / 相册 / 手动 / 文字 AI） */
(() => {
const { E, $, $$, esc, today, S, peek, rec, save, ICON, tasksFor, scoreDay, intakeOf, targetOf, burnOf, badges, celebrate, toast, sheet, close, head, bindHead, render, uid } = C;

/* 手动选食物用的清单：表19 营养率（按熟重/生重）+ 固定重量食物 */
const FOODS = (() => {
  const list = [];
  window.FOOD_RATES.carb.forEach(([n, r]) => list.push({ n, unit: 'g', c: r, p: 0, f: 0, src: '表19' }));
  const pf = { '熟瘦肉（一般）': 0.05, '熟瘦肉（柴感，如酱牛肉）': 0.05, '生瘦肉（家禽家畜）': 0.03, '生鱼虾': 0.02, '牛肉干/鸡肉干': 0.05, '豆腐': 0.05, '豆皮/千张': 0.2 };
  const pc = { '豆腐': 0.03, '豆皮/千张': 0.2, '牛肉干/鸡肉干': 0.1 };
  window.FOOD_RATES.protein.forEach(([n, r]) => list.push({ n, unit: 'g', c: pc[n] || 0, p: r, f: pf[n] || 0, src: '表19' }));
  list.push({ n: '鸡蛋', unit: '个', c: 0, p: 6, f: 5, src: '表19' });
  list.push({ n: '纯牛奶 250ml', unit: '盒', c: 12, p: 10, f: 9, src: '表19' });
  list.push({ n: '外卖饭盒米饭', unit: '盒', c: 100, p: 0, f: 0, src: '表17 B45' });
  list.push({ n: '吐司切片面包', unit: '片', c: 25, p: 0, f: 0, src: '表17 B45' });
  list.push({ n: '去皮全鸡腿', unit: '个', c: 0, p: 40, f: 8, src: '表17 B45' });
  list.push({ n: '去皮小鸡腿', unit: '个', c: 0, p: 15, f: 3, src: '表17 B45' });
  list.push({ n: '苹果/橙子/香蕉', unit: '个', c: 25, p: 0, f: 0, src: '表17 B45' });
  return list;
})();

function mealsOf(d) { return tasksFor(d).meals; }
function viewFood() {
  const d = S.day, r = peek(d) || {}, e = intakeOf(d), t = targetOf(d), b = burnOf(d), future = d > today();
  let h = head('饮食', d, `<span class="tag food">${S.plan.goal === 'cut' ? '减脂' : '增肌'}</span>`);
  const bar = (label, v, tg, cls) => `<div class="mbar ${cls || ''} ${v > tg * 1.1 ? 'over' : ''}"><div class="lbl"><span>${label}</span><span>${Math.round(v)} / ${tg}</span></div><div class="track"><i style="width:${tg ? Math.min(100, Math.round(v / tg * 100)) : 0}%"></i></div></div>`;
  h += `<div class="card hero"><div class="stats3"><div class="stat"><span class="k">已吃</span><span class="v">${e.kcal}<small>kcal</small></span></div><div class="stat"><span class="k">应吃</span><span class="v">${t.kcal}</span></div><div class="stat"><span class="k">今日消耗</span><span class="v">${b.total}</span></div></div>
    <div class="macro-bars">${bar('碳水 g', e.c, t.c)}${bar('蛋白质 g', e.p, t.p, 'p')}${bar('脂肪 g（参考，不细算）', e.f, t.f)}</div></div>`;
  if (!future) h += `<div class="btns"><button class="bigbtn" data-add="camera">${ICON.camera}拍照</button><button class="bigbtn" data-add="album">${ICON.image}相册导入</button><button class="bigbtn" data-add="manual">${ICON.pen}手动添加</button></div>`;
  const meals = mealsOf(d), foods = r.food || [];
  h += '<div class="section-title"><h2>各餐</h2></div><div class="card" style="gap:0">';
  meals.forEach(m => {
    const logged = foods.filter(f => f.meal === m.key);
    const lc = logged.reduce((s, f) => s + f.total.carbs_g, 0), lp = logged.reduce((s, f) => s + f.total.protein_g, 0);
    h += `<div class="food-item"><span class="stack" style="gap:0"><span class="fn">${esc(m.name)} <span class="xs faint num">${m.time}</span></span><span class="fm">目标 碳水 ${m.c}g · 蛋白质 ${m.p}g${logged.length ? ` ｜ 已记 ${lc}g · ${lp}g` : ''}</span></span>${future ? '' : `<button class="textbtn" data-meal="${m.key}">记录</button>`}</div>`;
    logged.forEach(f => { const i = foods.indexOf(f); h += `<button class="food-item" data-f="${i}" style="width:100%;text-align:left;padding-left:12px"><span class="stack" style="gap:0"><span class="fn sm">${esc(f.items.map(x => x.name).join('、') || '（无）')}</span><span class="fm">${f.source === 'ai' ? 'AI 估算' : '手动'} · 碳水 ${f.total.carbs_g} · 蛋白 ${f.total.protein_g} · 脂肪 ${f.total.fat_g}</span></span><span class="fk">${f.total.kcal}</span></button>`; });
  });
  const other = foods.filter(f => !meals.some(m => m.key === f.meal));
  other.forEach(f => { const i = foods.indexOf(f); h += `<button class="food-item" data-f="${i}" style="width:100%;text-align:left"><span class="stack" style="gap:0"><span class="fn sm">${esc(f.mealName || '加餐')}：${esc(f.items.map(x => x.name).join('、'))}</span><span class="fm">碳水 ${f.total.carbs_g} · 蛋白 ${f.total.protein_g} · 脂肪 ${f.total.fat_g}</span></span><span class="fk">${f.total.kcal}</span></button>`; });
  h += '</div><p class="xs faint" style="text-align:center">“应吃”已按原表预留了 10-20% 不自觉多吃的余量（表5 G19）；AI 估算只做参考</p>';
  return h;
}
function bindFood() {
  bindHead();
  $$('[data-add]').forEach(b => b.onclick = () => { const k = b.dataset.add; if (k === 'manual') addSheet(null, 'manual'); else pickImage(null, k === 'camera'); });
  $$('[data-meal]').forEach(b => b.onclick = () => addSheet(b.dataset.meal));
  $$('[data-f]').forEach(b => b.onclick = () => showEntry(peek(S.day).food[+b.dataset.f], +b.dataset.f));
}
function nearestMeal(d) {
  const meals = mealsOf(d), nm = new Date().getHours() * 60 + new Date().getMinutes();
  let best = meals[0]; meals.forEach(m => { if (Math.abs(E.tm(m.time) - nm) < Math.abs(E.tm(best.time) - nm)) best = m; });
  return best;
}
function mealSelect(d, sel) {
  const meals = mealsOf(d);
  const cur = sel || nearestMeal(d).key;
  return `<div class="field"><label for="fm-meal">哪一餐</label><select class="in" id="fm-meal">${meals.map(m => `<option value="${m.key}" ${m.key === cur ? 'selected' : ''}>${esc(m.name)}（碳水 ${m.c}g · 蛋白质 ${m.p}g）</option>`).join('')}<option value="extra" ${cur === 'extra' ? 'selected' : ''}>加餐</option></select></div>`;
}
function mealOf(d, key) { return mealsOf(d).find(m => m.key === key) || { key: 'extra', name: '加餐', c: 0, p: 0 }; }
/* 添加饮食：选餐 → 拍照 / 相册 / 手动 */
function addSheet(mealKey, mode) {
  const d = S.day;
  let tab = mode === 'manual' ? 'pick' : 'menu';
  const draw = () => {
    let body = '';
    if (tab === 'menu') body = `<div class="btns"><button class="bigbtn" data-src="camera">${ICON.camera}拍照</button><button class="bigbtn" data-src="album">${ICON.image}相册导入</button><button class="bigbtn" data-src="manual">${ICON.pen}手动</button></div>`;
    else {
      body = `<div class="seg"><button data-tab="pick" aria-pressed="${tab === 'pick'}">选食物</button><button data-tab="own" aria-pressed="${tab === 'own'}">自己填</button><button data-tab="text" aria-pressed="${tab === 'text'}">文字让 AI 估</button></div>`;
      if (tab === 'pick') body += `<div class="fgrid"><div class="field" style="grid-column:1/-1"><label for="fp-food">食物（营养率来自表19）</label><select class="in" id="fp-food">${FOODS.map((f, i) => `<option value="${i}">${esc(f.n)}${f.unit === 'g' ? '' : '（每' + f.unit + '）'}</option>`).join('')}</select></div>
          <div class="field"><label for="fp-amt" id="fp-unit">重量 g</label><input class="in num" id="fp-amt" inputmode="decimal" placeholder="200"></div><div class="field"><label>估算</label><div class="sm num" id="fp-prev" style="padding-top:8px">—</div></div></div><button class="btn food block" id="fp-ok">添加</button>`;
      if (tab === 'own') body += `<div class="field"><label for="fo-n">名称</label><input class="in" id="fo-n" placeholder="例如：食堂黄焖鸡"></div><div class="fgrid">
          <div class="field"><label for="fo-c">碳水 g</label><input class="in num" id="fo-c" inputmode="decimal"></div><div class="field"><label for="fo-p">蛋白质 g</label><input class="in num" id="fo-p" inputmode="decimal"></div>
          <div class="field"><label for="fo-f">脂肪 g</label><input class="in num" id="fo-f" inputmode="decimal"></div><div class="field"><label for="fo-k">热量 kcal（空着自动算）</label><input class="in num" id="fo-k" inputmode="decimal"></div></div><button class="btn food block" id="fo-ok">添加</button>`;
      if (tab === 'text') body += `<div class="field"><label for="ft-t">吃了什么</label><textarea class="in" id="ft-t" placeholder="例如：一碗米饭，青椒肉丝半份，一个卤鸡腿去皮"></textarea></div><button class="btn food block" id="ft-ok">让 AI 估算</button>`;
    }
    sheet(`<h2>记录饮食</h2>${mealSelect(d, mealKey)}${body}`, () => {
      const meal = () => { const k = $('#fm-meal').value; mealKey = k; return mealOf(d, k); };
      $$('[data-src]').forEach(b => b.onclick = () => { const k = b.dataset.src; if (k === 'manual') { tab = 'pick'; meal(); draw(); } else { const m = meal(); close(); pickImage(m.key, k === 'camera'); } });
      $$('[data-tab]').forEach(b => b.onclick = () => { meal(); tab = b.dataset.tab; draw(); });
      if (tab === 'pick') {
        const upd = () => { const f = FOODS[+$('#fp-food').value], a = +$('#fp-amt').value || 0; $('#fp-unit').textContent = f.unit === 'g' ? '重量 g' : `数量（${f.unit}）`; const k = f.unit === 'g' ? a : a; const c = f.c * k, p = f.p * k, fa = f.f * k; $('#fp-prev').textContent = a ? `碳水 ${Math.round(c)} · 蛋白 ${Math.round(p)} · ${Math.round(c * 4 + p * 4 + fa * 9)} kcal` : '—'; };
        $('#fp-food').onchange = upd; $('#fp-amt').oninput = upd; upd();
        $('#fp-ok').onclick = () => { const f = FOODS[+$('#fp-food').value], a = +$('#fp-amt').value; if (!(a > 0)) { toast('请填重量或数量'); return; }
          const it = { name: f.n + (f.unit === 'g' ? ` ${a}g` : ` ${a}${f.unit}`), grams: f.unit === 'g' ? a : 0, carbs_g: Math.round(f.c * a), protein_g: Math.round(f.p * a), fat_g: Math.round(f.f * a), category: '其他', note: f.src };
          it.kcal = it.carbs_g * 4 + it.protein_g * 4 + it.fat_g * 9; saveEntry(d, meal(), { items: [it], source: 'manual', flags: [], advice: '' }); };
      }
      if (tab === 'own') $('#fo-ok').onclick = () => { const n = $('#fo-n').value.trim() || '手动记录'; const c = +$('#fo-c').value || 0, p = +$('#fo-p').value || 0, f = +$('#fo-f').value || 0; const k = +$('#fo-k').value || (c * 4 + p * 4 + f * 9);
        if (!k) { toast('至少填一个数'); return; } saveEntry(d, meal(), { items: [{ name: n, grams: 0, carbs_g: Math.round(c), protein_g: Math.round(p), fat_g: Math.round(f), kcal: Math.round(k), category: '其他', note: '' }], source: 'manual', flags: [], advice: '' }); };
      if (tab === 'text') $('#ft-t') && ($('#ft-ok').onclick = () => { const txt = $('#ft-t').value.trim(); if (!txt) { toast('先写吃了什么'); return; } runAI(d, meal(), null, txt); });
    });
  };
  draw();
}
function pickImage(mealKey, camera) {
  if (!S.ai.key || !S.ai.model) { toast('请先在“我的 → 大模型接口”里填好接口并选择模型'); return; }
  const d = S.day, m = mealOf(d, mealKey || nearestMeal(d).key);
  const inp = $('#photoInput');
  if (camera) inp.setAttribute('capture', 'environment'); else inp.removeAttribute('capture');
  inp.value = '';
  inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { runAI(d, m, await AI.compress(f)); } catch (e) { toast(e.message); } };
  inp.click();
}
async function runAI(d, meal, dataUrl, text) {
  if (!S.ai.key || !S.ai.model) { close(); toast('请先在“我的 → 大模型接口”里填好接口并选择模型'); return; }
  sheet(`<h2>正在估算…</h2><p class="sm sub">大模型${dataUrl ? '正在看照片' : '正在按描述'}估算分量，一般 5-30 秒。</p>`);
  try {
    const e = intakeOf(d), t = targetOf(d);
    const r = await AI.analyze(S.ai, dataUrl, { meal: meal.name, goal: S.plan.goal, target: { c: meal.c, p: meal.p }, eaten: e, day: t, text });
    r.source = 'ai'; r.model = S.ai.model;
    showEntry({ ...r, meal: meal.key, mealName: meal.name }, -1, dataUrl);
  } catch (err) { sheet(`<h2>估算失败</h2><p class="sm">${esc(err.message || err)}</p><button class="btn ghost block" id="x">关闭</button>`, () => $('#x').onclick = close); }
}
function recompute(f) { f.total = f.items.reduce((s, x) => ({ carbs_g: s.carbs_g + x.carbs_g, protein_g: s.protein_g + x.protein_g, fat_g: s.fat_g + x.fat_g, kcal: s.kcal + x.kcal }), { carbs_g: 0, protein_g: 0, fat_g: 0, kcal: 0 }); }
function saveEntry(d, meal, f) {
  const r = rec(d), before = badges().filter(b => b.got).length;
  f.id = f.id || uid(); f.meal = meal.key; f.mealName = meal.name; f.time = E.mt(new Date().getHours() * 60 + new Date().getMinutes());
  recompute(f);
  r.food = r.food || []; r.food.push(f);
  if (meal.key !== 'extra' && tasksFor(d).tasks.some(t => t.id === 'meal-' + meal.key)) r.done['meal-' + meal.key] = true;
  scoreDay(d); close(); render(); toast('已记录'); celebrate(before);
}
function showEntry(f, idx, dataUrl) {
  const isNew = idx < 0, d = S.day;
  const draw = () => {
    recompute(f);
    const rows = f.items.map((it, i) => `<tr><td>${esc(it.name)}${it.category && it.category !== '其他' ? `<br><span class="xs sub">${esc(it.category)}</span>` : ''}</td><td class="n">${it.grams ? `<input class="in num" style="width:66px;padding:4px 6px" data-g="${i}" value="${it.grams}" inputmode="decimal">` : '—'}</td><td class="n">${it.carbs_g}</td><td class="n">${it.protein_g}</td><td class="n">${it.kcal}</td></tr>`).join('');
    sheet(`<div class="row between"><h2>${esc(f.mealName || '')}</h2>${f.source === 'ai' ? `<span class="xs sub">AI 估算 · 把握度 ${Math.round((f.confidence || 0) * 100)}%</span>` : ''}</div>
      ${dataUrl ? `<img class="bigimg" src="${dataUrl}" alt="餐食照片">` : ''}
      <div class="tbl"><table><thead><tr><th>食物</th><th class="n">克</th><th class="n">碳水</th><th class="n">蛋白</th><th class="n">kcal</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="sub">没有识别到食物</td></tr>'}</tbody></table></div>
      <div class="sm"><b>合计</b> <span class="num">碳水 ${f.total.carbs_g}g · 蛋白质 ${f.total.protein_g}g · 脂肪 ${f.total.fat_g}g · ${f.total.kcal} kcal</span></div>
      ${(f.flags || []).map(x => `<div class="note warn sm">${esc(x)}</div>`).join('')}${f.advice ? `<div class="note sm">${esc(f.advice)}</div>` : ''}
      ${f.items.some(it => it.grams) ? '<p class="xs faint">改克数会按比例重算</p>' : ''}
      ${isNew ? '<button class="btn food block" id="fs-save">保存</button>' : '<button class="btn ghost block" id="fs-del">删除这条</button>'}`, () => {
      $$('[data-g]').forEach(inp => inp.onchange = () => {
        const it = f.items[+inp.dataset.g], g = +inp.value; if (!(g >= 0) || !it.grams) return;
        const k = g / it.grams; ['carbs_g', 'protein_g', 'fat_g', 'kcal'].forEach(x => it[x] = Math.round(it[x] * k)); it.grams = Math.round(g);
        if (!isNew) save(d); draw(); if (!isNew) render();
      });
      const sv = $('#fs-save'); if (sv) sv.onclick = () => saveEntry(d, mealOf(d, f.meal), f);
      const dl = $('#fs-del'); if (dl) dl.onclick = () => { rec(d).food.splice(idx, 1); save(d); close(); render(); toast('已删除'); };
    });
  };
  draw();
}
window.Food = { view: viewFood, bind: bindFood, addSheet };
})();
