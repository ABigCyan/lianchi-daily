/*
 * 助手：只按《健身Excel超级套表》回答，可以查表、看你的计划和记录，也可以帮你改计划（每次修改都要你点确认）。
 * 知识库 data-kb.js 由 tools/build-kb.py 从原表生成，第一次打开助手时才加载。
 */
window.Assistant = (() => {
const { E, $, $$, esc, S, LS, today, DOW, toast, render, peek, rec, save, saveCustom, training, sessionInfo, sessionItems, LIB, dayInfo, tasksFor, setTaskTime, scoreDay, uid, TYPE,
  burnOf, intakeOf, targetOf, allDays } = C;
const { I } = Kit;

/* ---------- 知识库 ---------- */
let kbReady = null;
function loadKB() {
  if (window.KB) return Promise.resolve();
  if (!kbReady) kbReady = new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'js/data-kb.js'; s.onload = ok; s.onerror = () => { kbReady = null; bad(new Error('知识库加载失败')); }; document.head.appendChild(s); });
  return kbReady;
}
const sheetName = s => { const x = (window.KB.sheets || []).find(y => y.s === String(s)); return x ? x.n : ''; };
function srcOf(row) {
  const mine = S.plan && S.plan.sheet ? String(S.plan.sheet.sheet).replace('表', '') : '';
  const all = [row.s].concat(row.o ? row.o.split(',') : []);
  const s = all.includes(mine) ? mine : row.s;
  return `表${s} 第${row.r}行` + (all.length > 1 ? `（表${all.join('、')} 同一内容）` : '');
}
function terms(q) {
  const words = String(q || '').toLowerCase().split(/[\s,，。、？?！!；;：:（）()“”"'/]+/).filter(Boolean);
  const out = new Set(words.filter(w => w.length >= 1));
  words.forEach(w => { if (/[一-鿿]/.test(w) && w.length > 2) for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2)); });
  return [...out];
}
function searchExcel({ query, sheet }) {
  const ts = terms(query);
  if (!ts.length) return { error: '请给关键词' };
  const rows = window.KB.rows.filter(r => !sheet || r.s === String(sheet).replace(/[^\d]/g, '') || (r.o || '').split(',').includes(String(sheet).replace(/[^\d]/g, '')));
  const scored = rows.map(r => {
    const t = r.t.toLowerCase(); let sc = 0;
    ts.forEach(w => { if (t.includes(w)) sc += w.length >= 3 ? w.length * 2 : w.length; });
    return { r, sc };
  }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 8);
  if (!scored.length) return { results: [], note: '套表里没有找到相关内容，换个说法再搜一次；还是没有就告诉用户套表里没有写' };
  return { results: scored.map(({ r }) => ({ src: srcOf(r), sheet: `表${r.s} ${sheetName(r.s)}`, row: r.r, text: r.t.length > 700 ? r.t.slice(0, 700) + '…（用 read_excel_rows 读全文）' : r.t })) };
}
function readRows({ sheet, from_row, to_row }) {
  const s = String(sheet).replace(/[^\d]/g, ''), a = +from_row || 1, b = Math.min(+to_row || a + 10, a + 40);
  const rows = window.KB.rows.filter(r => (r.s === s || (r.o || '').split(',').includes(s)) && r.r >= a && r.r <= b);
  return { sheet: `表${s} ${sheetName(s)}`, rows: rows.map(r => ({ src: `表${s} 第${r.r}行`, text: r.t })), note: rows.length ? '' : '这几行没有文字' };
}

/* ---------- 读取：计划、今天、记录、动作库 ---------- */
function myPlan() {
  const p = S.profile, pl = S.plan, tr = pl.training;
  return {
    profile: { sex: p.sex === 'F' ? '女' : '男', age: p.age, height_cm: p.height, weight_kg: p.weight, waist_cm: p.waist || null, target_weight_kg: p.targetWeight || null,
      level: { new: '新手', some: '有基础', vet: '老手' }[p.level || 'new'], place: p.place === 'home' ? '居家' : '健身房', lift_days: (p.liftDays || []).map(i => '周' + DOW[i]), lift_time: p.liftTime,
      parts: window.PARTS.map(pt => `${pt.name}${(p.parts || {})[pt.id] === false ? '（不练）' : ''}`).join('、'), cardio: (p.cardio || []).filter(c => c.kind && c.kind !== '无').map(c => `${c.kind} ${c.minutes || ''}分钟 周${(c.days || []).map(i => DOW[i]).join('')}`),
      budget_mode: !!p.budget, goal_setting: p.goal, split_setting: p.split || 'auto', bmr_manual: p.bmrOverride || null },
    goal: { value: pl.goal === 'cut' ? '减脂' : '增肌', reason: pl.goalWhy.reason, src: pl.goalWhy.src },
    energy: { bmr: pl.bmr, no_exercise_burn: pl.b, lift_burn: pl.c, cardio_burn_per_day: pl.d, eat_on_lift_day_kcal: pl.f1, eat_on_rest_day_kcal: pl.f2, src: '表5 G13-G19（增肌为表13）' },
    macros: { carbs_lift_day_g: pl.carbT, carbs_rest_day_g: pl.carbR, protein_g: pl.prot, fat_g: pl.fat, src: '表5 E22-L23' },
    diet_sheet: pl.sheet,
    meals_lift_day: (pl.meals.lift || []).map(m => `${m.time} ${m.name} 碳水${m.c}g 蛋白质${m.p}g`),
    meals_rest_day: pl.meals.rest.map(m => `${m.time} ${m.name} 碳水${m.c}g 蛋白质${m.p}g`),
    training: tr ? { split: tr.splitName, why: tr.split.why, src: tr.split.src, per_week: pl.perWeek, removed_parts: tr.removed,
      days: tr.days.map((d, i) => ({ day_index: i, name: d.name, table_title: d.tableName, src: d.src, groups: d.groups.map(g => ({ group_id: g.id, name: g.name, rule: g.text, src: g.src })) })) } : '不做力训（表8）',
    warnings: (pl.warnings || []).map(w => `${w.text}（${w.src}）`),
  };
}
function todayInfo({ date }) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : today();
  const info = dayInfo(d), r = peek(d) || { done: {} }, { tasks } = tasksFor(d);
  const out = { date: d, weekday: '周' + DOW[E.dow(d)], type: info.lift ? '力训日' : '休息日', holiday: info.h ? info.h.name + (info.h.off ? '（放假）' : '（补班）') : null,
    timeline: tasks.map(t => ({ item_id: t.id, time: t.time, title: t.title, done: !!r.done[t.id] })),
    meals: tasksFor(d).meals.map(m => ({ meal_key: m.key, name: m.name, time: m.time, carbs_g: m.c, protein_g: m.p, notes: m.notes || [] })),
    removed_items: hiddenOf(d), day_override: r.override || null, weight_kg: r.weight || null,
    intake: intakeOf(d), target: targetOf(d), burn_kcal: burnOf(d).total };
  if (S.plan.training && (info.lift || (r.done && r.done.lift))) {
    const { si, items } = sessionItems(d);
    out.training = { name: si.custom ? '自选部位' : si.day.name, day_index: si.dayIdx, recommended: !!si.recommended,
      exercises: items.map(it => ({ exercise_id: it.v, name: it.ex.n, group: it.group.name, sets: it.sets, reps: it.reps, rest: it.rest, src: it.group.src })) };
  }
  return out;
}
function hiddenOf(d) {
  const type = dayInfo(d).type, tpl = S.custom.timeline[type] || {}, day = (peek(d) || {}).tl || {};
  return [...new Set([...(tpl.hide || []), ...(day.hide || [])])].map(id => ({ item_id: id, scope: (day.hide || []).includes(id) ? 'day' : 'always' }));
}
function history({ days }) {
  const n = Math.max(1, Math.min(+days || 14, 60)), list = allDays().slice(-n);
  return { days: list.map(d => { const r = peek(d) || { done: {} }, i = intakeOf(d); return { date: d, weight: r.weight ? +r.weight : null, intake_kcal: Math.round(i.kcal), carbs: Math.round(i.c), protein: Math.round(i.p), burn_kcal: burnOf(d).total, lifted: !!(r.done && r.done.lift) }; }),
    note: '体重只比较 1-2 周的平均值（表17 B91）；减脂期记录到的摄入本来就会低于实际' };
}
function listExercises({ part }) {
  const all = Object.values(LIB).filter(x => !part || x.part === part);
  return { exercises: all.slice(0, 80).map(x => ({ exercise_id: x.v, name: x.ex.n, group: x.group, part: x.part, equipment: x.ex.eq, src: x.src })) };
}

