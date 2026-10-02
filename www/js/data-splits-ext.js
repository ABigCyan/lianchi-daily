/*
 * 补充分化（非套表）。肌群、动作沿用表21-24；每个肌群的组数是本应用按共识资料补充的，
 * 目标是每周每个主要部位的总组数和套表相当（套表三分化每周练 3 次时：胸约 10 组、背 12-16 组、腿 12-16 组），
 * 同时满足国际指南“每个主要肌群每周至少练 2 次”（WHO 2020、ACSM 2026）的频率。依据见 data-kb-ext.js。
 * 默认计划仍按套表选分化；这里的分化只在用户手动选择、“智能”模式下每周只能练 1-2 次，或助手按用户要求定制时使用。
 */
(() => {
  const S = window.SPLITS, ALTS = window.EXT_ALTS, EX = window.EX;

  /* 肌群模板：place:肌群id → 套表里的定义（名称、动作、出处）+ 补充备选 */
  const TPL = {};
  const add = (place, g, sheetName) => {
    const key = place + ':' + g.id;
    if (TPL[key]) return;
    const usable = v => window.exUsable(EX[v], place === 'home' ? window.EQUIP_DEFAULT.home : null);
    TPL[key] = { key, id: g.id, place, name: g.name, entries: g.entries.slice(), ext: (ALTS[g.id] || []).filter(usable),
      text: g.text, pick: g.pick, sets: g.sets, src: g.src, from: sheetName };
  };
  S.three.days.forEach(d => d.groups.forEach(g => add('gym', g, '表21')));
  S.home.days.forEach(d => d.groups.forEach(g => add('home', g, '表24')));
  Object.entries(window.NEW_GROUPS).forEach(([gid, [, name]]) => ['gym', 'home'].forEach(place => {
    const key = place + ':' + gid;
    const ext = (ALTS[gid] || []).filter(v => window.exUsable(EX[v], place === 'home' ? window.EQUIP_DEFAULT.home : null));
    if (ext.length) TPL[key] = { key, id: gid, place, name, entries: [], ext, text: '套表没有单列这个部位', pick: [1, 1], sets: [2, 3], src: '补充动作', from: '' };
  }));

  /* 把模板变成一天里的一个肌群：动作 = 套表动作在前 + 补充动作在后；组数、选几个按分化定 */
  function group(tplKey, sets, pick, extra) {
    const t = TPL[tplKey];
    if (!t) throw new Error('没有这个肌群模板：' + tplKey);
    pick = pick || [1, 1];
    const n = pick[0] === pick[1] ? pick[0] : `${pick[0]}-${pick[1]}`, s = sets[0] === sets[1] ? sets[0] : `${sets[0]}-${sets[1]}`;
    return Object.assign({
      id: t.id, name: t.name, text: `选${n}个动作 总共${s}组`, pick, sets, entries: t.entries.concat(t.ext), tpl: tplKey, ext: true,
      src: (t.from ? `动作：${t.src.replace(/^(表\d+) .*（组数），/, '$1 ').replace('（动作）', '')} + 补充动作` : '补充动作') + '；组数：应用补充',
    }, extra || {});
  }
  const OPT = { optionalNovice: true };
  function split(key, meta, days) {
    S[key] = Object.assign({ ext: true, src: '应用补充', days: days.map((d, i) => ({ name: d[0], src: `${meta.name} 第${i + 1}天`,
      groups: d[1].map(([k, sets, pick, extra]) => Object.assign(group(k, sets, pick, extra), { sheet: key + ':' + i })) })) }, meta);
  }

  split('full2', { name: '全身两练（补充）', place: 'gym', perWeek: [2, 2], refs: ['WHO2020', 'ACSM2026', 'SCH2016F', 'ACSM2009'],
    fit: '每周只能练 2 次', rel: '套表表21 C8：长期每周只练 1-2 次，增肌建议放弃力训（减脂不受影响）。实在只能练 2 次时，国际指南仍建议每周 2 天、每次练到全身主要肌群，所以用全身训练让每个部位每周练 2 次。' }, [
    ['全身 A', [['gym:mid_chest', [4, 5], [1, 2]], ['gym:pull', [3, 4]], ['gym:row', [3, 4]], ['gym:side', [3, 3]], ['gym:quad', [3, 4]], ['gym:ham', [3, 3]], ['gym:tri', [2, 3]], ['gym:abs', [2, 3]]]],
    ['全身 B', [['gym:up_chest', [3, 4]], ['gym:row', [3, 4]], ['gym:pull', [3, 3]], ['gym:front', [2, 3]], ['gym:rear', [2, 3]], ['gym:comp', [3, 4]], ['gym:glute', [3, 3]], ['gym:bi', [2, 3]]]],
  ]);
  split('full3', { name: '全身三练（补充）', place: 'gym', perWeek: [3, 3], refs: ['ACSM2009', 'SCH2016F', 'SCH2019F', 'ACSM2026'],
    fit: '每周 3 次、想让每个部位每周练 2-3 次', rel: '套表表21 用三分化（每周 3 次时每个部位每周 1 次）。研究认为总组数相同时，频率高低对增肌影响很小（SCH2019F）；全身训练每次练的部位多、每个部位组数少，适合喜欢频率高一点的人。' }, [
    ['全身 A', [['gym:mid_chest', [4, 5], [1, 2]], ['gym:pull', [3, 4]], ['gym:quad', [3, 4]], ['gym:ham', [3, 3]], ['gym:side', [2, 3]], ['gym:tri', [2, 3]], ['gym:abs', [2, 3]]]],
    ['全身 B', [['gym:row', [4, 5], [1, 2]], ['gym:up_chest', [3, 4]], ['gym:glute', [3, 4]], ['gym:comp', [3, 3]], ['gym:front', [2, 3]], ['gym:rear', [3, 3]], ['gym:bi', [2, 3]]]],
    ['全身 C', [['gym:mid_chest', [3, 4]], ['gym:pull', [3, 3]], ['gym:row', [3, 3]], ['gym:comp', [3, 4]], ['gym:side', [3, 3]], ['gym:bi', [2, 2]], ['gym:tri', [2, 2]], ['gym:core', [2, 3]]]],
  ]);
  split('ul4', { name: '上下肢四练（补充）', place: 'gym', perWeek: [4, 4], refs: ['SCH2016F', 'SCH2019F', 'NSCA-ESS'],
    fit: '每周 4 次', rel: '套表表22/表23 用四分化（每个部位每周 1 次）。上下肢分化每个部位每周练 2 次，总组数和四分化相当。' }, [
    ['上肢 A', [['gym:mid_chest', [4, 5], [1, 2]], ['gym:row', [4, 5], [1, 2]], ['gym:pull', [3, 3]], ['gym:front', [2, 3]], ['gym:side', [3, 3]], ['gym:bi', [2, 2]], ['gym:tri', [2, 2]]]],
    ['下肢 A', [['gym:quad', [3, 4], [1, 2]], ['gym:ham', [3, 3]], ['gym:comp', [3, 3]], ['gym:calf', [3, 3]], ['gym:abs', [3, 3]]]],
    ['上肢 B', [['gym:up_chest', [3, 4]], ['gym:pull', [4, 5], [1, 2]], ['gym:row', [3, 3]], ['gym:mid_chest', [2, 3]], ['gym:rear', [3, 3]], ['gym:side', [2, 2]], ['gym:bi', [2, 2]], ['gym:tri', [2, 2]]]],
    ['下肢 B', [['gym:glute', [3, 4], [1, 2]], ['gym:ham', [3, 3]], ['gym:comp', [3, 3]], ['gym:calf', [3, 3]], ['gym:core', [3, 3]]]],
  ]);
  split('five', { name: '五分化（补充）', place: 'gym', perWeek: [5, 5], refs: ['SCH2016F', 'SCH2019F'],
    fit: '每周 5 次、喜欢一次只练一个部位', rel: '套表表21 C8：每周 4-5 次已经饱和；表24 第13行只对居家说不建议五分化。五分化每个部位每周只练 1 次，研究认为总组数相同时频率影响不大，但不如每周 2 次稳妥（SCH2016F）。' }, [
    ['胸', [['gym:mid_chest', [8, 10], [2, 3]], ['gym:up_chest', [4, 4]], ['gym:low_chest', [4, 4], [1, 1], OPT]]],
    ['背', [['gym:pull', [6, 8], [1, 2]], ['gym:row', [6, 8], [1, 2]], ['gym:trap', [3, 3]], ['gym:lowback', [2, 3]]]],
    ['肩', [['gym:front', [4, 5], [1, 2]], ['gym:side', [6, 8], [1, 2]], ['gym:rear', [6, 8], [1, 2]]]],
    ['腿臀', [['gym:quad', [4, 6], [1, 2]], ['gym:ham', [4, 5], [1, 2]], ['gym:glute', [3, 4]], ['gym:comp', [3, 4]], ['gym:calf', [3, 4]]]],
    ['手臂 + 腹', [['gym:bi', [6, 8], [2, 2]], ['gym:tri', [6, 8], [2, 2]], ['gym:forearm', [2, 3]], ['gym:abs', [3, 4]]]],
  ]);
  split('home_full', { name: '居家全身（补充）', place: 'home', perWeek: [2, 3], refs: ['WHO2020', 'ACSM2026', 'SCH2016F'],
    fit: '在家、每周只能练 2-3 次', rel: '套表表24 第13行：居家建议三分化。每周只能练 2 次时，三分化每个部位要 10 天才轮到一次，所以用全身训练（理由同“全身两练”）。' }, [
    ['全身 A', [['home:mid_chest', [4, 5], [1, 2]], ['home:back', [4, 5], [1, 2]], ['home:quad', [3, 4]], ['home:ham', [3, 3]], ['home:side', [2, 3]], ['home:tri', [2, 3]], ['home:abs', [2, 3]]]],
    ['全身 B', [['home:up_chest', [3, 4]], ['home:back', [4, 4]], ['home:glute', [3, 4]], ['home:front', [2, 3]], ['home:rear', [3, 3]], ['home:bi', [2, 3]], ['home:core', [2, 3]]]],
  ]);
  split('home_ul', { name: '居家上下肢（补充）', place: 'home', perWeek: [4, 4], refs: ['SCH2016F', 'SCH2019F'],
    fit: '在家、每周 4 次', rel: '套表表24 第13行：居家器械少，建议三分化、不建议四分化/五分化。上下肢分化每次动作也不多，可以作为每周 4 次时的替代。' }, [
    ['上肢 A', [['home:mid_chest', [4, 5], [1, 2]], ['home:back', [4, 5], [1, 2]], ['home:front', [2, 3]], ['home:side', [3, 3]], ['home:tri', [3, 3]]]],
    ['下肢 A', [['home:quad', [4, 5], [1, 2]], ['home:ham', [3, 4]], ['home:calf', [3, 3]], ['home:abs', [3, 3]]]],
    ['上肢 B', [['home:up_chest', [3, 4]], ['home:back', [4, 5], [1, 2]], ['home:mid_chest', [2, 3]], ['home:rear', [3, 3]], ['home:bi', [3, 3]]]],
    ['下肢 B', [['home:glute', [4, 4], [1, 2]], ['home:ham', [3, 4]], ['home:quad', [3, 3]], ['home:core', [3, 3]]]],
  ]);

  /* 套表分化的说明（分化选择页用） */
  Object.assign(S.three, { place: 'gym', perWeek: [3, 6], fit: '新手；或有基础每周 ≤3 次', alias: '即“推拉腿”：背+肩后+二头 / 胸+肩前中+三头 / 腿臀+腹' });
  Object.assign(S.four_sh, { place: 'gym', perWeek: [4, 5], fit: '有基础、每周 4 次以上' });
  Object.assign(S.four_arm, { place: 'gym', perWeek: [4, 5], fit: '有基础、每周 4 次以上，重点练手臂' });
  Object.assign(S.home, { place: 'home', perWeek: [3, 6], fit: '在家练' });

  /* 用户/助手定制的分化：spec = { name, why, days: [{ name, groups: [{ tpl, sets: [a,b] 或 n, pick: [a,b] 或 n }] }] } */
  function customSplit(spec) {
    const errs = [];
    if (!spec || !Array.isArray(spec.days) || !spec.days.length) return { errs: ['至少要有一天'] };
    if (spec.days.length > 7) errs.push('最多 7 天');
    const days = spec.days.slice(0, 7).map((d, i) => {
      const groups = (d.groups || []).map(x => {
        if (!TPL[x.tpl]) { errs.push(`第${i + 1}天：没有肌群模板 ${x.tpl}`); return null; }
        const rng = v => Array.isArray(v) ? [+v[0], +(v[1] != null ? v[1] : v[0])] : [+v, +v];
        const sets = rng(x.sets != null ? x.sets : TPL[x.tpl].sets), pick = rng(x.pick != null ? x.pick : 1);
        if (!(sets[0] >= 1 && sets[1] <= 12 && sets[0] <= sets[1])) { errs.push(`第${i + 1}天 ${TPL[x.tpl].name}：组数要在 1-12 之间`); return null; }
        if (!(pick[0] >= 1 && pick[1] <= 3 && pick[0] <= pick[1])) { errs.push(`第${i + 1}天 ${TPL[x.tpl].name}：动作数要在 1-3 之间`); return null; }
        return Object.assign(group(x.tpl, sets, pick, x.optional ? OPT : null), { sheet: 'mine:' + i });
      }).filter(Boolean);
      if (!groups.length) errs.push(`第${i + 1}天没有肌群`);
      const total = groups.reduce((s, g) => s + g.sets[1], 0);
      if (total > 36) errs.push(`第${i + 1}天一共 ${total} 组，太多了（套表表21 C10：每次 20+ 组起步，不要再加）`);
      return { name: String(d.name || `第${i + 1}天`).slice(0, 20), src: `定制分化 第${i + 1}天`, groups };
    });
    const place = days.some(d => d.groups.some(g => g.tpl.startsWith('home:'))) ? 'home' : 'gym';
    return { errs, split: { name: String(spec.name || '我的分化').slice(0, 20) + '（定制）', ext: true, custom: true, src: '助手定制', place, why: spec.why || '', perWeek: [days.length, 7], days } };
  }

  /* 分化选项（资料页和助手共用）；助手定制过的分化另外加“我的分化” */
  window.SPLIT_CHOICES = [['auto', '自动（按套表）'], ['three', '三分化·推拉腿 表21'], ['four_sh', '四分化·肩 表22'], ['four_arm', '四分化·手臂 表23'], ['home', '居家三分化 表24'],
    ['full2', '全身两练（补充）'], ['full3', '全身三练（补充）'], ['ul4', '上下肢四练（补充）'], ['five', '五分化（补充）'], ['home_full', '居家全身（补充）'], ['home_ul', '居家上下肢（补充）']];
  window.GROUP_TPL = TPL;
  window.customSplit = customSplit;
})();
