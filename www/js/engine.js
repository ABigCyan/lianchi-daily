/*
 * 规划算法。所有数值规则取自 data-rules.js / data-training.js（均标有 Excel 出处）。
 * Excel 没给具体数值、由本应用补充的地方，都在返回结果里标 app:true，并写明理由。
 */
window.Engine = (() => {
  const R = window.RULES;
  const pad = n => String(n).padStart(2, '0');
  const tm = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
  const mt = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  const ds = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const pd = s => { const [a, b, c] = s.split('-').map(Number); return new Date(a, b - 1, c); };
  const dow = s => (pd(s).getDay() + 6) % 7; // 周一=0
  const r10 = x => Math.round(x / 10) * 10;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ---------- 1. 目标 ---------- */
  function bmiOf(p) { return p.weight / ((p.height / 100) ** 2); }
  function decideGoal(p) {
    const bmi = bmiOf(p), M = p.sex === 'M';
    const waistLine = M ? 85 : 80;
    if (p.lift === false) {
      return { goal: 'cut', reason: '不做力训：只能按“无力训者”减脂', src: '表8，表13 E24（增肌必须力训）' };
    }
    if (p.goal === 'cut' || p.goal === 'bulk') return { goal: p.goal, reason: '你手动选择', src: '' };
    const hi = M ? 24 : 22, lo = M ? 23 : 21;
    if (bmi > hi) return { goal: 'cut', reason: `BMI ${bmi.toFixed(1)} 高于 ${hi}（介意发胖时的转减脂线）`, src: '表18 B60，表13 C10' };
    if (bmi < lo) return { goal: 'bulk', reason: `BMI ${bmi.toFixed(1)} 低于 ${lo}（减脂该停止、转增肌的范围）`, src: '表17 B36，表5 C10' };
    if (+p.waist > waistLine) return { goal: 'cut', reason: `BMI 在 ${lo}-${hi} 之间，但腰围 ${p.waist}cm 超过 ${waistLine}cm（向心肥胖）`, src: '表5 C10' };
    return { goal: 'bulk', reason: `BMI ${bmi.toFixed(1)} 在 ${lo}-${hi} 之间且无向心肥胖，可以先增肌`, src: '表18 B60，表5 C10' };
  }

  /* ---------- 2. 有氧消耗（表16） ---------- */
  function weightFactor(w, flat) {
    const T = window.CARDIO_WEIGHT_FACTOR, arr = flat ? T.flat : T.normal;
    let best = 0;
    T.weights.forEach((x, i) => { if (Math.abs(x - w) < Math.abs(T.weights[best] - w)) best = i; });
    return arr[best];
  }
  function runCoef(kmh) {
    const T = window.RUN_TABLE;
    if (kmh <= T[0][0]) return T[0][1] * kmh / T[0][0];
    for (let i = 1; i < T.length; i++) {
      const [a, x] = T[i - 1], [b, y] = T[i];
      if (kmh <= b) return x + (y - x) * (kmh - a) / (b - a);
    }
    return T[T.length - 1][1];
  }
  /* 一项有氧每小时的消耗（大卡） */
  function cardioPerHour(act, w) {
    let coef, flat = false, src;
    if (act.hr && act.rhr) { coef = act.hr / act.rhr * 6.4 - 6.2; src = '表16 B14 心率法'; }
    else if (act.kind === '跑步') { coef = runCoef(60 / (+act.pace || 8)); src = '表16 D94-E103'; }
    else {
      const row = window.CARDIO.find(c => c.label === act.kind) || window.CARDIO[0];
      coef = row.coef; flat = !!row.flat; src = row.src;
    }
    return { kcal: Math.round(coef * w * weightFactor(w, flat) / 10) * 10, coef, src };
  }
  function cardioWeekly(p) {
    const list = (p.cardio || []).filter(a => a.kind && a.kind !== '无');
    let weekly = 0;
    const items = list.map(a => {
      const ph = cardioPerHour(a, p.weight);
      const per = Math.round(ph.kcal * (+a.minutes || 0) / 60);
      const n = (a.days || []).length;
      weekly += per * n;
      return { ...a, perHour: ph.kcal, perSession: per, n, src: ph.src };
    });
    return { items, weekly, daily: Math.round(weekly / 7 / 10) * 10 };
  }

  /* ---------- 3. 热量与宏量 ---------- */
  function calories(p, goal) {
    const M = p.sex === 'M';
    const formula = Math.round(p.weight * 9.99 + p.height * 6.25 - p.age * 4.92 + (M ? 5 : -161));
    // 用户手动输入基础代谢（例如体测仪或医院测得）时优先使用，否则按表5 G13 公式
    const bmr = +p.bmrOverride > 500 ? Math.round(+p.bmrOverride) : formula;
    const b = Math.round(bmr / 0.7);
    const c = p.lift === false ? 0 : R.liftBurn[M ? 'M' : 'F'][p.level || 'new'];
    const cw = cardioWeekly(p);
    const d = cw.daily;
    const factor = goal === 'cut' ? R.cutFactor.value : R.bulkFactor.value;
    const e1 = b + c + d, e2 = b + d;
    const f1 = Math.round(e1 * factor), f2 = Math.round(e2 * factor);
    return { bmr, bmrFormula: formula, bmrManual: +p.bmrOverride > 500, b, c, d, cardio: cw, e1, e2, f1, f2, factor };
  }
  function macros(p, goal, cal) {
    const M = p.sex === 'M', w = p.weight;
    const fat = goal === 'cut' ? (M ? (w >= 120 ? R.fat.cut.M120 : R.fat.cut.M) : R.fat.cut.F) : (M ? R.fat.bulk.M : R.fat.bulk.F);
    const rem = cal.f1 - fat * 9;
    let qT = Math.round(rem * 0.64 / 4 / w * 10) / 10;
    let qP = Math.round(rem * 0.36 / 4 / w * 10) / 10;
    let qR = Math.round((cal.f2 - fat * 9 - qP * w * 4) / 4 / w * 10) / 10;
    const notes = [];
    if (p.diabetes) { qT = +(qT - 0.3).toFixed(1); qR = +(qR - 0.3).toFixed(1); qP = +(qP + 0.3).toFixed(1); notes.push(R.diabetes); }
    if (p.gout) notes.push(R.gout);
    return {
      fat, qT, qP, qR,
      carbT: Math.round(qT * w), carbR: Math.round(qR * w), prot: Math.round(qP * w), notes,
    };
  }

  /* ---------- 4. 选饮食表（按力训时间，表1-15 的 C12） ---------- */
  const SHEETS = {
    am_early: { name: '早饭后练（早起版）', cut: '表1', bulk: '表9',
      order: [['breakfast', 'pre_b', '早饭（=练前餐）'], ['post', 'post', '练后餐'], ['lunch', 'other_light', '午饭（其他餐）'], ['dinner', 'other', '晚饭（其他餐）']] },
    am_late: { name: '早饭后练（晚起版）', cut: '表2', bulk: '表10',
      order: [['breakfast', 'pre_b', '早饭（=练前餐）'], ['lunch', 'post', '午饭（=练后餐）'], ['dinner', 'other', '晚饭（其他餐）']] },
    pre_lunch: { name: '午饭前练', cut: '表3', bulk: '表11',
      order: [['breakfast', 'breakfast', '早饭'], ['pre', 'pre', '练前餐'], ['lunch', 'post', '午饭（=练后餐）'], ['dinner', 'other', '晚饭（其他餐）']] },
    post_lunch: { name: '午饭后练', cut: '表4', bulk: '表12',
      order: [['breakfast', 'breakfast', '早饭'], ['lunch', 'pre', '午饭（=练前餐）'], ['post', 'post', '练后餐'], ['dinner', 'other', '晚饭（其他餐）']] },
    pre_dinner: { name: '晚饭前练', cut: '表5', bulk: '表13',
      order: [['breakfast', 'breakfast', '早饭'], ['lunch', 'other', '午饭（其他餐）'], ['pre', 'pre', '练前餐'], ['dinner', 'post', '晚饭（=练后餐）']] },
    post_dinner: { name: '晚饭后练', cut: '表6', bulk: '表14',
      order: [['breakfast', 'breakfast', '早饭'], ['lunch', 'other', '午饭（其他餐）'], ['dinner', 'pre', '晚饭（=练前餐）'], ['post', 'post', '练后餐']] },
    night: { name: '夜里练', cut: '表7', bulk: '表15',
      order: [['breakfast', 'breakfast', '早饭'], ['lunch', 'other_night', '午饭（其他餐）'], ['dinner', 'other_night', '晚饭（其他餐）'], ['post', 'post_night', '练后餐']] },
  };
  function pickSheet(p) {
    if (p.sheet && SHEETS[p.sheet]) return { key: p.sheet, how: '你手动选择' };
    const lt = tm(p.liftTime), B = tm(p.breakfast), L = tm(p.lunch), D = tm(p.dinner);
    // 规则：练前 2 小时内吃过正餐 → 这顿正餐就是练前餐；否则单独加练前餐（2 小时为应用补充的判定阈值）
    if (lt < L) {
      if (lt - B <= 120) return { key: (L - (lt + 90) >= 120) ? 'am_early' : 'am_late', how: '训练在早饭后 2 小时内' };
      return { key: 'pre_lunch', how: '训练在午饭前' };
    }
    if (lt < D) return lt - L <= 120 ? { key: 'post_lunch', how: '训练在午饭后 2 小时内' } : { key: 'pre_dinner', how: '训练在晚饭前' };
    return lt - D <= 120 ? { key: 'post_dinner', how: '训练在晚饭后 2 小时内' } : { key: 'night', how: '训练在晚饭 2 小时以后' };
  }

  /* ---------- 5. 分餐（Excel 未给每餐数值，按原表规则分配：应用补充） ---------- */
  const W = { // [碳水权重, 蛋白质权重]
    breakfast: [1.2, 0], pre_b: [1.2, 0], pre: [0.8, 0], post: [2.6, 1.3], other: [2.0, 1.0],
    other_light: [1.5, 0.8], other_night: [1.8, 1.0], post_night: [2.2, 1.2],
  };
  function mealTime(p, key, role) {
    const lift0 = tm(p.liftTime), liftEnd = lift0 + 90;
    if (key === 'breakfast') return tm(p.breakfast);
    if (key === 'pre') return lift0 - 40;
    if (key === 'post') return liftEnd + 20;
    const base = tm(p[key]);
    if (role === 'post' || role === 'post_night') return Math.max(base, liftEnd + 15);
    return base;
  }
  function mealsFor(p, plan, isLift, opts = {}) {
    const T = isLift ? plan.carbT : plan.carbR, P = plan.prot, budget = !!p.budget;
    let order;
    if (plan.noLift || !isLift) order = [['breakfast', 'breakfast', '早饭'], ['lunch', 'other', '午饭'], ['dinner', 'other', '晚饭']];
    else order = SHEETS[plan.sheet.key].order;
    const reserve = Math.round(T * 0.1);
    const avail = T - reserve;
    const meals = order.map(([key, role, name]) => {
      let [cw, pw] = W[role];
      const buffet = budget && key === 'lunch' && role !== 'pre';
      const cheap = budget && key !== 'lunch' && key !== 'breakfast' && role !== 'pre' && role !== 'pre_b';
      if (buffet) { cw *= 1.5; pw *= 2; }
      if (cheap) { cw *= 0.75; }
      let t = mealTime(p, key, role);
      if (key === 'dinner' && opts.cardioEnd && !isLift) t = Math.max(t, opts.cardioEnd + 15);
      return { key, role, name, time: mt(t), cw, pw, buffet, cheap };
    });
    const sw = meals.reduce((s, m) => s + m.cw, 0);
    meals.forEach(m => m.c = Math.round(avail * m.cw / sw));
    const big = meals.find(m => m.role.startsWith('post')) || meals.find(m => m.key === 'lunch');
    big.c += avail - meals.reduce((s, m) => s + m.c, 0);
    // 蛋白质：早饭固定为鸡蛋+牛奶，练前餐不吃，零食约 6%，其余按权重
    const snackP = Math.round(P * 0.06);
    const eggs = clamp(Math.round((P * 0.23 - 10) / 6), 2, 4);
    const bP = p.eggsMilk !== false ? eggs * 6 + 10 : Math.round(P * 0.2);
    meals.forEach(m => m.p = 0);
    meals[0].p = bP;
    meals[0].eggs = p.eggsMilk !== false ? eggs : 0;
    let left = P - bP - snackP;
    const cheapOnes = meals.filter(m => m.cheap && m.pw > 0);
    cheapOnes.forEach(m => { m.p = Math.min(20, Math.round(left * 0.3 / cheapOnes.length)); });
    left -= cheapOnes.reduce((s, m) => s + m.p, 0);
    const rest = meals.filter(m => m.pw > 0 && !m.cheap);
    const pw = rest.reduce((s, m) => s + m.pw, 0);
    rest.forEach(m => m.p = Math.round(left * m.pw / pw));
    const anchor = rest.find(m => m.buffet) || rest.find(m => m.role.startsWith('post')) || rest[0];
    if (anchor) anchor.p += P - snackP - meals.reduce((s, m) => s + m.p, 0);
    meals.push({ key: 'snack', role: 'snack', name: '零食/夜宵', time: mt(tm(p.sleep) - 150), c: reserve, p: snackP, reserve: true, optional: true });
    meals.forEach(m => m.foods = foodsFor(m, p, plan));
    return meals;
  }
  function foodsFor(m, p, plan) {
    const c = m.c, pr = m.p, out = { c: [], p: [], notes: [] };
    if (m.role === 'snack') {
      out.p.push('1 个水煮蛋', `牛肉干约 ${Math.max(10, Math.round(pr / 0.4))}g（碳水率低于 10%）`);
      if (plan.goal === 'bulk') out.p.push('另加 30g 坚果（表13 M32）');
      out.notes.push(`预留的 ${c}g 碳水用来抵扣牛奶、蔬菜和调料里的碳水，不专门吃碳水零食（表5 E58）`);
      return out;
    }
    if (m.role === 'pre') {
      out.c.push(`香蕉 ${Math.max(1, Math.round(c / 25))} 根`, `旺仔小馒头 ${Math.max(1, Math.round(c / 30))} 袋`, `馒头 ${r10(c / 0.5)}g`, '脉动 1 瓶（30g）');
      out.notes.push('只是垫点碳水，吃五六分饱，吃完就开练（表5 B47）');
      return out;
    }
    if (m.key === 'breakfast') {
      out.c.push(`馒头 ${r10(c / 0.5)}g`, `即食燕麦片 ${r10(c / 0.6)}g（干重）`, `甜玉米 ${r10(c / 0.2)}g`, `吐司 ${(c / 25).toFixed(1).replace(/\.0$/, '')} 片`);
      if (m.eggs) out.p.push(`${m.eggs} 个水煮蛋 + 1 盒 250ml 纯牛奶`, `不喝奶：${Math.round(pr / 6)} 个水煮蛋`);
      else out.p.push(`熟瘦肉 ${r10(pr / 0.25)}g`, `鸡蛋 ${Math.round(pr / 6)} 个`);
      if (m.role === 'pre_b') out.notes.push('这顿也是练前餐：吃了就准备开练；太饱就少吃蛋白质，挪到练后（表1 B34）');
      return out;
    }
    if (m.cheap) {
      out.c.push(`馒头 ${r10(c / 0.5)}g（约 ${Math.max(1, Math.round(c / 50))} 个）`, `挂面 ${r10(c / 0.75)}g（生重）`);
      out.p.push(`${Math.max(2, Math.round(pr / 6))} 个水煮蛋`, '2 个鸡蛋 + 1 盒牛奶', `自己煮鸡胸肉 ${r10(pr / 0.25)}g（熟重）`);
      out.notes.push('省钱版：鸡蛋每 30g 蛋白质约 4.65 元，比外食瘦肉便宜一半（表20）');
    } else {
      const box = (c / 100).toFixed(1).replace(/\.0$/, '');
      out.c.push(`米饭 ${r10(c / 0.3)}g（约 ${box} 盒外卖米饭）`, `馒头 ${r10(c / 0.5)}g`, `蒸红薯或土豆 ${r10(c / 0.18)}g`);
      out.p.push(`熟瘦肉 ${r10(pr / 0.25)}g`, `去皮全鸡腿 ${(pr / 40).toFixed(1).replace(/\.0$/, '')} 个`);
      if (m.buffet) out.notes.push('自助餐：先打蔬菜，瘦肉打足，米饭按量盛；不吃肥肉、油炸、炒蛋（表5 M34、M49）');
    }
    if (m.role.startsWith('post')) out.notes.push('练完半小时内开始吃；先吃饭和肉，蔬菜少吃、后吃（表5 B53、N34）');
    if (m.role === 'other_light') out.notes.push('练后餐刚吃过，这顿可以晚点吃或少吃点（表1 B48）');
    return out;
  }

  /* ---------- 6. 训练：选分化、按部位筛选 ---------- */
  function sessionsPerWeek(p) {
    if (p.lift === false) return 0;
    if (p.schedMode === 'workdays') return 5;
    if (p.schedMode === 'free') return +p.freeCount || 3;
    return (p.liftDays || []).length;
  }
  function pickSplit(p) {
    const n = sessionsPerWeek(p);
    if (p.split && p.split !== 'auto' && window.SPLITS[p.split]) return { key: p.split, why: '你手动选择', src: '' };
    if (p.place === 'home') return { key: 'home', why: '居家训练', src: '表5 E97，表24' };
    if ((p.level || 'new') === 'new') return { key: 'three', why: '完全新手用三分化', src: '表5 E96' };
    if (n >= 4) {
      const arm = p.focus === 'arm';
      return { key: arm ? 'four_arm' : 'four_sh', why: `有基础、每周 ${n} 次，用四分化（${arm ? '手臂' : '肩'}单练）`, src: '表5 E96，表22/表23' };
    }
    return { key: 'three', why: `有基础但每周只练 ${n} 次，三分化足够`, src: '表5 E96，表21 C8' };
  }
  function allowedGroups(p) {
    const parts = p.parts || {};
    const set = new Set();
    window.PARTS.forEach(pt => { if (parts[pt.id] !== false) pt.groups.forEach(gid => set.add(gid)); });
    if (p.sex === 'F' && p.femaleAbs === false) set.delete('abs');
    return set;
  }
  function buildDays(p) {
    const sp = pickSplit(p);
    const split = window.SPLITS[sp.key];
    const ok = allowedGroups(p);
    let moved = null;
    let days = split.days.map((d, i) => {
      const groups = d.groups.filter(gp => ok.has(gp.id));
      return { ...d, idx: i, groups };
    });
    // 去掉腿日后，原来和腿一起练的腹移到剩余最后一天（应用补充）
    days.forEach(d => {
      const hasLeg = d.groups.some(gp => ['quad', 'ham', 'glute', 'comp'].includes(gp.id));
      const onlyAbs = d.groups.length && d.groups.every(gp => gp.id === 'abs');
      if (onlyAbs && !hasLeg) { moved = d.groups; d.groups = []; }
    });
    days = days.filter(d => d.groups.length);
    if (moved && days.length) {
      const last = days[days.length - 1];
      last.groups = last.groups.concat(moved.map(gp => ({ ...gp, movedNote: '原本和腿一起练，你不练腿，所以移到这一天（应用补充）' })));
    }
    // 名称按你实际保留的肌群生成；原表的标题留在 tableName 里（去掉部位后名称会跟着变）
    days.forEach(d => { d.tableName = d.name; d.name = dayName(d.groups); d.changed = d.name.replace(/\s/g, '') !== d.tableName.replace(/\s/g, ''); });
    return { split: sp, splitName: split.name, days, removed: window.PARTS.filter(pt => (p.parts || {})[pt.id] === false).map(pt => pt.name) };
  }
  /* 由肌群得出这天练什么：胸 / 背 / 肩（前中后束）/ 肱二头、肱三头 / 腿臀 / 腹，按原表顺序 */
  function dayName(groups) {
    const ids = new Set(groups.map(g => g.id)), out = [];
    const sh = ['front', 'side', 'rear'].filter(x => ids.has(x));
    const shName = sh.length === 3 ? '肩' : sh.length === 2 && !ids.has('rear') ? '肩前中束' : sh.map(x => ({ front: '肩前束', side: '肩中束', rear: '肩后束' })[x]).join(' + ');
    const arm = ids.has('bi') && ids.has('tri') ? '大臂' : '';
    groups.forEach(g => {
      let n = '';
      if (['mid_chest', 'low_chest', 'up_chest'].includes(g.id)) n = '胸';
      else if (['pull', 'row', 'back'].includes(g.id)) n = '背';
      else if (sh.includes(g.id)) n = shName;
      else if (g.id === 'bi') n = arm || '肱二头';
      else if (g.id === 'tri') n = arm || '肱三头';
      else if (['quad', 'ham', 'glute', 'comp'].includes(g.id)) n = '腿臀';
      else if (g.id === 'abs') n = '腹';
      if (n && !out.includes(n)) out.push(n);
    });
    return out.join(' + ');
  }

  /* 新手不太容易上手、默认往后排的动作（应用补充，仍可手动换回来） */
  const HARD = new Set(['pullup', 'bb_row', 'tbar_row', 'dip', 'hang_raise', 'pullup_band']);
  /* 一次训练的具体安排 */
  function sessionPlan(p, day, ctx) {
    const novice = (p.level || 'new') === 'new';
    const early = novice && ctx.week <= 4;
    const firstTwo = novice && ctx.week <= 2;
    const F = p.sex === 'F';
    const legRound = ctx.legRound || 0;
    let groups = day.groups.slice();
    // 腿日轮换（表21 B74 / 表24 B71）
    if (groups.some(gp => ['quad', 'ham', 'glute'].includes(gp.id))) {
      let keep;
      if (p.place === 'home') keep = F ? ['glute', 'ham'] : ['quad', 'ham'];
      else keep = F ? (legRound % 2 === 0 ? ['glute', 'comp'] : ['ham', 'comp']) : (legRound % 2 === 0 ? ['quad', 'comp'] : ['ham', 'comp']);
      if (p.place === 'home' && F) keep = ['glute'];
      groups = groups.filter(gp => !['quad', 'ham', 'glute', 'comp'].includes(gp.id) || keep.includes(gp.id));
    }
    const out = [];
    groups.forEach(gp => {
      let optional = false;
      if (gp.optionalNovice) {
        if (novice) optional = true; // 新手偶尔加做：默认不做，可手动加
        else if (gp.id === 'low_chest' && (ctx.chestRound || 0) % 2 === 1) optional = true; // 有基础：上胸每次、下胸隔次（应用补充）
      }
      const sets = early ? gp.sets[0] : gp.sets[1];
      // 应用补充：每个动作不超过 4 组（在原表“选 N 个动作”范围内取够数量）；新手先排器械/易上手的动作
      let entries = gp.entries.slice();
      if (novice) entries = entries.filter(e => !HARD.has(window.ENTRY[e][0])).concat(entries.filter(e => HARD.has(window.ENTRY[e][0])));
      const count = clamp(Math.max(gp.pick[0], Math.ceil(sets / 4)), 1, Math.min(gp.pick[1], entries.length));
      const chosen = [];
      const pref = (ctx.choices || {})[gp.sheet + ':' + gp.id] || [];
      pref.forEach(v => { const e = gp.entries.find(en => window.ENTRY[en].includes(v)); if (e && chosen.length < count && !chosen.some(c => c.entry === e)) chosen.push({ entry: e, v }); });
      entries.forEach(e => {
        if (chosen.length >= count || chosen.some(c => c.entry === e)) return;
        const vs = window.ENTRY[e];
        chosen.push({ entry: e, v: p.place === 'home' ? vs[0] : vs[0] });
      });
      const base = Math.floor(sets / chosen.length), extra = sets % chosen.length;
      chosen.forEach((c, i) => {
        const ex = window.EX[c.v];
        const alts = [];
        gp.entries.forEach(e => window.ENTRY[e].forEach(v => { if (v !== c.v) alts.push(v); }));
        out.push({
          group: gp, entry: c.entry, v: c.v, ex, sets: base + (i < extra ? 1 : 0),
          reps: firstTwo ? '12-15' : (F ? '10-15' : '8-12'),
          repsSrc: firstTwo ? '表21 C12（适应新动作用更轻的重量）' : (F ? '表21 C14' : '表21 C12'),
          rest: ex.multi ? (['quad', 'ham', 'comp'].includes(gp.id) ? '2-3 分钟或更长' : '2-3 分钟') : '1-1.5 分钟',
          fail: ex.noFail ? '不追求完全力竭，提前 1-2 次停' : '可以做到力竭',
          alts: alts.filter(v => !chosen.some(cc => cc.v === v)),
          optional,
        });
      });
    });
    return out;
  }

  /* ---------- 7. 日程：节假日 / 训练日 ---------- */
  function holidayOf(date, extra) {
    const h = (extra && extra[date]) || window.HOLIDAYS_BUNDLED[date];
    return h ? { name: h[0], off: !!h[1] } : null;
  }
  function isWorkday(date, extra) {
    const h = holidayOf(date, extra);
    if (h) return !h.off;
    return dow(date) < 5;
  }
  function plannedLift(p, date, extra) {
    if (p.lift === false) return false;
    const h = holidayOf(date, extra);
    if (p.schedMode === 'workdays') return isWorkday(date, extra);
    if (p.schedMode === 'free') return false;
    if (h && h.off && p.skipHolidays !== false) return false;
    return (p.liftDays || []).includes(dow(date));
  }
  function plannedCardio(p, date, extra) {
    const h = holidayOf(date, extra);
    const skip = h && h.off && p.cardioSkipHolidays === true;
    return (p.cardio || []).filter(a => a.kind && a.kind !== '无' && (a.days || []).includes(dow(date)) && !skip);
  }

  /* ---------- 8. 总入口 ---------- */
  function build(p) {
    const g = decideGoal(p);
    const cal = calories(p, g.goal);
    const mac = macros(p, g.goal, cal);
    const noLift = p.lift === false;
    const plan = {
      bmi: bmiOf(p), goal: g.goal, goalWhy: g, noLift, ...cal, ...mac,
      sheet: noLift ? { key: 'nolift', name: '无力训者', sheet: '表8', how: '不做力训' } : null,
    };
    if (!noLift) {
      const s = pickSheet(p);
      plan.sheet = { key: s.key, name: SHEETS[s.key].name, sheet: g.goal === 'cut' ? SHEETS[s.key].cut : SHEETS[s.key].bulk, how: s.how };
    }
    if (noLift) { plan.f1 = plan.f2; plan.carbT = plan.carbR; }
    plan.meals = { lift: noLift ? null : mealsFor(p, plan, true), rest: mealsFor(p, plan, false) };
    plan.training = noLift ? null : buildDays(p);
    plan.perWeek = sessionsPerWeek(p);
    plan.warnings = warnings(p, plan);
    return plan;
  }
  function warnings(p, plan) {
    const w = [];
    if (!plan.noLift) {
      if (plan.perWeek < 3) w.push({ text: `每周只练 ${plan.perWeek} 次，低于 3 次。${plan.goal === 'bulk' ? '增肌长期低于 3 次几乎不会进步。' : '减脂想保持肌肉需要 3-5 次。'}`, src: '表21 C8，表5 E24，表13 E24' });
      if (plan.perWeek >= 6) w.push({ text: '每周 6 次原则上不需要，除非休息得非常好', src: '表21 C8' });
      if (plan.sheet.key === 'night') w.push({ text: '夜里练：如果练后餐离睡觉很近，不宜在这么晚锻炼', src: '表7 C12' });
    }
    if (p.goal === 'bulk' && p.lift === false) w.push({ text: '增肌必须有稳定的力训；不练时只能按减脂', src: '表13 E24' });
    const cw = plan.cardio;
    if (plan.goal === 'bulk' && cw.weekly > 0) w.push({ text: '一般建议增肌不做有氧；爱好性的有氧可以保留，消耗已算进饮食', src: '表13 E25，表17 第17问' });
    if (plan.goal === 'cut' && cw.weekly === 0 && p.weight < 70) w.push({ text: '体重 70kg 以下减脂，建议每周做 2 小时有氧，让饮食多一些', src: '表5 E25' });
    if (cw.weekly > 3000) w.push({ text: `每周有氧约 ${cw.weekly} 大卡，超过 3000，建议削减`, src: '表17 第17问' });
    return w;
  }

  /* ---------- 9. 按体重记录给调整建议 ---------- */
  function advice(p, plan, weights, today) {
    const avg = (a, b) => {
      const xs = weights.filter(x => x.d > addDays(today, -b) && x.d <= addDays(today, -a)).map(x => x.w);
      return xs.length >= 3 ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
    };
    const out = [];
    const bmiNow = (weights.length ? weights[weights.length - 1].w : p.weight) / ((p.height / 100) ** 2);
    const M = p.sex === 'M';
    if (plan.goal === 'cut') {
      const a1 = avg(0, 7), a2 = avg(7, 14);
      if (a1 != null && a2 != null) {
        const pct = (a1 - a2) / a2 * 100;
        const line = `近 7 天平均 ${a1.toFixed(1)}kg，前 7 天 ${a2.toFixed(1)}kg，一周 ${pct.toFixed(1)}%。`;
        if (pct > -0.25) out.push({ cls: 'warn', text: line + '基本没掉。先检查执行：主食和瘦肉是否定量，有没有吃高脂肉、糖油混合物、甜饮料。执行没问题再观察 2 周。', src: R.cutAdjust.src });
        else if (pct < -1.5) out.push({ cls: 'warn', text: line + '掉得偏快（目标约每周 1%），容易掉肌肉，可以每天加 30g 碳水。', src: R.cutSpeed.src + '（加碳水为应用补充）' });
        else out.push({ cls: 'ok', text: line + '速度正常（2 周约 2%），不用改。', src: R.cutSpeed.src });
      } else out.push({ cls: '', text: '至少需要两周、每周 3 次以上的称重才能判断进度。只比较 1-2 周的平均值。', src: '表17 B91' });
      const lost = (+p.startWeight || p.weight) - (weights.length ? weights[weights.length - 1].w : p.weight);
      if (lost >= 10) out.push({ cls: 'warn', text: `已经比起始体重轻 ${lost.toFixed(1)}kg，基础代谢下降约 150 大卡：每天少吃 100g 米饭 + 1 个全蛋，或每周多做约 1000 大卡有氧`, src: R.cut10kg.src });
      const stop = M ? 23 : 21;
      if (bmiNow <= stop) out.push({ cls: 'ok', text: `BMI 已到 ${bmiNow.toFixed(1)}，可以停止减脂、转增肌（腰围仍超标时可以再减一些）`, src: R.cutStop.src });
    } else {
      const a1 = avg(0, 14), a2 = avg(28, 42);
      if (a1 != null && a2 != null) {
        const gain = a1 - a2, lim = M ? 1 : 0.5;
        if (gain <= 0) out.push({ cls: 'warn', text: `一个月体重没长（${a2.toFixed(1)} → ${a1.toFixed(1)}kg）：每天加碳水 30-60g（米饭 100-200g）或脂肪 10-20g`, src: R.bulkAdjust.src });
        else if (gain > lim) out.push({ cls: 'warn', text: `一个月长了 ${gain.toFixed(1)}kg，超过 ${lim}kg：每天减碳水 30-60g 或不吃那 30g 坚果`, src: R.bulkAdjust.src });
        else out.push({ cls: 'ok', text: `一个月长了 ${gain.toFixed(1)}kg，速度合适`, src: R.bulkSpeed.src });
      } else out.push({ cls: '', text: '增肌看月度趋势，需要一个多月的称重记录。', src: R.bulkSpeed.src });
      const stop = M ? 24 : 22;
      if (bmiNow >= stop) out.push({ cls: 'warn', text: `BMI 已到 ${bmiNow.toFixed(1)}，介意发胖的话可以转减脂`, src: R.bulkStop.src });
    }
    return out;
  }
  function addDays(s, n) { const d = pd(s); d.setDate(d.getDate() + n); return ds(d); }

  /* 1RM 预测（表25） */
  function oneRM(weight, reps, sex) {
    if (!weight || !reps) return null;
    return sex === 'F' ? weight / (1.0278 - 0.0278 * reps) : Math.pow(reps, 0.1) * weight;
  }

  return { build, decideGoal, calories, macros, pickSheet, mealsFor, buildDays, dayName, sessionPlan, pickSplit, cardioPerHour, cardioWeekly,
    holidayOf, isWorkday, plannedLift, plannedCardio, advice, oneRM, SHEETS, tm, mt, ds, pd, dow, addDays, sessionsPerWeek };
})();