/* ---------- 修改（都要用户确认） ---------- */
const PARTS_IDS = ['chest', 'back', 'shoulder', 'arm', 'legs', 'abs'];
const LABEL = { goal: '目标', weight: '体重', targetWeight: '目标体重', waist: '腰围', level: '训练经验', place: '训练地点', split: '分化', focus: '四分化重点', liftDays: '力训日', liftTime: '开始训练时间', parts: '想练的部位', lift: '做力训', budget: '省钱模式', bmrOverride: '手动基础代谢' };
function show(k, v) {
  if (v == null || v === '') return '（空）';
  if (k === 'goal') return { auto: '自动判断', cut: '减脂', bulk: '增肌' }[v] || v;
  if (k === 'level') return { new: '新手', some: '有基础', vet: '老手' }[v] || v;
  if (k === 'place') return v === 'home' ? '居家' : '健身房';
  if (k === 'split') return { auto: '自动', three: '三分化', four_sh: '四分化（肩单练）', four_arm: '四分化（手臂单练）', home: '居家三分化' }[v] || v;
  if (k === 'focus') return v === 'arm' ? '手臂' : '肩';
  if (k === 'liftDays') return v.map(i => '周' + DOW[i]).join('、');
  if (k === 'parts') return window.PARTS.filter(pt => v[pt.id] !== false).map(pt => pt.name).join('、');
  if (typeof v === 'boolean') return v ? '是' : '否';
  return String(v);
}
function cleanChanges(ch) {
  const out = {}, errs = [];
  const num = (k, lo, hi) => { if (ch[k] == null) return; const v = +ch[k]; if (v >= lo && v <= hi) out[k] = Math.round(v * 10) / 10; else errs.push(`${LABEL[k]}要在 ${lo}-${hi} 之间`); };
  if (ch.goal != null) { if (['auto', 'cut', 'bulk'].includes(ch.goal)) out.goal = ch.goal; else errs.push('目标只能是 auto/cut/bulk'); }
  num('weight', 35, 200); num('targetWeight', 35, 200); num('waist', 40, 160); num('bmrOverride', 800, 4000);
  if (ch.level != null) { if (['new', 'some', 'vet'].includes(ch.level)) out.level = ch.level; else errs.push('经验只能是 new/some/vet'); }
  if (ch.place != null) { if (['gym', 'home'].includes(ch.place)) out.place = ch.place; else errs.push('地点只能是 gym/home'); }
  if (ch.split != null) { if (['auto', 'three', 'four_sh', 'four_arm', 'home'].includes(ch.split)) out.split = ch.split; else errs.push('分化不认识'); }
  if (ch.focus != null) out.focus = ch.focus === 'arm' ? 'arm' : 'auto';
  if (ch.liftDays != null) { const v = [...new Set((ch.liftDays || []).map(Number).filter(i => i >= 0 && i <= 6))].sort(); if (v.length) out.liftDays = v; else errs.push('至少一天力训'); }
  if (ch.liftTime != null) { if (/^\d{1,2}:\d{2}$/.test(ch.liftTime)) out.liftTime = ch.liftTime.padStart(5, '0'); else errs.push('时间格式要是 HH:MM'); }
  if (ch.parts != null && typeof ch.parts === 'object') { const v = Object.assign({}, S.profile.parts); PARTS_IDS.forEach(id => { if (ch.parts[id] != null) v[id] = !!ch.parts[id]; }); if (Object.values(v).some(Boolean)) out.parts = v; else errs.push('至少保留一个部位'); }
  if (ch.lift != null) out.lift = !!ch.lift;
  if (ch.budget != null) out.budget = !!ch.budget;
  return { out, errs };
}
function applyProfile(out) {
  const p = Object.assign({}, S.profile, out);
  if (out.liftDays) p.schedMode = 'weekly';
  if (p.goal === 'bulk' && p.lift === false) throw new Error('增肌必须做力训（表13 E24）');
  S.profile = p; LS.set('profile', p); S.plan = E.build(p);
  if (window.Me && Me.scheduleNotifs) Me.scheduleNotifs();
}

