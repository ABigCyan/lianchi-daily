/*
 * 离线助手的“大脑”（内置小模型专用，和云端助手分开）：
 * 0.8B-2B 的小模型不会可靠地自己调用工具，改东西时还容易“顺手”改别的。所以离线时：
 * 1. 打招呼、记饮食、记身体数据、改安排、改训练（顺序、组数、次数、休息、换动作）、记住/忘掉，App 用规则直接听懂，不经过模型；
 * 2. 规则听不懂的修改才让模型输出 JSON 指令，并且逐条检查：字段和数字必须在原话里出现，和现在一样的改动直接丢掉；
 * 3. 问答：App 先检索套表原文，模型只用几句话组织语言（提示词见 LP）。
 * 所有修改都通过 Harness.call 调用和云端同一套工具，照样弹确认卡。
 */
window.LocalBrain = (() => {
const { E, S, today, DOW, dayInfo, tasksFor, targetOf, sessionItems } = C;
const { terms, srcOf, hiddenOf } = AITools;
function useLocal() { const p = LocalAI.prefs(); return p.enabled && (p.use === 'local' || (p.use === 'auto' && !navigator.onLine)); }
const EDIT_RE = /(改|调|换|删|去掉|不吃|不练|不做|加练|推迟|提前|挪|放到|移到|设成|设为|设置|取消|恢复|休息一天|别练|组|力竭|记住|忘掉|忘记)/;
/* 今天练到哪了：每个动作做完几组、还剩几组、填过的重量次数 */
function progressLine(d, items) {
  const r = C.peek(d) || {}, parts = [];
  let done = 0, all = 0;
  items.forEach(it => {
    const s = ((r.sets || {})[it.v] || []).slice(0, it.sets), n = s.filter(x => x && x.done).length;
    done += n; all += it.sets;
    const log = s.filter(x => x && (+x.w || +x.r)).map(x => `${+x.w ? x.w + 'kg×' : ''}${+x.r || '?'}次`).join('、');
    parts.push(`${it.ex.n} ${n >= it.sets ? '做完了' : n ? `做了 ${n} 组，还剩 ${it.sets - n} 组` : '还没做'}${log ? `（${log}）` : ''}`);
  });
  return done ? `训练进度：已做 ${done}/${all} 组。${parts.join('；')}。` : '';
}
function planBrief(d) {
  const pl = S.plan, info = dayInfo(d), { meals } = tasksFor(d), t = targetOf(d);
  const r0 = C.peek(d) || {}, started = r0.session || Object.values(r0.sets || {}).some(a => (a || []).some(x => x && (x.done || +x.w || +x.r)));
  const tr = pl.training && (info.lift || started || (r0.done && r0.done.lift)) ? sessionItems(d) : null;
  return [
    `今天 ${d}（周${DOW[E.dow(d)]}）是${info.lift ? '力训日' : '休息日'}${info.h ? '（' + info.h.name + '）' : ''}；目标：${pl.goal === 'cut' ? '减脂' : '增肌'}。`,
    `今天应吃：${t.kcal} kcal，碳水 ${t.c}g，蛋白质 ${t.p}g，脂肪 ${t.f}g（表5 E22-L23）。`,
    `今天各餐：${meals.map(m => `${m.time} ${m.name} 碳水${m.c}g 蛋白质${m.p}g`).join('；')}。`,
    tr ? `今天练：${tr.si.custom ? '自选部位' : tr.si.day.name.replace(/ /g, '')}，${tr.items.map(it => `${it.ex.n} ${it.sets}组×${it.reps}次（休息${it.rest}）`).join('、')}。` : (info.lift ? '' : '今天不练力训。'),
    tr ? progressLine(d, tr.items) : '',
    `饮食表：${pl.sheet.sheet}《${pl.sheet.name}》；训练：${pl.training ? pl.training.splitName : '不做力训'}。`,
    Memory.list().length ? '你告诉过我的：' + Memory.list().slice(-8).map(x => x.text).join('；') + '。' : '',
  ].filter(Boolean).join('\n');
}
/* ---------- 离线检索：先找套表问答的题目，再找正文；按用户自己的饮食表标出处 ---------- */
// 口语 → 套表里的说法（只扩展检索词，不改用户的问题）
const SYN = [
  [/自助|食堂|工作餐|单位饭/, ['食堂', '工作餐']], [/外卖/, ['外卖']], [/聚餐|下馆子|饭局|在外面吃|外食/, ['在外就餐', '外食']],
  [/平台期|不掉秤|体重不掉|瘦不下|不降/, ['体重不掉', '2周']], [/跑步|慢跑|快走|有氧/, ['有氧']], [/撸铁|力量训练|健身房练|力训/, ['力训']],
  [/喝酒|啤酒|白酒|红酒/, ['喝酒', '酒']], [/零食|夜宵|宵夜/, ['零食', '夜宵']], [/水果/, ['水果']], [/蛋白粉/, ['蛋白粉']],
  [/减肥|减重|瘦身/, ['减脂']], [/饿|饥饿/, ['饥饿', '饿']], [/熬夜|睡眠|睡不好/, ['睡眠']], [/月经|经期|姨妈/, ['经期']],
  [/肌酸/, ['肌酸']], [/便秘/, ['便秘']], [/停滞|不长肉|增不了/, ['增重', '不长']], [/作弊餐|欺骗餐|放纵/, ['欺骗餐', '放纵']],
];
// 太常见、不能说明问题主题的词：只靠这些词命中的，不算找到
const GENERIC = new Set('减脂 增肌 减肥 怎么 怎么办 什么 可以 能不 能吗 帮助 需要 应该 一下 如果 这个 那个 套表 吃什 吃的 吃吗 有用 我的 今天 训练 健身 好吗 多少'.split(' '));
// 虚词、口语字：含这些字的二字片段（如“能帮”“素能”）不拿来检索，免得“褪黑素能帮助减肥吗”误中“能帮助抗饿”
const STOP_CH = new Set('能帮助吗吃的了是有会要怎么样该可以我你他她在和与就都还也做用想让给对把呢吧啊哪些这那个么什为'.split(''));
function qTerms(q) {
  const base = terms(q).filter(w => w.length !== 2 || ![...w].some(ch => STOP_CH.has(ch))), extra = [];
  SYN.forEach(([re, ws]) => { if (re.test(q)) extra.push(...ws); });
  return [...new Set(base.concat(extra))];
}
const isHead = t => /^B:\s*\/?\s*\d+\.[^｜]{2,60}[？?]\s*\/?\s*$/.test(t);   // 问答的题目行（目录或正文标题）
const qTitle = t => t.replace(/^B:\s*\/?\s*\d+\./, '').replace(/[？?]\s*\/?\s*$/, '');
// 一问的完整回答：标题之后、下一个标题之前的所有行
function answerOf(sheet, headRow) {
  const rows = window.KB.rows.filter(x => x.s === sheet && x.r > headRow).sort((a, b) => a.r - b.r), out = [];
  for (const x of rows) { if (isHead(x.t)) break; out.push(x); if (out.length >= 4) break; }
  return out;
}
const srcLabel = r => srcOf(r).replace(/（.*$/, '');
function localRetrieve(q) {
  const ts = qTerms(q), key = ts.filter(w => !GENERIC.has(w) && w.length >= 2);
  const score = (text, ws) => ws.reduce((n, w) => n + (text.includes(w) ? (w.length >= 3 ? w.length * 2 : w.length) : 0), 0);
  const rows = window.KB.rows;
  // 1. 套表问答（表17、表18）的正文标题：题目和问题最像的那一问，整段回答都给模型
  let best = null;
  rows.filter(r => (r.s === '17' || r.s === '18') && isHead(r.t)).forEach(r => {
    const sc = score(qTitle(r.t), key);
    if (sc > 0 && (!best || sc > best.sc)) best = { r, sc };
  });
  const out = [], seen = new Set();
  if (best && best.sc >= 3) {
    // 目录里也有同样的题目：取正文里的那一个（后面才有回答）
    const heads = rows.filter(x => x.s === best.r.s && isHead(x.t) && qTitle(x.t) === qTitle(best.r.t)).sort((a, b) => b.r - a.r);
    const h = heads[0], ans = answerOf(h.s, h.r);
    if (ans.length) {
      const text = ans.map(x => x.t.replace(/^[A-Z]:\s*\/?\s*/, '')).join(' ');
      out.push({ src: `表${h.s} 第${ans[0].r}行`, title: qTitle(h.t), text: text.length > 1500 ? text.slice(0, 600) + ' …… ' + text.slice(-800) : text, main: true });
      ans.forEach(x => seen.add(x.s + ':' + x.r));
    }
  }
  // 2. 正文：只用有区分度的词打分；问答回答、训练计划说明、用户自己的饮食表加权
  const mine = S.plan && S.plan.sheet ? String(S.plan.sheet.sheet).replace('表', '') : '';
  const hits = rows.map(r => {
    if (seen.has(r.s + ':' + r.r) || r.t.length < 40 || isHead(r.t) || r.s === '0') return null;
    let sc = score(r.t.toLowerCase(), key);
    if (!sc) return null;
    if (r.s === '17' || r.s === '18') sc *= 1.3;
    if (['21', '22', '23', '24'].includes(r.s)) sc *= 1.2;
    if (mine && (r.s === mine || (r.o || '').split(',').includes(mine))) sc *= 1.2;
    return { r, sc };
  }).filter(Boolean).sort((a, b) => b.sc - a.sc);
  for (const { r } of hits) {
    if (out.length >= 3) break;
    const t = r.t.replace(/^[A-Z]:\s*\/?\s*/, '');
    out.push({ src: srcLabel(r), text: t.length > 520 ? windowAround(t, key) : t });
  }
  return { sources: out, found: out.length > 0, key };
}
// 长段落取关键词最密的一段（约 500 字）
function windowAround(t, key) {
  let bestA = 0, bestS = -1;
  for (let a = 0; a < t.length; a += 60) { const seg = t.slice(a, a + 500); const sc = key.reduce((n, w) => n + (seg.split(w).length - 1) * w.length, 0); if (sc > bestS) { bestS = sc; bestA = a; } }
  return (bestA ? '…' : '') + t.slice(bestA, bestA + 500) + (bestA + 500 < t.length ? '…' : '');
}
// 问的是自己的数字或安排时，才把“我的计划”给模型（否则小模型容易整段复述计划）
const PERSONAL_RE = /(还剩|剩下|做完|练完|进度|练到|刚才|前面几组|后面|接下来|今天|明天|昨天|这周|吃多少|该吃|几点|我的计划|我的目标|热量|卡路里|大卡|碳水|蛋白|脂肪|练什么|练哪|安排|摄入|消耗|几组|几次|体重多少|目标体重|分化|几天)/;
const LP = {
  // 问答：只根据资料，第一句给结论
  qa: personal => [
    '你是健身饮食 App 的离线助手。只根据下面给的【资料】' + (personal ? '和【我的计划】' : '') + '回答。',
    '要求：',
    '1. 第一句直接回答问题。然后最多列 3 条做法，每条一行，用“- ”开头。',
    '2. 资料里的数字（克、大卡、分钟、组数）原样照抄，不要换算，不要自己编数字。',
    '3. 资料里没有的内容不要说。资料和问题对不上，就只回答“套表里没有写这个”。',
    '4. 最后一行写“出处：”加资料方括号里的出处。',
    '5. 一共不超过 150 字。',
  ].join('\n'),
  // 修改指令：只输出 JSON；例子覆盖最常见的说法
  action: d => {
    const { tasks } = tasksFor(d), tm = E.addDays(d, 1);
    return [
      '把用户的话转换成 JSON 数组，只输出 JSON。只写用户明确要求改的内容，没提到的字段一律不要写。',
      '可用指令：',
      '{"action":"set_day_training","date":"YYYY-MM-DD","type":"rest"|"lift"|"auto"}',
      '{"action":"edit_timeline","date":"YYYY-MM-DD","op":"remove"|"restore"|"set_time","item_id":"…","time":"HH:MM"}',
      '{"action":"update_profile","changes":{"targetWeight":数字}} 或 {"weight":数字} 或 {"waist":数字} 或 {"goal":"cut"|"bulk"} 或 {"parts":{"legs":false}}（chest胸 back背 shoulder肩 arm手臂 legs腿 abs腹）',
      '听不懂就输出 []。',
      `今天 ${d}（周${DOW[E.dow(d)]}），明天 ${tm}。今天的安排：${tasks.map(t => `${t.id}=${t.title.replace(/（.*?）/g, '')}@${t.time}`).join('，')}`,
      '例子：',
      `今天不练了 → [{"action":"set_day_training","date":"${d}","type":"rest"}]`,
      `把夜宵删了 → [{"action":"edit_timeline","date":"${d}","op":"remove","item_id":"meal-snack"}]`,
      `晚饭挪到九点 → [{"action":"edit_timeline","date":"${d}","op":"set_time","item_id":"meal-dinner","time":"21:00"}]`,
      '目标体重定成68 → [{"action":"update_profile","changes":{"targetWeight":68}}]',
      '帮我写首诗 → []',
    ].join('\n');
  },
};
/* ---------- 规则：直接听懂的说法 ---------- */
const HELLO_RE = /^(你好|您好|嗨|哈喽|哈啰|hello|hi|hey|在吗|在不在|早上好|中午好|下午好|晚上好|早安|晚安)[呀啊哦！!。.~～\s]*$/i;
const THANKS_RE = /^(谢谢|多谢|感谢|thanks|thank you|好的|好|ok|嗯|收到)[呀啊了！!。.~～\s]*$/i;
const WHO_RE = /(你是谁|你能做什么|你会什么|怎么用|有什么功能|能帮我什么)/;
const LOCAL_HELP = '我是离线助手（内置小模型，不联网）。可以这样跟我说：\n- 记饮食：“午饭吃了一根香蕉和两个鸡蛋”；查热量：“200g 米饭多少热量”\n- 记身体数据：“今天体重 78.5，腰围 82”\n- 改安排：“今天不练了”“晚饭改到 21:00”“夜宵不吃了”\n- 改训练：“把卧推放到第一个”“高位下拉改成 4 组”“侧平举休息 60 秒”“杠铃卧推换成哑铃卧推”\n- 记住：“记住我左膝受过伤”；问套表：“减脂两周体重不掉怎么办”\n离线时我只按套表原文回答；拍照识别和定制分化要联网用云端助手。';
const FOOD_VERB = /(吃了|喝了|吃的|喝的|记录|记一下|记上|记成|记个|改成|换成|改为|帮我记)/;
const KCAL_Q = /(多少热量|多少卡|多少大卡|多少千卡|热量多少|热量是|卡路里|碳水多少|多少碳水|蛋白质多少|多少蛋白|营养)/;
function dateIn(q, d) {
  if (/大后天/.test(q)) return E.addDays(d, 3);
  if (/后天/.test(q)) return E.addDays(d, 2);
  if (/明天|明儿/.test(q)) return E.addDays(d, 1);
  const w = q.match(/(下|这|本)?(?:周|星期|礼拜)([一二三四五六日天])/);
  if (w) { const i = '一二三四五六日'.indexOf(w[2] === '天' ? '日' : w[2]); let x = E.addDays(d, (i - E.dow(d) + 7) % 7); if (w[1] === '下') x = E.addDays(x, x <= E.addDays(d, 6 - E.dow(d)) ? 7 : 0); return x; }
  return d;
}
// 时间：21:00、9点、九点半、晚上9点、下午三点一刻。没说上午下午时，按原来的时间就近取（晚饭“九点”是 21:00）
function timeIn(q, near) {
  let m = q.match(/(\d{1,2})[:：](\d{2})/);
  let h, mi = 0;
  if (m) { h = +m[1]; mi = +m[2]; }
  else {
    m = q.match(/(\d{1,2}|[零一二两三四五六七八九十]{1,3})\s*点\s*(半|一刻|三刻|(\d{1,2}|[零一二三四五六七八九十]{1,3})分?)?/);
    if (!m) return null;
    h = FoodDB.cnNum(m[1]); mi = m[2] === '半' ? 30 : m[2] === '一刻' ? 15 : m[2] === '三刻' ? 45 : m[3] ? FoodDB.cnNum(m[3]) : 0;
  }
  if (!(h >= 0 && h <= 24 && mi >= 0 && mi < 60)) return null;
  if (/(下午|晚上|傍晚|今晚|夜里)/.test(q) && h < 12) h += 12;
  else if (near && h < 12 && !/(上午|早上|凌晨|早晨)/.test(q)) { const t0 = E.tm(near), a = h * 60 + mi, b = a + 720, dist = x => Math.min(Math.abs(x - t0), 1440 - Math.abs(x - t0)); if (dist(b) < dist(a)) h += 12; }
  return String(h % 24).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
}
const PART_WORDS = [['chest', /胸/], ['back', /背/], ['shoulder', /肩/], ['arm', /手臂|胳膊|二头|三头|臂/], ['legs', /腿|臀|下肢/], ['abs', /腹|核心/]];
const ITEM_WORDS = [[/早饭|早餐|早上那顿/, 'meal-breakfast'], [/午饭|午餐|中饭|中午那顿/, 'meal-lunch'], [/晚饭|晚餐|晚上那顿/, 'meal-dinner'], [/练前餐|练前/, 'meal-pre'], [/练后餐|练后/, 'meal-post'], [/夜宵|宵夜|零食/, 'meal-snack']];
function findItem(q, d) {
  const { tasks } = tasksFor(d), hidden = hiddenOf(d).map(x => x.item_id);
  for (const [re, id] of ITEM_WORDS) if (re.test(q) && (tasks.some(t => t.id === id) || hidden.includes(id))) return { id, t: tasks.find(t => t.id === id) };
  // 其他卡片按标题找（力量训练、跑步、称重、睡觉……），标题去掉括号后出现在原话里
  const t = tasks.filter(x => { const n = x.title.replace(/（.*?）/g, '').trim(); return n.length >= 2 && q.includes(n); }).sort((a, b) => b.title.length - a.title.length)[0];
  if (t) return { id: t.id, t };
  if (/训练|力训|健身|撸铁/.test(q)) { const x = tasks.find(y => y.kind === 'train'); if (x) return { id: x.id, t: x }; }
  if (/睡觉|睡/.test(q)) { const x = tasks.find(y => y.kind === 'sleep'); if (x) return { id: x.id, t: x }; }
  return null;
}
function parseActions(text) {
  const t = LocalAI.clean(text).replace(/```json|```/g, '');
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  try { if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* 再试单个对象 */ }
  const c = t.indexOf('{'), e2 = t.lastIndexOf('}');
  try { if (c >= 0 && e2 > c) return [JSON.parse(t.slice(c, e2 + 1))]; } catch (e) { /* 不是 JSON */ }
  return null;
}
/* 食物热量：直接按表算，不用模型 */
function foodAnswer(items) {
  return items.map(x => {
    const f = x.f, a = x.amt || (f.unit === 'g' ? 100 : 1), m = FoodDB.calc(f, a);
    return `- **${f.n} ${a}${f.unit === 'g' ? 'g' : f.unit}**：碳水 ${m.c}g、蛋白质 ${m.p}g、脂肪 ${m.f}g，约 ${m.kcal} kcal（${f.src}）${x.amt ? '' : f.unit === 'g' ? '（没说分量，按 100g 算）' : ''}`;
  }).join('\n') + '\n热量按 碳水×4 + 蛋白质×4 + 脂肪×9 算。';
}
/* ---------- 看图（内置图文模型）：描述照片；饭菜照片按“食物 克数”列出来，再按表19 算 ---------- */
const VISION_SYS = '用中文一两句话说出照片里是什么。是健身器械就说名称和主要练哪里；是动作就说动作名称；是食物就说名称和大概分量。照片里没有的东西不要提，看不清就说看不清，不超过 60 字。';
const FOOD_SYS = '你在看一张照片，找出里面的食物。每种食物只写一行，格式是“食物名 克数g”，例如“米饭 200g”“鸡腿 1个”“西兰花 100g”。克数按熟重估。同一种食物不要重复写，最多写 8 行。照片里没有食物，就只回答“没有食物”。只输出这些行，不要别的话。';
async function describePhoto(q, image, signal) {
  const r = await LocalAI.chat([{ role: 'system', content: VISION_SYS }, { role: 'user', content: q || '这是什么？' }], { image, signal, maxTokens: 200, temperature: 0.2 });
  return { text: LocalAI.clean(r.text).trim(), stats: r.stats };
}
async function foodsFromPhoto(image, signal) {
  const r = await LocalAI.chat([{ role: 'system', content: FOOD_SYS }, { role: 'user', content: '照片里有哪些食物，各多少克？' }], { image, signal, maxTokens: 140, temperature: 0.1 });
  const raw = LocalAI.clean(r.text).trim(), items = [], unknown = [];
  if (/没有食物/.test(raw)) return { items, unknown, raw: '照片里没看到食物', stats: r.stats };
  const seen = new Set();
  raw.split(/\n+/).map(l => l.replace(/^[-*•\d.、\s]+/, '').trim()).filter(l => l && !seen.has(l.replace(/[\d.\sg克个]+$/i, '')) && seen.add(l.replace(/[\d.\sg克个]+$/i, ''))).slice(0, 8).forEach(l => {
    const p = FoodDB.parse(l);
    p.items.forEach(x => { if (!items.some(y => y.f === x.f)) items.push(x); });
    if (!p.items.length) { const n = l.replace(/\d+(\.\d+)?\s*(g|克)?/gi, '').trim(); if (n && n.length <= 12) unknown.push(n); }
  });
  return { items, unknown, raw, stats: r.stats };
}
/* ---------- 训练动作：按名字在动作库里找 ---------- */
const norm = s => String(s || '').replace(/（.*?）|\(.*?\)|\s/g, '');
// 在 text 里找动作名（最长的优先）；pool 是限定范围（比如今天的动作）
function findEx(text, pool) {
  const t = norm(text), list = (pool || Object.keys(window.EX)).map(v => ({ v, n: norm(window.EX[v].n) })).filter(x => x.n.length >= 2);
  const hit = list.filter(x => t.includes(x.n)).sort((a, b) => b.n.length - a.n.length)[0];
  if (hit) return hit.v;
  // 说了简称（“卧推”“下拉”）：今天的动作里只有一个名字包含它，就是它
  if (pool) { const short = list.filter(x => [...Array(Math.max(0, t.length - 1)).keys()].some(i => x.n.includes(t.slice(i, i + 2)) && /推|拉|蹲|举|划|弯|屈|飞|夹|卷|拱|撑|提/.test(t.slice(i, i + 2)) && t.slice(i, i + 2).length === 2)); if (short.length === 1) return short[0].v; }
  return null;
}
const scopeOf = q => /(以后|每次|一直|都这样|永久)/.test(q) ? 'always' : 'today';
/* 训练相关的说法 */
function trainEdits(q, d) {
  if (!S.plan.training) return [];
  const { items } = sessionItems(d), ids = items.map(x => x.v), out = [];
  const swap = q.match(/(.+?)(?:换成|换为|改成|替换成)(.+)/);
  if (swap) {
    const from = findEx(swap[1], ids), to = findEx(swap[2]);
    if (from && to && from !== to && !/组|次|秒|分钟|力竭/.test(swap[2])) return [{ tool: 'swap_exercise', args: { from_id: from, to_id: to } }];
  }
  const v = findEx(q, ids);
  if (!v) {
    const add = q.match(/(?:加|加上|添加|增加)(?:一个|个)?(.+)/);
    const nv = add && findEx(add[1]);
    if (nv && !ids.includes(nv)) return [{ tool: 'edit_training', args: { action: 'add', exercise_id: nv, sets: 3, scope: scopeOf(q) } }];
    return [];
  }
  const pos = q.match(/(?:放到|挪到|移到|调到|排到|放在|排在)(?:第\s*([一二三四五六七八九十\d]+)\s*个?|(最前面?|开头|第一个?|最后面?|末尾))/) || (/先练|第一个练|最先/.test(q) ? [null, null, '最前'] : null);
  if (pos) { const p = pos[1] ? FoodDB.cnNum(pos[1]) : /最后|末尾/.test(pos[2]) ? items.length : 1; out.push({ tool: 'reorder_training', args: { exercise_id: v, position: p, scope: scopeOf(q) } }); }
  const sets = q.match(/(?:改成|改为|调成|调到|加到|减到|做)\s*(\d+|[一二两三四五六七八])\s*组/);
  if (sets) out.push({ tool: 'edit_training', args: { action: 'set_sets', exercise_id: v, sets: FoodDB.cnNum(sets[1]), scope: scopeOf(q) } });
  const prm = {};
  const reps = q.match(/(\d+)\s*[-~到至]\s*(\d+)\s*(?:次|下)/); if (reps) prm.reps = `${reps[1]}-${reps[2]}`;
  const rest = q.match(/休息\s*(\d+(?:\.\d+)?|[一二两三四五半]+)\s*(秒|分钟|分)/); if (rest) prm.rest = rest[2] === '秒' ? `${rest[1]} 秒` : `${rest[1]} 分钟`;
  if (/(不要|不用|别|不)(做到|练到)?力竭/.test(q)) prm.to_failure = false; else if (/(做到|练到|可以)力竭/.test(q)) prm.to_failure = true;
  if (/恢复默认|恢复套表/.test(q)) prm.reset = true;
  if (Object.keys(prm).length) out.push({ tool: 'set_exercise_params', args: { exercise_id: v, ...prm } });
  if (!out.length && /(删掉|删除|去掉|不做|不练|不要)/.test(q)) out.push({ tool: 'edit_training', args: { action: 'remove', exercise_id: v, scope: scopeOf(q) } });
  return out;
}
/* 改安排、改资料、记身体数据、记忆的常见说法 → [{ tool, args }]。听不懂返回 [] */
function ruleEdits(q, d) {
  // AI 记忆
  const mem = q.match(/^(?:请|帮我|你)?(?:要)?(?:记住|记着|记得)[：:，,\s]*(.{2,})$/);
  if (mem) return [{ tool: 'remember', args: { text: mem[1].replace(/[。！!]+$/, '') } }];
  const fg = q.match(/(?:忘掉|忘记|别记|不用记)[：:，,\s]*(.{1,})/);
  if (fg) return [{ tool: 'forget', args: { text: fg[1] } }];
  const tr = trainEdits(q, d);
  if (tr.length) return tr;
  const out = [], day = dateIn(q, d), push = (tool, args) => out.push({ tool, args });
  // 身体数据（今天量的数）：体重、腰围等记到当天；说“资料/设置”才改资料
  const body = {};
  C.METRICS.forEach(m => { const re = new RegExp((m.id === 'weight' ? '(?<!目标)体重' : m.name) + '[^\\d目]{0,6}(\\d{1,3}(?:\\.\\d)?)\\s*(公斤|kg|斤|cm|厘米|%)?', 'i'); const x = q.match(re); if (x) body[m.id] = +x[1] * (x[2] === '斤' ? 0.5 : 1); });
  if (Object.keys(body).length && !/(资料|设置|目标)/.test(q)) push('log_body', { date: day, ...body });
  const partsOff = {}, partsOn = {};
  PART_WORDS.forEach(([id, re]) => { if (new RegExp('(不想练|不练|别练|去掉|不要练)[^，,。]{0,4}' + re.source).test(q)) partsOff[id] = false; if (new RegExp('(想练|要练|加上|恢复练)[^，,。]{0,4}' + re.source).test(q)) partsOn[id] = true; });
  if (Object.keys(partsOff).length || Object.keys(partsOn).length) push('update_profile', { changes: { parts: Object.assign({}, partsOn, partsOff) } });
  else if (/(恢复按计划|按原计划|恢复原来|恢复正常)/.test(q) && !findItem(q, d)) push('set_day_training', { date: day, type: 'auto' });
  else if (/(不练|休息一天|休息|不去练|不去健身|练不了|别练|不训练|歇一天)/.test(q) && !/(怎么|为什么|可以|能不能|吗|？|\?)/.test(q) && !/休息\s*\d/.test(q)) push('set_day_training', { date: day, type: 'rest' });
  else if (/(加练|补练|要去练|去练|练一次)/.test(q) && !/(怎么|为什么|吗|？|\?)/.test(q)) push('set_day_training', { date: day, type: 'lift' });
  // 时间线：改时间 / 删 / 恢复
  const it = findItem(q, day);
  if (it && !out.some(x => x.tool === 'set_day_training')) {
    const tm = timeIn(q, it.t && it.t.time), rel = q.match(/(推迟|延后|晚|提前|早)\s*(\d+(?:\.\d+)?|[一两二三四五六半]+)\s*(个)?\s*(小时|钟头|分钟|分)/);
    if (tm && /(改|挪|调|推迟|延后|提前|换|定|设)/.test(q)) push('edit_timeline', { date: day, action: 'set_time', item_id: it.id, time: tm, scope: 'day' });
    else if (rel && it.t) { const n = FoodDB.cnNum(rel[2]) * (/小时|钟头/.test(rel[4]) ? 60 : 1) * (/提前|早/.test(rel[1]) ? -1 : 1); push('edit_timeline', { date: day, action: 'set_time', item_id: it.id, time: E.mt(((E.tm(it.t.time) + n) % 1440 + 1440) % 1440), scope: 'day' }); }
    else if (/(不吃|去掉|删掉|删除|删了|取消|跳过|不要了|不需要)/.test(q)) push('edit_timeline', { date: day, action: 'remove', item_id: it.id, scope: 'day' });
    else if (/恢复|加回来|还原/.test(q)) push('edit_timeline', { date: day, action: 'restore', item_id: it.id, scope: 'day' });
  }
  // 改训练时间：这天没有训练卡片，或者说了“以后/每次”，就改资料里的开始训练时间
  if (/(训练|力训|练)/.test(q) && /(改|挪|调|换|定|设)/.test(q) && (!it || it.t && it.t.kind !== 'train' || /(以后|每次|都)/.test(q)) && !out.some(x => x.tool === 'set_day_training')) {
    const tm = timeIn(q, S.profile.liftTime);
    if (tm) { const i = out.findIndex(x => x.tool === 'edit_timeline'); if (i >= 0) out.splice(i, 1); push('update_profile', { changes: { liftTime: tm } }); }
  }
  // 资料
  const num = re => { const m = q.match(re); return m ? +m[1] * (m[2] && /斤/.test(m[2]) && !/公斤/.test(m[2]) ? 0.5 : 1) : null; };
  const ch = {};
  const tw = num(/目标体重[^\d]{0,6}(\d{2,3}(?:\.\d)?)\s*(公斤|kg|斤)?/i); if (tw) ch.targetWeight = tw;
  if (/(资料|设置)/.test(q)) { if (body.weight) ch.weight = body.weight; if (body.waist) ch.waist = body.waist; }
  if (/(目标|改成|换成|开始|转|要)[^，,。]{0,4}(减脂|减肥|减重)/.test(q)) ch.goal = 'cut';
  if (/(目标|改成|换成|开始|转|要)[^，,。]{0,4}增肌/.test(q)) ch.goal = 'bulk';
  if (Object.keys(ch).length) push('update_profile', { changes: ch });
  return out;
}
/* 检查小模型给的指令：字段要在原话里有依据，数字要在原话里出现，没变化的丢掉。返回 [{ tool, args }] */
function checkActions(list, q, d) {
  const nums = (q.match(/\d+(?:\.\d+)?/g) || []).map(Number), has = v => nums.includes(+v) || nums.includes(+v * 2);
  const ok = [];
  (Array.isArray(list) ? list : []).forEach(x => {
    if (!x || typeof x !== 'object') return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : d;
    if (x.action === 'set_day_training') {
      if ((x.type === 'rest' && /(不练|休息|练不了|别练|不训练|歇)/.test(q)) || (x.type === 'lift' && /(加练|补练|去练|要练)/.test(q)) || (x.type === 'auto' && /恢复|按计划|原计划/.test(q))) ok.push({ tool: 'set_day_training', args: { date, type: x.type } });
    } else if (x.action === 'edit_timeline') {
      const { tasks } = tasksFor(date), t = tasks.find(y => y.id === x.item_id);
      const w = ITEM_WORDS.find(([, id]) => id === x.item_id), named = w ? w[0].test(q) : !!(t && q.includes(t.title.replace(/（.*?）/g, '').trim()));
      if (!named) return;
      const args = { date, action: x.op, item_id: x.item_id, time: x.time, scope: 'day' };
      if (x.op === 'set_time') { if (t && /^\d{1,2}:\d{2}$/.test(x.time || '') && x.time.padStart(5, '0') !== t.time && (has(+x.time.split(':')[0]) || has(+x.time.split(':')[0] - 12) || /[点:：]/.test(q))) ok.push({ tool: 'edit_timeline', args }); }
      else if (x.op === 'remove') { if (t && /(不吃|去掉|删|取消|跳过|不要)/.test(q)) ok.push({ tool: 'edit_timeline', args }); }
      else if (x.op === 'restore') { if (/恢复|加回|还原/.test(q)) ok.push({ tool: 'edit_timeline', args }); }
    } else if (x.action === 'update_profile' && x.changes && typeof x.changes === 'object') {
      const c = {}, p = S.profile;
      const RULE = { targetWeight: [/目标体重|目标/, 1], weight: [/体重/, 1], waist: [/腰围/, 1], liftTime: [/训练|力训|练.{0,4}[点:：]/, 0], goal: [/减脂|减肥|减重|增肌/, 0], parts: [/练|胸|背|肩|臂|腿|腹/, 0] };
      Object.entries(x.changes).forEach(([k, v]) => {
        const r = RULE[k]; if (!r || !r[0].test(q)) return;
        if (r[1] && !has(v)) return;
        if (k === 'goal' && !((v === 'cut' && /减脂|减肥|减重/.test(q)) || (v === 'bulk' && /增肌/.test(q)))) return;
        if (k === 'parts') { const pv = {}; PART_WORDS.forEach(([id, re]) => { if (v && v[id] != null && re.test(q)) pv[id] = !!v[id]; }); if (Object.keys(pv).length) c.parts = pv; return; }
        if (JSON.stringify(v) !== JSON.stringify(p[k])) c[k] = v;
      });
      if (Object.keys(c).length) ok.push({ tool: 'update_profile', args: { changes: c } });
    }
  });
  return ok;
}
/* 一条条执行（每条都走确认卡），返回给用户看的结果 */
async function runActions(list, q, ctx) {
  const out = [], reason = '按你的话：' + q.slice(0, 40);
  for (const x of list) {
    const r = await Harness.call(x.tool, { ...x.args, reason }, ctx);
    if (x.tool === 'remember') { out.push(r.ok ? `✓ 记住了：${r.saved}` : '✗ ' + r.error); continue; }
    if (x.tool === 'forget') { out.push(r.ok ? `✓ 已忘掉：${(r.removed || []).join('；') || '这一条'}` : '✗ ' + r.error); continue; }
    out.push(r.ok ? '✓ ' + (r.done || (r.changed || []).join('；') || (r.now && typeof r.now === 'string' ? `${r.date} 现在是${r.now}` : '已修改')) : (/用户取消/.test(r.error || '') ? '已取消' : '✗ ' + (r.error || '没有改')));
  }
  return out;
}
return { progressLine, describePhoto, foodsFromPhoto, useLocal, EDIT_RE, PERSONAL_RE, planBrief, localRetrieve, LP, HELLO_RE, THANKS_RE, WHO_RE, LOCAL_HELP, FOOD_VERB, KCAL_Q, dateIn, timeIn, findItem, findEx, ruleEdits, trainEdits, checkActions, parseActions, runActions, foodAnswer };
})();
