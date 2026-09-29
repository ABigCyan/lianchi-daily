/* 饮食：圆环 + 记录按钮 + 各餐（拍照 / 相册 / 手动 / 文字 AI） */
(() => {
const { E, $, $$, esc, today, S, peek, rec, save, tasksFor, scoreDay, intakeOf, targetOf, burnOf, badges, celebrate, toast, sheet, close, head, bindHead, render, uid } = C;
const { I } = Kit;

/* 手动选食物：表19 全表（按原表大类分组）+ 表17 第5问的固定重量食物 */
const FOODS = (() => {
  const T = window.FOOD19, list = [];
  T.carb.filter(f => f.r != null).forEach(f => list.push({ g: f.cat, n: f.n, unit: 'g', c: f.r, p: 0, f: 0, src: f.src }));
  // 瘦肉的脂肪率按表17 第32行（瘦肉部分脂肪约 3%）；瘦肉干注意糖率低于 10%（表19 F101）
  T.protein.filter(f => f.r != null).forEach(f => list.push({ g: '瘦肉（' + f.cat + '）', n: f.n, unit: 'g', c: /肉干/.test(f.n) ? 0.1 : 0, p: f.r, f: 0.03, src: f.src }));
  T.mixed.filter(f => f.r != null).forEach(f => list.push({ g: '豆类（' + f.cat + '）', n: f.n, unit: 'g', c: f.c || 0, p: f.r, f: f.f || 0, src: f.src }));
  const FIX = '固定重量（表19、表17 第5问）';
  [['鸡蛋', '个', 0, 6, 5, '表19 C109'], ['纯牛奶 250ml', '盒', 12, 10, 9, '表19 C110'], ['代糖酸奶 200ml', '盒', 12, 10, 9, '表19 C111'],
   ['乳清蛋白粉', 'g', 0, 0.75, 0.05, '表19 C102'], ['外卖饭盒米饭', '盒', 100, 0, 0, '表17 B45'], ['吐司切片面包', '片', 25, 0, 0, '表17 B45'],
   ['去皮全鸡腿', '个', 0, 40, 8, '表17 B45'], ['去皮小鸡腿', '个', 0, 15, 3, '表17 B45'], ['去皮鸡翅根', '个', 0, 8, 2, '表17 B45'], ['去皮鸭腿', '个', 0, 20, 4, '表17 B45'],
   ['苹果/橙子/香蕉', '个', 25, 0, 0, '表17 B45']].forEach(([n, unit, c, p, f, src]) => list.push({ g: FIX, n, unit, c, p, f, src }));
  return list;
})();
function foodOptions() {
  const groups = [];
  FOODS.forEach((f, i) => { let g = groups.find(x => x.g === f.g); if (!g) groups.push(g = { g: f.g, items: [] }); g.items.push([f, i]); });
  return groups.map(g => `<optgroup label="${esc(g.g)}">${g.items.map(([f, i]) => `<option value="${i}">${esc(f.n)}${f.unit === 'g' ? '' : '（每' + f.unit + '）'}</option>`).join('')}</optgroup>`).join('');
}
function mealsOf(d) { return tasksFor(d).meals; }
function mealOf(d, key) { return mealsOf(d).find(m => m.key === key) || { key: 'extra', name: '加餐', c: 0, p: 0 }; }
function nearestMeal(d) { const meals = mealsOf(d), nm = new Date().getHours() * 60 + new Date().getMinutes(); let b = meals[0]; meals.forEach(m => { if (Math.abs(E.tm(m.time) - nm) < Math.abs(E.tm(b.time) - nm)) b = m; }); return b; }

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
function mealRow(d, sel) {
  const meals = mealsOf(d), cur = sel || nearestMeal(d).key;
  return `<div class="frow"><label for="fm-meal">餐次</label><select id="fm-meal">${meals.map(m => `<option value="${m.key}" ${m.key === cur ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}<option value="extra" ${cur === 'extra' ? 'selected' : ''}>加餐</option></select></div>`;
}
function addSheet(mealKey, mode) {
  const d = S.day;
  let tab = mode === 'manual' ? 'pick' : 'menu';
  const draw = () => {
    let body = '';
    if (tab === 'menu') body = `<div class="list" style="background:var(--fill3)">${mealRow(d, mealKey)}</div><div class="action-grid">${[['camera', I.camera, '拍照'], ['album', I.photo, '相册'], ['manual', I.pencil, '手动']].map(([k, ic, n]) => `<button class="action" data-src="${k}"><span class="ai">${ic}</span>${n}</button>`).join('')}</div>`;
    else {
      body = `<div class="segmented"><button data-tab="pick" aria-pressed="${tab === 'pick'}">选食物</button><button data-tab="own" aria-pressed="${tab === 'own'}">自己填</button><button data-tab="text" aria-pressed="${tab === 'text'}">文字 AI</button></div><div class="list" style="background:var(--fill3)">${mealRow(d, mealKey)}`;
      if (tab === 'pick') body += `<div class="frow"><label for="fp-food">食物</label><select id="fp-food">${foodOptions()}</select></div><div class="frow"><label for="fp-amt" id="fp-unit">重量 g</label><input id="fp-amt" inputmode="decimal" placeholder="200"></div><div class="frow"><span class="lbl l2">估算</span><span class="num l2" id="fp-prev" style="text-align:right">—</span></div><p class="t-foot l3" id="fp-note" style="padding:0 20px 12px;margin:0"></p></div><button class="pill ink wide" id="fp-ok">添加</button><p class="t-cap l3" style="text-align:center">营养率来自表19、表17 B45</p>`;
      if (tab === 'own') body += `<div class="frow"><label for="fo-n">名称</label><input id="fo-n" placeholder="例如：黄焖鸡"></div><div class="frow"><label for="fo-c">碳水 g</label><input id="fo-c" inputmode="decimal"></div><div class="frow"><label for="fo-p">蛋白质 g</label><input id="fo-p" inputmode="decimal"></div><div class="frow"><label for="fo-f">脂肪 g</label><input id="fo-f" inputmode="decimal"></div><div class="frow"><label for="fo-k">热量 kcal</label><input id="fo-k" inputmode="decimal" placeholder="空着自动算"></div></div><button class="pill ink wide" id="fo-ok">添加</button>`;
      if (tab === 'text') body += `<div class="frow stack"><textarea class="field-in" id="ft-t" style="height:96px;padding:10px 12px;font-family:var(--font)" placeholder="例如：一碗米饭，青椒肉丝半份，一个卤鸡腿去皮"></textarea></div></div><button class="pill ink wide" id="ft-ok">${I.sparkles}让 AI 估算</button>`;
    }
    sheet(`<h2>记录饮食</h2>${body}`, m => {
      const q = s => m.querySelector(s);
      const meal = () => { mealKey = q('#fm-meal').value; return mealOf(d, mealKey); };
      m.querySelectorAll('[data-src]').forEach(b => b.onclick = () => { const k = b.dataset.src; if (k === 'manual') { tab = 'pick'; meal(); draw(); } else { const x = meal(); close(); pickImage(x.key, k === 'camera'); } });
      m.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { meal(); tab = b.dataset.tab; draw(); });
      if (tab === 'pick') {
        const upd = () => { const f = FOODS[+q('#fp-food').value], a = +q('#fp-amt').value || 0; q('#fp-unit').textContent = f.unit === 'g' ? '重量 g' : `数量（${f.unit}）`; q('#fp-prev').textContent = a ? `碳水 ${Math.round(f.c * a)} · 蛋白 ${Math.round(f.p * a)} · ${Math.round(f.c * a * 4 + f.p * a * 4 + f.f * a * 9)} kcal` : '—'; const nt = q('#fp-note'); if (nt) { const x = window.FOOD19.carb.concat(window.FOOD19.protein, window.FOOD19.mixed).find(y => y.src === f.src); nt.textContent = (x && x.note ? x.note + ' ' : '') + `（${f.src}${f.unit === 'g' ? '，按' + (/生|干|粉/.test(f.n) ? '生重/干重' : '熟重') + '计' : ''}）`; } };
        q('#fp-food').onchange = upd; q('#fp-amt').oninput = upd; upd();
        q('#fp-ok').onclick = () => { const f = FOODS[+q('#fp-food').value], a = +q('#fp-amt').value; if (!(a > 0)) { toast('请填重量或数量'); return; }
          const it = { name: f.n + (f.unit === 'g' ? ` ${a}g` : ` ${a}${f.unit}`), grams: f.unit === 'g' ? a : 0, carbs_g: Math.round(f.c * a), protein_g: Math.round(f.p * a), fat_g: Math.round(f.f * a), category: '其他', note: f.src };
          it.kcal = it.carbs_g * 4 + it.protein_g * 4 + it.fat_g * 9; saveEntry(d, meal(), { items: [it], source: 'manual', flags: [], advice: '' }); };
      }
      if (tab === 'own') q('#fo-ok').onclick = () => { const n = q('#fo-n').value.trim() || '手动记录', c = +q('#fo-c').value || 0, p = +q('#fo-p').value || 0, f = +q('#fo-f').value || 0, k = +q('#fo-k').value || (c * 4 + p * 4 + f * 9);
        if (!k) { toast('至少填一个数'); return; } saveEntry(d, meal(), { items: [{ name: n, grams: 0, carbs_g: Math.round(c), protein_g: Math.round(p), fat_g: Math.round(f), kcal: Math.round(k), category: '其他', note: '' }], source: 'manual', flags: [], advice: '' }); };
      if (tab === 'text') q('#ft-ok').onclick = () => { const txt = q('#ft-t').value.trim(); if (!txt) { toast('先写吃了什么'); return; } runAI(d, meal(), null, txt); };
    });
  };
  draw();
}
function pickImage(mealKey, camera) {
  if (!S.ai.key || !S.ai.model) { toast('先到“我的 → 大模型接口”设置'); return; }
  const d = S.day, m = mealOf(d, mealKey || nearestMeal(d).key), inp = $('#photoInput');
  if (camera) inp.setAttribute('capture', 'environment'); else inp.removeAttribute('capture');
  inp.value = '';
  inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { runAI(d, m, await AI.compress(f)); } catch (e) { toast(e.message); } };
  inp.click();
}
async function runAI(d, meal, dataUrl, text) {
  if (!S.ai.key || !S.ai.model) { close(); toast('先到“我的 → 大模型接口”设置'); return; }
  sheet(`<h2>正在估算</h2><div class="sheet-sub">大模型${dataUrl ? '正在看照片' : '正在按描述'}估算分量，一般 5-30 秒</div><div class="progress"><i style="width:60%;animation:fade 1s infinite alternate"></i></div>`);
  try {
    const r = await AI.analyze(S.ai, dataUrl, { meal: meal.name, goal: S.plan.goal, target: { c: meal.c, p: meal.p }, eaten: intakeOf(d), day: targetOf(d), text });
    r.source = 'ai'; r.model = S.ai.model; Kit.haptic('success');
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
    const rows = f.items.map((it, i) => `<tr><td>${esc(it.name)}${it.category && it.category !== '其他' ? `<br><span class="t-cap l2">${esc(it.category)}</span>` : ''}</td><td class="n">${it.grams ? `<input class="field-in" style="width:70px;height:34px;text-align:right" data-g="${i}" value="${it.grams}" inputmode="decimal">` : '—'}</td><td class="n">${it.carbs_g}</td><td class="n">${it.protein_g}</td><td class="n">${it.kcal}</td></tr>`).join('');
    sheet(`<h2>${esc(f.mealName || '')}</h2>${f.source === 'ai' ? `<div class="sheet-sub">AI 估算 · 把握度 ${Math.round((f.confidence || 0) * 100)}%</div>` : ''}
      ${dataUrl ? `<img class="bigimg" src="${dataUrl}" alt="餐食照片">` : ''}
      <div class="tbl"><table><thead><tr><th>食物</th><th class="n">克</th><th class="n">碳水</th><th class="n">蛋白</th><th class="n">kcal</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="l2">没有识别到食物</td></tr>'}</tbody></table></div>
      <div class="t-sub" style="text-align:center"><b class="num">${f.total.kcal} kcal</b> <span class="l2">· 碳水 ${f.total.carbs_g}g · 蛋白质 ${f.total.protein_g}g · 脂肪 ${f.total.fat_g}g</span></div>
      ${(f.flags || []).map(x => `<div class="note warn" style="background:var(--fill3)">${esc(x)}</div>`).join('')}${f.advice ? `<div class="note" style="background:var(--fill3)">${esc(f.advice)}</div>` : ''}
      ${isNew ? '<button class="pill ink wide" id="fs-save">保存</button>' : '<button class="pill glass wide" id="fs-del" style="color:var(--red)">删除这条</button>'}`, m => {
      m.querySelectorAll('[data-g]').forEach(inp => inp.onchange = () => {
        const it = f.items[+inp.dataset.g], g = +inp.value; if (!(g >= 0) || !it.grams) return;
        const k = g / it.grams; ['carbs_g', 'protein_g', 'fat_g', 'kcal'].forEach(x => it[x] = Math.round(it[x] * k)); it.grams = Math.round(g);
        if (!isNew) { save(d); render(); } draw();
      });
      const sv = m.querySelector('#fs-save'); if (sv) sv.onclick = () => saveEntry(d, mealOf(d, f.meal), f);
      const dl = m.querySelector('#fs-del'); if (dl) dl.onclick = () => { rec(d).food.splice(idx, 1); save(d); close(); render(); toast('已删除'); };
    });
  };
  draw();
}
window.Food = { view: viewFood, bind: bindFood, addSheet };
})();