/* ---------- 工具清单 ---------- */
const TOOLS = [
  { name: 'search_excel', description: '在《健身Excel超级套表》原文里搜索（饮食表、减脂/增肌问答、有氧消耗、食物营养率、训练计划、解剖总结）。回答任何方法、原则问题前都要先搜。返回原文和出处。', parameters: { type: 'object', properties: { query: { type: 'string', description: '关键词，空格分开，例如“体重不掉 调整”“蛋白质 鸡蛋”' }, sheet: { type: 'string', description: '可选，只搜某张表，填表号，例如 "17"' } }, required: ['query'] } },
  { name: 'read_excel_rows', description: '读套表某张表的连续几行原文（最多 40 行），用来看问答的完整回答或上下文。', parameters: { type: 'object', properties: { sheet: { type: 'string', description: '表号，例如 "17"' }, from_row: { type: 'integer' }, to_row: { type: 'integer' } }, required: ['sheet', 'from_row', 'to_row'] } },
  { name: 'get_my_plan', description: '读取用户资料和 App 按套表算出的计划：减脂/增肌及理由、热量、碳水蛋白质脂肪、饮食表、每餐分量、训练分化和每天练的肌群（含 group_id、day_index）、警告。', parameters: { type: 'object', properties: {} } },
  { name: 'get_today', description: '读取某一天（默认今天）的安排：是否力训日、时间线、训练动作（含 exercise_id）、已吃的碳水蛋白质热量、目标、消耗。', parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD，可选' } } } },
  { name: 'get_history', description: '读取最近几天的体重、摄入、消耗、是否力训。', parameters: { type: 'object', properties: { days: { type: 'integer', description: '天数，默认 14，最多 60' } } } },
  { name: 'list_exercises', description: '列出套表训练计划里的动作（exercise_id、名称、肌群、器械、出处），可按部位筛选。', parameters: { type: 'object', properties: { part: { type: 'string', enum: ['胸', '背', '肩', '手臂', '腿臀', '腹'] } } } },
  { name: 'update_profile', description: '修改用户资料或训练目标，改完会按套表重新计算整套计划。会先让用户确认。liftDays 用 0=周一 … 6=周日。parts 的键：chest 胸、back 背、shoulder 肩、arm 手臂、legs 腿臀、abs 腹。', parameters: { type: 'object', properties: {
    changes: { type: 'object', properties: {
      goal: { type: 'string', enum: ['auto', 'cut', 'bulk'] }, weight: { type: 'number' }, targetWeight: { type: 'number' }, waist: { type: 'number' },
      level: { type: 'string', enum: ['new', 'some', 'vet'] }, place: { type: 'string', enum: ['gym', 'home'] }, split: { type: 'string', enum: ['auto', 'three', 'four_sh', 'four_arm', 'home'] },
      focus: { type: 'string', enum: ['auto', 'arm'] }, liftDays: { type: 'array', items: { type: 'integer' } }, liftTime: { type: 'string' },
      parts: { type: 'object', properties: { chest: { type: 'boolean' }, back: { type: 'boolean' }, shoulder: { type: 'boolean' }, arm: { type: 'boolean' }, legs: { type: 'boolean' }, abs: { type: 'boolean' } } },
      lift: { type: 'boolean' }, budget: { type: 'boolean' }, bmrOverride: { type: 'number' } } },
    reason: { type: 'string', description: '为什么这样改，引用套表出处' } }, required: ['changes', 'reason'] } },
  { name: 'edit_training', description: '增加、删除动作或修改组数。scope=today 只改今天，always 以后这一天都这样。exercise_id 从 get_today 或 list_exercises 取。会先让用户确认。', parameters: { type: 'object', properties: {
    action: { type: 'string', enum: ['add', 'remove', 'set_sets'] }, exercise_id: { type: 'string' }, sets: { type: 'integer' }, scope: { type: 'string', enum: ['today', 'always'] }, reason: { type: 'string' } }, required: ['action', 'exercise_id', 'scope', 'reason'] } },
  { name: 'edit_timeline', description: '改某一天（可以是今天或以后的日期）的时间线安排：remove 删掉一项（item_id 从 get_today 取，饮食页会同步去掉，分量并到其他餐），restore 恢复删掉的项，set_time 改时间（会自动按时间排序），add 加一张卡片（title、time、note）。scope=day 只改这一天，always 以后同类日（力训日/休息日/有氧日/节假日）都这样。会先让用户确认。', parameters: { type: 'object', properties: {
    date: { type: 'string', description: 'YYYY-MM-DD，默认今天' }, action: { type: 'string', enum: ['remove', 'restore', 'set_time', 'add'] }, item_id: { type: 'string' }, time: { type: 'string', description: 'HH:MM' }, title: { type: 'string' }, note: { type: 'string' },
    scope: { type: 'string', enum: ['day', 'always'] }, reason: { type: 'string' } }, required: ['action', 'reason'] } },
  { name: 'set_meal_amounts', description: '调整某一天各餐的碳水、蛋白质克数（比如午饭吃不了挪到晚饭、聚餐前后调整）。全天合计应和计划一致（表5 E22-L23 的配额），不一致会提醒。meal_key 从 get_today 的 meals 取。会先让用户确认。', parameters: { type: 'object', properties: {
    date: { type: 'string' }, meals: { type: 'array', items: { type: 'object', properties: { meal_key: { type: 'string' }, carbs_g: { type: 'number' }, protein_g: { type: 'number' } }, required: ['meal_key'] } }, reset: { type: 'boolean', description: 'true 表示恢复这一天按计划的分量' }, reason: { type: 'string' } }, required: ['reason'] } },
  { name: 'set_day_training', description: '设某一天练不练：lift 这天加练、rest 这天不练、auto 恢复按计划（节假日自动跳过）。可以用来安排节假日回来、临时有事等。会先让用户确认。', parameters: { type: 'object', properties: {
    date: { type: 'string' }, type: { type: 'string', enum: ['lift', 'rest', 'auto'] }, reason: { type: 'string' } }, required: ['date', 'type', 'reason'] } },
  { name: 'exercise_info', description: '查一个动作或器械：动作名、用的器械、是否多关节、是否要避免力竭、所属肌群和套表出处、同组可替换的动作，以及 B站 教程搜索链接。可以按 exercise_id 或名称查。', parameters: { type: 'object', properties: { exercise_id: { type: 'string' }, name: { type: 'string' } } } },
  { name: 'video_links', description: '给出教程视频链接：套表里提到的 B站 视频（带出处），以及按关键词搜 B站 的链接（表21 C4：动作教程在 B站 搜动作名称即可）。', parameters: { type: 'object', properties: { topic: { type: 'string', description: '动作名或主题，例如“高位下拉”“饮食定量”' } }, required: ['topic'] } },
  { name: 'set_today_training', description: '换今天练哪一天（day_index 来自 get_my_plan），或者用 group_ids 自选几个肌群。会先让用户确认。', parameters: { type: 'object', properties: { day_index: { type: 'integer' }, group_ids: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' } } } },
];
const WRITE = new Set(['update_profile', 'edit_training', 'set_today_training', 'edit_timeline', 'set_meal_amounts', 'set_day_training']);
const STEP_TEXT = { search_excel: a => `查套表：${a.query || ''}${a.sheet ? '（表' + a.sheet + '）' : ''}`, read_excel_rows: a => `读原文：表${a.sheet} 第${a.from_row}-${a.to_row}行`, get_my_plan: () => '看你的计划', get_today: a => `看${a.date || '今天'}的安排`, get_history: a => `看最近 ${a.days || 14} 天记录`, list_exercises: a => `查动作库${a.part ? '：' + a.part : ''}`, update_profile: () => '准备修改计划', edit_training: () => '准备修改训练动作', set_today_training: () => '准备换今天的训练', edit_timeline: a => `准备修改${a.date || '今天'}的安排`, set_meal_amounts: a => `准备调整${a.date || '今天'}各餐分量`, set_day_training: a => `准备设置 ${a.date} 练不练`, exercise_info: a => `查动作：${a.name || a.exercise_id || ''}`, video_links: a => `找视频：${a.topic || ''}`, describe_image: () => '看图片' };

/* ---------- 对话状态 ---------- */
const st = { busy: false, view: [], msgs: [], pending: {}, ctl: null, img: null, draft: LS.get('chatDraft') || '' };
(function load() { const c = LS.get('chat'); if (c) { st.view = c.view || []; st.msgs = c.msgs || []; } })();
function persist() {
  // 只留最近 40 条（从某个用户提问开始截，保证工具调用成对）
  let m = st.msgs;
  if (m.length > 40) { let i = m.length - 40; while (i < m.length && m[i].role !== 'user') i++; m = m.slice(i); st.msgs = m; }
  if (st.view.length > 80) st.view = st.view.slice(-80);
  LS.set('chat', { view: st.view.map(v => v.k === 'confirm' && v.state === 'wait' ? { ...v, state: 'no' } : v), msgs: st.msgs });
}
function sysPrompt() {
  const p = S.profile, pl = S.plan;
  return [
    '你是“练吃日课”App 里的助手，只依据《健身Excel超级套表》（B站好人松松）回答健身、饮食、训练问题，也能帮用户修改计划。',
    '规则：',
    '1. 先查再答。涉及用户自己的数字（热量、碳水、蛋白质、今天练什么）用 get_my_plan / get_today / get_history；涉及方法、原则、常见问题用 search_excel，必要时用 read_excel_rows 读完整回答。',
    '2. 只转述工具返回的原文和 App 算出的数字。不要自己推断后果或补充理由（比如“会导致失衡”“影响体态”“更安全”），原文没写的一律不说。每个要点后面用括号标出处，照抄工具给的 src，例如（表17 第32行）。',
    '3. 搜了两三次仍查不到，就直接说“套表里没有写这个”，不要编，也不要换成通用健身知识来回答。',
    '4. 不做医疗诊断；伤病、疾病、用药问题提醒就医。',
    '7. 安排当天或以后的日子（节假日回来、今天有事、聚餐、加班）：先 get_today 看那一天，再按套表规则用 edit_timeline（删/加/改时间）、set_meal_amounts（挪各餐分量，全天合计保持配额）、set_day_training（这天练不练）。不吃零食/夜宵时分量并到其他餐（表5 B89）；练前餐只垫碳水（表5 I44）；休息日自己安排，不必一轮练完才休息（表21 C8）。',
    '8. 用户发了照片时，消息里会附上“图片识别”的文字。识别器械、说明器械怎么调这类套表没写的操作常识可以用常识回答，但要在句末标“（常识，非套表）”；组数、次数、重量、饮食分量、计划安排仍然只按套表。',
    '9. 需要教程视频时用 video_links 或 exercise_info，把链接原样给用户（Markdown 链接格式 [文字](网址)），不要自己编视频号。',
    '5. 用户要改计划（目标、目标体重、训练日、部位、分化、动作、组数、今天练什么）：直接调用 update_profile / edit_training / set_today_training，App 会弹出确认卡，由用户决定改不改，你不用再口头问“要不要改”。和套表建议冲突时，把冲突和出处写进 reason，照样调用工具。一次请求里有几项修改，就都放进同一次调用。',
    '6. 中文回答，先结论后理由，一般不超过 250 字。可以用“- ”列要点、用 **粗体** 强调，不要用表格和标题。',
    `今天是 ${today()}（周${DOW[E.dow(today())]}）。用户：${p.sex === 'F' ? '女' : '男'}，${p.age} 岁，${p.height}cm，${p.weight}kg，当前${pl.goal === 'cut' ? '减脂' : '增肌'}，饮食按${pl.sheet.sheet}《${pl.sheet.name}》，训练${pl.training ? pl.training.splitName : '不做力训'}。`,
  ].join('\n');
}

/* ---------- 执行工具 ---------- */
function confirmCard(title, lines, reason) {
  return new Promise(resolve => {
    const id = 'c' + Date.now();
    st.view.push({ k: 'confirm', id, title, lines, reason, state: 'wait' });
    st.pending[id] = resolve; draw();
  });
}
async function runTool(name, a) {
  if (!WRITE.has(name)) await loadKB();
  if (name === 'search_excel') return searchExcel(a);
  if (name === 'read_excel_rows') return readRows(a);
  if (name === 'get_my_plan') return myPlan();
  if (name === 'get_today') return todayInfo(a);
  if (name === 'get_history') return history(a);
  if (name === 'list_exercises') return listExercises(a);
  if (name === 'update_profile') {
    const { out, errs } = cleanChanges(a.changes || {});
    if (errs.length) return { ok: false, error: errs.join('；') };
    const keys = Object.keys(out).filter(k => JSON.stringify(out[k]) !== JSON.stringify(S.profile[k]));
    if (!keys.length) return { ok: false, error: '和现在的设置一样，不用改' };
    const before = { f1: S.plan.f1, goal: S.plan.goal, split: S.plan.training && S.plan.training.splitName };
    const lines = keys.map(k => `${LABEL[k]}：${show(k, S.profile[k])} → ${show(k, out[k])}`);
    if (!await confirmCard('修改计划', lines, a.reason)) return { ok: false, error: '用户取消了修改' };
    applyProfile(out);
    const pl = S.plan;
    return { ok: true, changed: lines, new_plan: { goal: pl.goal === 'cut' ? '减脂' : '增肌', eat_on_lift_day_kcal: pl.f1, eat_on_rest_day_kcal: pl.f2, carbs_lift_day_g: pl.carbT, protein_g: pl.prot, split: pl.training ? pl.training.splitName : '不做力训', days: pl.training ? pl.training.days.map(d => d.name) : [] }, before };
  }
  if (name === 'edit_training') {
    if (!S.plan.training) return { ok: false, error: '现在设置的是不做力训' };
    const d = today(), { si, items } = sessionItems(d), v = a.exercise_id, ex = window.EX[v];
    if (!ex) return { ok: false, error: '没有这个 exercise_id，请先用 list_exercises 查' };
    const sets = Math.max(1, Math.min(+a.sets || 3, 8));
    const inToday = items.some(it => it.v === v);
    if (a.action === 'remove' && !inToday) return { ok: false, error: '今天的训练里没有这个动作' };
    if (a.action === 'set_sets' && !inToday) return { ok: false, error: '今天的训练里没有这个动作，先 add' };
    const what = a.action === 'add' ? `添加 ${ex.n}（${sets} 组）` : a.action === 'remove' ? `删除 ${ex.n}` : `${ex.n} 改成 ${sets} 组`;
    if (!await confirmCard('修改训练', [what, `范围：${a.scope === 'always' ? `以后每次练“${si.custom ? '自选部位' : si.day.name}”都这样` : '只改今天'}`], a.reason)) return { ok: false, error: '用户取消了' };
    const apply = m => {
      m.hide = m.hide || []; m.add = m.add || []; m.sets = m.sets || {};
      if (a.action === 'remove') { if (!m.hide.includes(v)) m.hide.push(v); m.add = m.add.filter(x => x.v !== v); }
      if (a.action === 'add') { m.hide = m.hide.filter(x => x !== v); if (!m.add.some(x => x.v === v)) m.add.push({ v, sets }); }
      if (a.action === 'set_sets') m.sets[v] = sets;
    };
    if (a.scope === 'always') { S.custom.train[si.key] = S.custom.train[si.key] || {}; apply(S.custom.train[si.key]); saveCustom(); }
    else { const r = rec(d); r.ex = r.ex || {}; if (!r.session) r.session = si.custom ? { custom: true, split: training().split.key, groups: si.groups } : { split: training().split.key, dayIdx: si.dayIdx }; apply(r.ex); save(d); }
    return { ok: true, done: what, today_exercises: sessionItems(d).items.map(it => `${it.ex.n} ${it.sets}组`) };
  }
  if (name === 'set_today_training') {
    const tr = training(); if (!tr) return { ok: false, error: '现在设置的是不做力训' };
    const d = today();
    if (Array.isArray(a.group_ids) && a.group_ids.length) {
      const groups = [];
      tr.days.forEach((dd, di) => dd.groups.forEach(g => { if (a.group_ids.includes(g.id) && !groups.some(x => x.gid === g.id)) groups.push({ dayIdx: di, gid: g.id }); }));
      if (!groups.length) return { ok: false, error: 'group_ids 不在当前分化里，先 get_my_plan 看有哪些' };
      const names = groups.map(x => tr.days[x.dayIdx].groups.find(g => g.id === x.gid).name);
      if (!await confirmCard('换今天的训练', [`自选：${names.join('、')}`], a.reason)) return { ok: false, error: '用户取消了' };
      rec(d).session = { custom: true, split: tr.split.key, groups }; save(d);
    } else {
      const i = +a.day_index;
      if (!(i >= 0 && i < tr.days.length)) return { ok: false, error: `day_index 要在 0-${tr.days.length - 1}` };
      if (!await confirmCard('换今天的训练', [`今天练：${tr.days[i].name}`], a.reason)) return { ok: false, error: '用户取消了' };
      rec(d).session = { split: tr.split.key, dayIdx: i }; save(d);
    }
    return { ok: true, today: todayInfo({}).training };
  }
  if (name === 'exercise_info') {
    let v = a.exercise_id && window.EX[a.exercise_id] ? a.exercise_id : null;
    if (!v && a.name) { const q = String(a.name); v = Object.keys(window.EX).find(k => window.EX[k].n === q) || Object.keys(window.EX).find(k => window.EX[k].n.includes(q) || q.includes(window.EX[k].n)); }
    if (!v) return { error: '动作库里没有找到，先用 list_exercises 看有哪些' };
    const ex = window.EX[v], lib = LIB[v] || {};
    const alts = Object.values(window.ENTRY || {}).find(list => list.includes(v)) || [];
    return { exercise_id: v, name: ex.n, equipment: ex.eq, multi_joint: !!ex.multi, avoid_failure: !!ex.noFail, group: lib.group, part: lib.part, src: lib.src,
      alternatives_same_entry: alts.filter(x => x !== v).map(x => window.EX[x] ? window.EX[x].n : x),
      rest_rule: ex.multi ? '多关节动作组间休息 2-3 分钟（表21 C11）' : '单关节动作组间休息 1-1.5 分钟（表21 C11）',
      failure_rule: ex.noFail ? '自由卧推/深蹲/推举这类可能砸伤的动作不追求完全力竭，提前一两个停（表21 C13）' : '无危险动作可以做到力竭（表21 C13）',
      bilibili_search: 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(ex.n + ' 教程') };
  }
  if (name === 'video_links') {
    const topic = String(a.topic || '').trim(), rows = window.KB.rows.filter(r => /BV[0-9A-Za-z]{10}/.test(r.t));
    const seen = new Set(), vids = [];
    rows.forEach(r => (r.t.match(/[^｜/。；]*?BV[0-9A-Za-z]{10}[^｜/。；]*/g) || []).forEach(seg => { const bv = seg.match(/BV[0-9A-Za-z]{10}/)[0]; if (!seen.has(bv + seg.slice(0, 20))) { seen.add(bv + seg.slice(0, 20)); vids.push({ url: 'https://www.bilibili.com/video/' + bv, context: seg.trim().slice(0, 120), src: srcOf(r) }); } }));
    const tw = terms(topic);
    vids.forEach(x => x.score = tw.reduce((sc, w) => sc + (x.context.includes(w) ? w.length : 0), 0));
    vids.sort((p, q) => q.score - p.score);
    return { excel_videos: vids.slice(0, 5), bilibili_search: topic ? 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(topic + ' 教程') : null,
      note: '套表作者的视频有：新手完全训练手册 BV1Hk4y187jF、骨肌解剖与健身运用 BV1mM6JY6Ei9、饮食配套视频 BV1zu4m1N76R（表21 C4、表17 第32行）；具体动作教程按表21 C4 在 B站 搜动作名称' };
  }
  if (name === 'edit_timeline') {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : today(), info = dayInfo(d), scope = a.scope === 'always' ? 'tpl' : 'day';
    const { tasks } = tasksFor(d), t = tasks.find(x => x.id === a.item_id), label = scope === 'tpl' ? `以后每个${TYPE[info.type][0]}` : d;
    let line;
    if (a.action === 'remove') { if (!t) return { ok: false, error: '这一天没有这个 item_id，先 get_today' }; line = `删掉“${t.title}”`; }
    else if (a.action === 'restore') { if (!hiddenOf(d).some(x => x.item_id === a.item_id)) return { ok: false, error: '这一项没有被删掉' }; line = `恢复 ${a.item_id}`; }
    else if (a.action === 'set_time') { if (!t || !/^\d{1,2}:\d{2}$/.test(a.time || '')) return { ok: false, error: '需要有效的 item_id 和 HH:MM 时间' }; line = `“${t.title}” ${t.time} → ${a.time.padStart(5, '0')}`; }
    else if (a.action === 'add') { if (!a.title || !/^\d{1,2}:\d{2}$/.test(a.time || '')) return { ok: false, error: '需要 title 和 HH:MM 时间' }; line = `在 ${a.time.padStart(5, '0')} 加“${a.title}”`; }
    else return { ok: false, error: 'action 不认识' };
    if (!await confirmCard('修改安排', [line, `范围：${label}`], a.reason)) return { ok: false, error: '用户取消了' };
    const layer = () => { if (scope === 'tpl') return S.custom.timeline[info.type] || (S.custom.timeline[info.type] = { hide: [], add: [] }); const r = rec(d); return r.tl || (r.tl = { hide: [], add: [] }); };
    const L = layer(); L.hide = L.hide || []; L.add = L.add || [];
    if (a.action === 'remove') { if (t.custom && L.add.some(x => x.id === t.id)) L.add = L.add.filter(x => x.id !== t.id); else if (!L.hide.includes(t.id)) L.hide.push(t.id); }
    if (a.action === 'restore') { [S.custom.timeline[info.type], (peek(d) || {}).tl].forEach(x => { if (x && x.hide) x.hide = x.hide.filter(id => id !== a.item_id); }); }
    if (a.action === 'set_time') setTaskTime(d, t.id, a.time.padStart(5, '0'), scope);
    if (a.action === 'add') L.add.push({ id: 'c-' + uid(), time: a.time.padStart(5, '0'), title: a.title, note: a.note || '', sub: a.note || '', kind: 'habit', optional: false });
    if (scope === 'tpl') saveCustom(); save(d); scoreDay(d);
    if (window.Me && Me.scheduleNotifs) Me.scheduleNotifs();
    return { ok: true, done: line, now: todayInfo({ date: d }).timeline.map(x => `${x.time} ${x.title}`), meals: todayInfo({ date: d }).meals };
  }
  if (name === 'set_meal_amounts') {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : today();
    if (a.reset) {
      if (!await confirmCard('调整分量', [`${d} 各餐恢复按计划的分量`], a.reason)) return { ok: false, error: '用户取消了' };
      const r = rec(d); delete r.mealAmt; save(d); return { ok: true, meals: todayInfo({ date: d }).meals };
    }
    const cur = tasksFor(d).meals, list = (a.meals || []).filter(x => cur.some(m => m.key === x.meal_key));
    if (!list.length) return { ok: false, error: 'meal_key 不对，先 get_today 看 meals' };
    const after = cur.map(m => { const x = list.find(y => y.meal_key === m.key); return { m, c: x && x.carbs_g != null ? Math.round(x.carbs_g) : m.c, p: x && x.protein_g != null ? Math.round(x.protein_g) : m.p }; });
    const sumC = after.reduce((t, x) => t + x.c, 0), sumP = after.reduce((t, x) => t + x.p, 0), tc = cur.reduce((t, m) => t + m.c, 0), tp = cur.reduce((t, m) => t + m.p, 0);
    const lines = after.filter(x => x.c !== x.m.c || x.p !== x.m.p).map(x => `${x.m.name}：碳水 ${x.m.c}→${x.c}g，蛋白质 ${x.m.p}→${x.p}g`);
    if (!lines.length) return { ok: false, error: '分量没有变化' };
    const warn = Math.abs(sumC - tc) > tc * 0.05 || Math.abs(sumP - tp) > tp * 0.05 ? `注意：全天合计变成碳水 ${sumC}g（计划 ${tc}g）、蛋白质 ${sumP}g（计划 ${tp}g），和套表配额不一致` : '';
    if (!await confirmCard('调整分量', lines.concat(warn ? [warn] : []), a.reason)) return { ok: false, error: '用户取消了' };
    const r = rec(d); r.mealAmt = r.mealAmt || {};
    after.forEach(x => { if (x.c !== x.m.c || x.p !== x.m.p) r.mealAmt[x.m.key] = { c: x.c, p: x.p, note: '当天调整过：' + String(a.reason || '').slice(0, 40) }; });
    save(d);
    return { ok: true, changed: lines, warning: warn || null, meals: todayInfo({ date: d }).meals };
  }
  if (name === 'set_day_training') {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : '';
    if (!d) return { ok: false, error: 'date 要是 YYYY-MM-DD' };
    if (a.type === 'lift' && S.profile.lift === false) return { ok: false, error: '现在设置的是不做力训' };
    const before = dayInfo(d).lift ? '力训日' : '休息日';
    const what = a.type === 'lift' ? '这天加练' : a.type === 'rest' ? '这天不练' : '恢复按计划';
    if (!await confirmCard('安排训练日', [`${d}（周${DOW[E.dow(d)]}）：${before} → ${what}`], a.reason)) return { ok: false, error: '用户取消了' };
    const r = rec(d); if (a.type === 'auto') delete r.override; else r.override = a.type; save(d); scoreDay(d);
    if (window.Me && Me.scheduleNotifs) Me.scheduleNotifs();
    return { ok: true, date: d, now: dayInfo(d).lift ? '力训日' : '休息日', eat_kcal: C.targetOf(d).kcal };
  }
  return { error: '没有这个工具' };
}

/* ---------- 界面 ---------- */
function md(t) {
  const lines = esc(t).split('\n');
  let h = '', inList = false;
  lines.forEach(l => {
    const li = l.match(/^\s*(?:[-*•]|\d+[.、])\s+(.*)$/);
    if (li) { if (!inList) { h += '<ul>'; inList = true; } h += `<li>${li[1]}</li>`; return; }
    if (inList) { h += '</ul>'; inList = false; }
    const hd = l.match(/^#{1,4}\s*(.*)$/);
    h += l.trim() ? `<p>${hd ? `<b>${hd[1]}</b>` : l}</p>` : '';
  });
  if (inList) h += '</ul>';
  return h.replace(/\[([^\]]{1,60})\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s（(：:])(https?:\/\/[^\s<)）]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/（(表[\d０-９][^）]{0,40})）/g, '<span class="cite">$1</span>');
}
function itemHtml(v) {
  if (v.k === 'user') return `<div class="msg me">${v.img ? `<img class="msg-img" src="${v.img}" alt="发送的图片">` : ''}${esc(v.t)}</div>`;
  if (v.k === 'bot') return `<div class="msg bot">${md(v.t)}</div>`;
  if (v.k === 'step') return `<div class="step">${I.search || ''}<span>${esc(v.t)}</span></div>`;
  if (v.k === 'err') return `<div class="msg err">${esc(v.t)}</div>`;
  if (v.k === 'confirm') return `<div class="confirm mat"><div class="eyebrow">${esc(v.title)}</div>${v.lines.map(l => `<div class="t-headline" style="font-weight:600">${esc(l)}</div>`).join('')}${v.reason ? `<div class="t-foot l2">${esc(v.reason)}</div>` : ''}
    ${v.state === 'wait' ? `<div class="deck-ctrl" style="margin:4px 0 0"><button class="pill glass" data-cf="${v.id}|0">取消</button><button class="pill ink" data-cf="${v.id}|1">确认修改</button></div>` : `<div class="t-foot" style="color:${v.state === 'ok' ? 'var(--ok)' : 'var(--ink3)'}">${v.state === 'ok' ? '已修改' : '已取消'}</div>`}</div>`;
  return '';
}
const SUGGEST = ['我今天该吃多少碳水和蛋白质？出处在哪？', '减脂两周体重不掉怎么办？', '今天练什么？为什么是这些？', '我不想练腿了，帮我改一下', '食堂自助怎么吃才符合套表？', '有氧应该在力训前还是后做？'];
function view() {
  const cfg = S.ai, model = cfg.chatModel || cfg.model;
  let h = `<div class="chat-top"><button class="back" data-cback>${I.left}返回</button><div class="chat-title"><b>助手</b><span>${model ? esc(model) : '未设置模型'}</span></div><button class="gbtn" data-cclear aria-label="清空对话">${I.trash || '清空'}</button></div>`;
  h += '<div class="chat-list" id="chat-list">';
  if (!st.view.length) h += `<div class="chat-empty"><div class="guide-mark" style="width:52px;height:52px;border-radius:16px">${I.sparkles}</div><p class="t-sub l2">只按《健身Excel超级套表》回答，每条都标出处；套表没写的会直接说没有。也可以让我帮你改计划，改之前会先问你。</p><div class="chips">${SUGGEST.map(q => `<button class="sugg" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
  h += st.view.map(itemHtml).join('');
  if (st.busy) h += '<div class="typing"><i></i><i></i><i></i></div>';
  h += '</div>';
  h += `<div class="composer">${st.img ? `<div class="attach"><img src="${st.img.thumb}" alt="待发送的图片"><button class="attach-x" data-unimg aria-label="去掉图片">×</button></div>` : ''}<div class="composer-in glass">
    <button class="cbtn" id="chat-img" aria-label="发图片" ${!model ? 'disabled' : ''}>${I.camera}</button><input type="file" id="chat-file" accept="image/*" hidden>
    <textarea id="chat-in" rows="1" placeholder="${model ? (st.busy ? '可以直接发新问题打断' : '问问套表，或让我改计划') : '先在“我的 → 大模型接口”里设置'}" ${!model ? 'disabled' : ''}>${esc(st.draft)}</textarea>
    <button class="send ${st.busy ? 'stop' : ''}" id="chat-send" aria-label="${st.busy ? '停止' : '发送'}" ${!model ? 'disabled' : ''}>${st.busy ? '<i class="sq"></i>' : I.up}</button></div></div>`;
  return `<div class="chat">${h}</div>`;
}
function draw() {
  const list = $('#chat-list');
  if (!list) return;
  const had = document.activeElement && document.activeElement.id === 'chat-in';
  const app = $('#app'); app.innerHTML = view(); bind();
  if (had && $('#chat-in')) $('#chat-in').focus();
  requestAnimationFrame(() => { const l = $('#chat-list'); if (l) l.scrollTop = l.scrollHeight; });
}
function setDraft(v) { st.draft = v; LS.set('chatDraft', v || null); }
/* 打断：中止正在进行的请求，没点的确认卡当作取消 */
function stop() {
  if (!st.busy) return;
  if (st.ctl) st.ctl.abort();
  Object.keys(st.pending).forEach(id => { const v = st.view.find(x => x.id === id); if (v) v.state = 'no'; st.pending[id](false); delete st.pending[id]; });
}
async function ask(q) {
  q = String(q || '').trim(); const img = st.img;
  if (!q && !img) return;
  if (!q) q = '这是什么？';
  const cfg = S.ai;
  if (st.busy) { stop(); await new Promise(r => setTimeout(r, 60)); }
  if (!cfg.key || !(cfg.chatModel || cfg.model)) { toast('先在“我的 → 大模型接口”里设置'); return; }
  setDraft(''); st.img = null;
  const ctl = st.ctl = new AbortController();
  st.busy = true; st.view.push({ k: 'user', t: q, img: img ? img.thumb : null });
  if (!st.msgs.length || st.msgs[0].role !== 'system') st.msgs.unshift({ role: 'system', content: '' });
  st.msgs[0].content = sysPrompt();
  const mark = st.msgs.length;
  draw();
  try {
    await loadKB().catch(() => {});
    let content = q;
    if (img) {
      st.view.push({ k: 'step', t: STEP_TEXT.describe_image() }); draw();
      const desc = await AI.describeImage(cfg, img.data, q, ctl.signal);
      content = `${q}\n\n[图片识别（${cfg.model}）]：${desc}`;
    }
    st.msgs.push({ role: 'user', content });
    const ans = await AI.agent(cfg, st.msgs, TOOLS, runTool, s => { if (ctl.signal.aborted) return; st.view.push({ k: 'step', t: (STEP_TEXT[s.name] || (() => s.name))(s.args) }); draw(); }, ctl.signal);
    if (!ctl.signal.aborted) st.view.push({ k: 'bot', t: ans || '（没有回答）' });
  } catch (e) {
    st.view.push({ k: 'err', t: e.stopped || ctl.signal.aborted ? '已停止' : (e.message || String(e)) });
    // 没完成的一轮：保留用户的问题，去掉半截的工具调用，补一句“被打断”，下次对话格式仍然完整
    st.msgs = st.msgs.slice(0, mark);
    st.msgs.push({ role: 'user', content: q }, { role: 'assistant', content: '（这次回答被打断了）' });
  }
  if (st.ctl === ctl) { st.busy = false; st.ctl = null; }
  persist(); draw();
}
async function pickImage(file) {
  try {
    const data = await AI.compress(file);
    const thumb = await new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'), k = Math.min(1, 240 / Math.max(im.width, im.height)); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.7)); }; im.src = data; });
    st.img = { data, thumb }; draw();
  } catch (e) { toast(e.message || '图片读不出来'); }
}
function bind() {
  $('[data-cback]').onclick = () => { S.chatOn = false; if (window.visualViewport) visualViewport.onresize = null; render(); scrollTo(0, 0); };
  // 键盘弹出时让输入框跟着上移（按可见区域的高度排版）
  const vv = window.visualViewport;
  if (vv) { const fit = () => { const c = $('.chat'); if (!c) return; c.style.height = vv.height + 'px'; c.style.top = vv.offsetTop + 'px'; c.style.bottom = 'auto'; const l = $('#chat-list'); if (l) l.scrollTop = l.scrollHeight; }; vv.onresize = fit; fit(); }
  $('[data-cclear]').onclick = () => { stop(); st.view = []; st.msgs = []; persist(); draw(); };
  const ib = $('#chat-img'), fi = $('#chat-file');
  if (ib) ib.onclick = () => fi.click();
  if (fi) fi.onchange = () => { const f = fi.files[0]; if (f) pickImage(f); };
  const ux = $('[data-unimg]'); if (ux) ux.onclick = () => { st.img = null; draw(); };
  $$('[data-q]').forEach(b => b.onclick = () => ask(b.dataset.q));
  $$('[data-cf]').forEach(b => b.onclick = () => {
    const [id, ok] = b.dataset.cf.split('|'), v = st.view.find(x => x.id === id);
    if (!v || v.state !== 'wait') return;
    v.state = ok === '1' ? 'ok' : 'no'; Kit.haptic(ok === '1' ? 'success' : 'light');
    const res = st.pending[id]; delete st.pending[id]; if (res) res(ok === '1'); draw();
  });
  const inp = $('#chat-in'), send = $('#chat-send');
  if (inp) {
    const fit = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 140) + 'px'; };
    inp.oninput = () => { fit(); setDraft(inp.value); if (send) { const idle = !st.busy || inp.value.trim(); send.classList.toggle('stop', !idle); send.innerHTML = idle ? I.up : '<i class="sq"></i>'; } };
    fit();
    inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(inp.value); } };
  }
  // 忙的时候：输入框空着就是“停止”，有字就是“发送并打断”
  if (send) send.onclick = () => { if (st.busy && !inp.value.trim() && !st.img) { stop(); return; } ask(inp.value); };
  requestAnimationFrame(() => { const l = $('#chat-list'); if (l) l.scrollTop = l.scrollHeight; });
}
function open() { S.chatOn = true; render(); loadKB().catch(() => {}); }
return { view, bind, open, runTool, TOOLS, searchExcel, loadKB };
})();
