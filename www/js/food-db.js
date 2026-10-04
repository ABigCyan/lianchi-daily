/*
 * 食物库：表19 全表 + 表17 第5问的固定重量食物。手动选食物、助手（云端和离线）都用这一份。
 * parse() 把“午饭吃了一根香蕉和两个鸡蛋”这样的话拆成食物和分量：完全按规则匹配，不用大模型，离线也准。
 */
window.FoodDB = (() => {
const T = window.FOOD19;
const FIX = '固定重量';
/* list：每一项 { id, cat 分类, sub 原表小类, n 名称, unit 单位（g 或 个/盒/片…）, c/p/f 每单位的碳水/蛋白质/脂肪克数, src 出处 } */
const list = [];
const push = (cat, sub, n, unit, c, p, f, src) => list.push({ id: 'f' + list.length, cat, sub, n, unit, c, p, f, src });
T.carb.filter(x => x.r != null).forEach(x => push(x.cat === '水果' ? '水果' : '主食', x.cat, x.n, 'g', x.r, 0, 0, x.src));
// 瘦肉的脂肪率按表17 第32行（瘦肉部分脂肪约 3%）；瘦肉干注意糖率低于 10%（表19 F101）
T.protein.filter(x => x.r != null).forEach(x => push('瘦肉', x.cat, x.n, 'g', /肉干/.test(x.n) ? 0.1 : 0, x.r, 0.03, x.src));
T.mixed.filter(x => x.r != null).forEach(x => push('蛋奶豆', x.cat, x.n, 'g', x.c || 0, x.r, x.f || 0, x.src));
[['鸡蛋', '个', 0, 6, 5, '表19 C109', '蛋奶豆'], ['纯牛奶 250ml', '盒', 12, 10, 9, '表19 C110', '蛋奶豆'], ['代糖酸奶 200ml', '盒', 12, 10, 9, '表19 C111', '蛋奶豆'],
 ['乳清蛋白粉', 'g', 0, 0.75, 0.05, '表19 C102', '瘦肉'], ['外卖饭盒米饭', '盒', 100, 0, 0, '表17 B45', '主食'], ['吐司切片面包', '片', 25, 0, 0, '表17 B45', '主食'],
 ['去皮全鸡腿', '个', 0, 40, 8, '表17 B45', '瘦肉'], ['去皮小鸡腿', '个', 0, 15, 3, '表17 B45', '瘦肉'], ['去皮鸡翅根', '个', 0, 8, 2, '表17 B45', '瘦肉'], ['去皮鸭腿', '个', 0, 20, 4, '表17 B45', '瘦肉'],
 ['苹果/橙子/香蕉', '个', 25, 0, 0, '表17 B45', '水果']].forEach(([n, unit, c, p, f, src, cat]) => push(cat, FIX, n, unit, c, p, f, src));
const CATS = ['主食', '瘦肉', '蛋奶豆', '水果'];
const byName = n => list.find(x => x.n === n);
const byId = id => list.find(x => x.id === id);
const short = n => n.replace(/（[^）]*）/g, '');

/* 默认分量：按克的食物先填 100g（蛋白粉 30g），按个/盒/片的填 1 */
const defAmt = f => f.unit === 'g' ? (/蛋白粉/.test(f.n) ? 30 : 100) : 1;
const step = f => f.unit === 'g' ? (f.c >= 0.5 || f.p >= 0.5 ? 10 : 25) : 1;
function calc(f, a) {
  const c = Math.round(f.c * a), p = Math.round(f.p * a), fat = Math.round(f.f * a);
  return { c, p, f: fat, kcal: c * 4 + p * 4 + fat * 9 };
}
/* 记录用的条目（和拍照估算的格式一样） */
function item(f, a) {
  const m = calc(f, a);
  return { name: f.n + (f.unit === 'g' ? ` ${a}g` : ` ${a}${f.unit}`), grams: f.unit === 'g' ? a : 0, carbs_g: m.c, protein_g: m.p, fat_g: m.f, kcal: m.kcal, category: f.cat, note: f.src, fid: f.id, amt: a };
}
function note(f) {
  const x = T.carb.concat(T.protein, T.mixed).find(y => y.src === f.src && y.n === f.n);
  return (x && x.note ? x.note + ' ' : '') + `（${f.src}${f.unit === 'g' ? '，按' + (/生|干|粉/.test(f.n) ? '生重/干重' : '熟重') + '计' : ''}）`;
}

/* ---------- 搜索 ---------- */
// 口语叫法 → 表里的名称。count：说“一个/一根”时用的固定重量食物；gram：说克数时用的按克食物
const ALIAS = [
  [/蛋白粉|乳清/, { gram: '乳清蛋白粉' }],
  [/香蕉/, { count: '苹果/橙子/香蕉', gram: '香蕉' }], [/苹果/, { count: '苹果/橙子/香蕉', gram: '苹果' }], [/橙子|橙/, { count: '苹果/橙子/香蕉', gram: '橙子' }],
  [/盒饭|外卖饭|饭盒/, { count: '外卖饭盒米饭', gram: '米饭（一般）' }], [/米饭|白饭|大米饭/, { count: '外卖饭盒米饭', gram: '米饭（一般）', countUnits: /盒/ }],
  [/鸡蛋|水煮蛋|煮蛋|茶叶蛋|荷包蛋|蛋/, { count: '鸡蛋' }], [/牛奶|纯奶/, { count: '纯牛奶 250ml', ml: 250 }], [/酸奶/, { count: '代糖酸奶 200ml', ml: 200 }],
  [/吐司|面包片|切片面包/, { count: '吐司切片面包', gram: '切片面包' }], [/面包/, { count: '吐司切片面包', gram: '切片面包、碱水面包' }],
  [/小鸡腿/, { count: '去皮小鸡腿' }], [/鸡翅根|翅根/, { count: '去皮鸡翅根' }], [/鸭腿/, { count: '去皮鸭腿' }], [/鸡腿/, { count: '去皮全鸡腿' }],
  [/三文鱼|金枪鱼/, { gram: '瘦肉（三文鱼/金枪鱼）' }], [/牛肉干|肉干|肉脯/, { gram: '瘦肉干' }],
  [/生(?:鸡胸|鸡肉|牛肉|猪肉|里脊|肉)/, { gram: '瘦肉（家禽家畜生肉）' }], [/生(?:鱼|虾)/, { gram: '瘦肉（鱼虾生肉）' }],
  [/鸡胸|鸡肉|牛肉|牛排|猪肉|里脊|瘦肉|羊肉|鸭肉|鱼肉|鱼|虾|肉/, { gram: '瘦肉（一般的熟肉）' }],
  [/馒头|花卷|馍/, { gram: '馒头/花卷/馍/馕' }], [/米线/, { gram: '米线（熟）' }], [/肠粉/, { gram: '肠粉（熟）' }], [/粽子/, { gram: '粽子' }],
  [/粥|稀饭/, { gram: '米粥（一般）' }], [/挂面/, { gram: '挂面（生）' }], [/意面|意大利面/, { gram: '意面（熟）' }], [/凉面/, { gram: '凉面（熟）' }], [/面条|面/, { gram: '细面（熟）' }],
  [/烙饼|卷饼|饼/, { gram: '卷饼/烙饼/馕（熟）' }], [/烤红薯|烤地瓜/, { gram: '红薯（烤）' }], [/红薯|地瓜/, { gram: '红薯（生/蒸煮）' }], [/烤土豆/, { gram: '土豆（烤）' }], [/土豆/, { gram: '土豆（生/蒸煮）' }],
  [/糯玉米/, { gram: '糯玉米（生/蒸煮）' }], [/玉米/, { gram: '甜玉米（生/蒸煮）' }], [/燕麦/, { gram: '速食燕麦片（生）' }], [/南瓜/, { gram: '贝贝南瓜' }], [/山药/, { gram: '山药（生/蒸煮）' }],
  [/豆腐/, { gram: '豆腐' }], [/豆浆/, { gram: '豆浆' }], [/毛豆|青豆/, { gram: '鲜黄豆/毛豆/青豆' }], [/千张|豆皮/, { gram: '豆皮/千张' }], [/小番茄|圣女果/, { gram: '圣女果（小番茄）' }], [/番茄|西红柿/, { gram: '西红柿（大番茄）' }],
];
function search(q, cat) {
  q = String(q || '').trim();
  let out = list;
  if (cat && cat !== '全部') out = out.filter(f => f.cat === cat);
  if (!q) return out;
  const hits = new Map();
  out.forEach(f => { const n = f.n; if (n.includes(q)) hits.set(f, n.startsWith(q) || short(n) === q ? 3 : 2); else if ([...q].every(ch => n.includes(ch))) hits.set(f, 1); });
  ALIAS.forEach(([re, a]) => { if (re.test(q)) [a.count, a.gram].filter(Boolean).forEach(n => { const f = byName(n); if (f && (!cat || cat === '全部' || f.cat === cat)) hits.set(f, Math.max(hits.get(f) || 0, 2.5)); }); });
  return [...hits.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
}

/* ---------- 把一句话拆成食物和分量 ---------- */
const CN = { 零: 0, 一: 1, 二: 2, 两: 2, 俩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function cnNum(s) {
  if (/^\d+(\.\d+)?$/.test(s)) return +s;
  if (s === '半') return 0.5;
  let half = 0; if (/半$/.test(s) && s.length > 1) { half = 0.5; s = s.slice(0, -1); }
  let n = 0, cur = 0;
  for (const ch of s) {
    if (ch in CN) cur = CN[ch];
    else if (ch === '十') { n += (cur || 1) * 10; cur = 0; }
    else if (ch === '百') { n += (cur || 1) * 100; cur = 0; }
    else return NaN;
  }
  return n + cur + half;
}
const NUM = '(\\d+(?:\\.\\d+)?|[零一二两俩三四五六七八九十百]+半?|半)';
const UNIT = '(千克|公斤|kg|斤|两|克|g|毫升|ml|个|根|只|颗|盒|瓶|袋|片|勺|碗|杯|份|块|串|把|条|根)';
const QTY = new RegExp(NUM + '\\s*' + UNIT + '(半)?', 'i');          // 带单位的分量：“两个”“150g”“半碗”
const QTY_D = /(\d+(?:\.\d+)?)/;                            // 只有数字：“鸡蛋 2”（不认中文数字，免得“三文鱼”被当成 3）
const MEALS = [[/早饭|早餐|早上|早晨/, 'breakfast'], [/午饭|午餐|中饭|中午/, 'lunch'], [/晚饭|晚餐|晚上/, 'dinner'], [/练前/, 'pre'], [/练后/, 'post'], [/夜宵|宵夜|零食|加餐/, 'snack']];
function mealOf(text) { for (const [re, k] of MEALS) if (re.test(text)) return k; return null; }
// 不是食物的话（指令、问法）先去掉，免得“完成”“计算”被当成食物
const NOISE = /(帮我|帮忙|把|今天|明天|昨天|的|改成|换成|记成|记录|记一下|记上|记|吃了|吃的|喝了|喝的|吃|喝|我|并且|然后|再|顺便|计算|算一下|算算|热量|卡路里|多少|并|完成|打卡|标记|一下|吧|呢|啊|了|早饭|早餐|早上|早晨|午饭|午餐|中饭|中午|晚饭|晚餐|晚上|练前餐?|练后餐?|夜宵|宵夜|零食|加餐)/g;
function resolve(seg) {
  const qm = seg.match(QTY) || seg.match(QTY_D), amount = qm ? cnNum(qm[1]) + (qm[3] ? 0.5 : 0) : null, unit = qm && qm[2] ? qm[2].toLowerCase() : '';
  const name = qm ? seg.replace(qm[0], '').trim() : seg;
  const aliasHit = ALIAS.find(([re]) => re.test(seg));
  let f = null, amt = null, ask = '';
  const isGram = /^(克|g|千克|公斤|kg|斤|两)$/.test(unit), isMl = /^(毫升|ml)$/.test(unit);
  const grams = isGram ? amount * (/千克|公斤|kg/.test(unit) ? 1000 : unit === '斤' ? 500 : unit === '两' ? 50 : 1) : null;
  // 写了表里的完整名称（比如“米饭（偏硬）150g”）就直接用
  const exact = list.filter(x => x.n.length >= 2 && seg.includes(x.n)).sort((a, b) => b.n.length - a.n.length)[0];
  if (exact && (grams != null || exact.unit !== 'g' || !aliasHit || !aliasHit[1].count)) { f = exact; if (f.unit === 'g') { amt = grams; if (amt == null) ask = '请填克数'; } else amt = amount || 1; }
  else if (aliasHit) {
    const a = aliasHit[1];
    if (isGram && a.gram) { f = byName(a.gram); amt = grams; }
    else if (isMl && a.ml) { f = byName(a.count); amt = Math.round(amount / a.ml * 100) / 100; }
    else if (a.count && (!a.countUnits || a.countUnits.test(unit) || !a.gram)) { f = byName(a.count); amt = amount || 1; if (unit && !/个|根|只|颗|盒|瓶|片|袋|块|条/.test(unit)) ask = `“${unit}”换算不了，按 ${amt}${f.unit} 记，请核对`; }
    else if (a.gram) { f = byName(a.gram); if (isGram) amt = grams; else { amt = null; ask = amount ? `${amount}${unit || ''}有多少克？请填克数` : '请填克数'; } }
  }
  if (!f) {
    // 直接写了表里的名称（比如“米饭（偏硬）150g”“荔枝”）
    const clean = name.replace(NOISE, '').trim();
    if (clean.length >= 1) { const hit = search(clean)[0]; if (hit && (hit.n.includes(clean) || clean.includes(short(hit.n)))) f = hit; }
    if (f) { if (f.unit === 'g') { amt = grams; if (amt == null) ask = '请填克数'; } else amt = amount || 1; }
  }
  if (!f) return null;
  return { f, amt: amt == null ? null : Math.round(amt * 100) / 100, ask };
}
/* parse(text) → { meal: 'lunch' | null, items: [{f, amt, ask}], unknown: ['没认出来的词'], replace: 是否“改成” } */
function parse(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const meal = mealOf(t), replace = /改成|换成|改为|记成/.test(t);
  let body = t;
  const k = body.search(/改成|换成|改为|记成|吃了|喝了|吃的|喝的|记录|记一下|记上/);
  if (k >= 0) body = body.slice(k).replace(/^(改成|换成|改为|记成|吃了|喝了|吃的|喝的|记录|记一下|记上)/, '');
  body = body.replace(/并且.*$|然后.*$|顺便.*$|，?(?:并)?(?:帮我)?(?:计算|算一下|算算|完成|打卡).*$/, '');
  // 先按标点和“和/还有”分，再按空格分；只有分量的片段（“鸡蛋 2个”里的“2个”）并回前一个
  const raw = body.split(/[，,、；;。+＋]|和|跟|加上|还有|以及|外加|配/).flatMap(s => s.trim().split(' ')).filter(Boolean), segs = [];
  const onlyQty = new RegExp('^(?:' + NUM + '\\s*' + UNIT + '?|\\d+(?:\\.\\d+)?)$', 'i');
  // “鸡蛋 2个”：分量并回前一个；“500ml 牛奶”：前一个已经有分量（或没有前一个）就并到后一个
  const hasQty = x => QTY.test(x) || QTY_D.test(x);
  let pending = '';
  raw.forEach(s => {
    if (onlyQty.test(s)) { if (segs.length && !hasQty(segs[segs.length - 1])) segs[segs.length - 1] += s; else pending += s; return; }
    segs.push(pending + s); pending = '';
  });
  const items = [], unknown = [];
  segs.forEach(s => {
    const r = resolve(s);
    if (r) items.push(r); else { const w = s.replace(new RegExp(QTY.source, 'gi'), '').replace(NOISE, '').trim(); if (w.length >= 1 && w.length <= 12) unknown.push(w); }
  });
  return { meal, items, unknown, replace };
}
return { list, CATS, byId, byName, search, defAmt, step, calc, item, note, parse, mealOf, short, cnNum };
})();
