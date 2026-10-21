/*
 * AI 记忆：用户告诉助手、或让助手记住的长期信息（伤病、器械、作息、口味、目标……），存在本机。
 * 云端和离线助手回答前都会带上；“我的 → AI 记忆”里可以查看、删除、自己加。
 * 训练数据（每个动作练过的重量和次数）不在这里重复存，直接从每天的记录里算（见 core.js 的 lastSession / suggestFor）。
 */
window.Memory = (() => {
const KEY = 'aiMemory';
const TAGS = { health: '伤病健康', gear: '器械场地', time: '作息时间', food: '饮食口味', goal: '目标', other: '其他' };
const load = () => { const v = C.LS.get(KEY); return Array.isArray(v) ? v : []; };
const store = list => C.LS.set(KEY, list.slice(-60));
function list() { return load(); }
// 加一条：和已有的几乎一样就更新那条，不重复存
function add(text, tag, src) {
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (text.length < 2) return null;
  const items = load(), norm = s => s.replace(/[，。！!？?、\s]/g, '');
  const old = items.find(x => norm(x.text) === norm(text) || (norm(x.text).length > 6 && (norm(text).includes(norm(x.text)) || norm(x.text).includes(norm(text)))));
  if (old) { old.text = text; old.ts = Date.now(); if (tag) old.tag = tag; store(items); return old; }
  const it = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, tag: TAGS[tag] ? tag : guessTag(text), ts: Date.now(), src: src || 'user' };
  items.push(it); store(items); return it;
}
function guessTag(t) {
  if (/伤|疼|痛|病|过敏|手术|血压|血糖|痛风|膝|腰|肩|手腕|肘/.test(t)) return 'health';
  if (/哑铃|杠铃|器械|健身房|在家|居家|弹力带|单杠|凳/.test(t)) return 'gear';
  if (/点|上班|下班|加班|睡|起床|周[一二三四五六日天]|时间/.test(t)) return 'time';
  if (/吃|喝|不爱|不喜欢|素|牛奶|鸡蛋|辣|外卖|食堂/.test(t)) return 'food';
  if (/目标|想要|减到|增到|腹肌|马甲线|比赛/.test(t)) return 'goal';
  return 'other';
}
// 改一条（用户在“AI 记忆”里编辑）：文字、分类都可以改，改过的算“你改的”
function update(id, text, tag) {
  const items = load(), it = items.find(x => x.id === id);
  if (!it) return null;
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (text.length < 2) return null;
  it.text = text; if (TAGS[tag]) it.tag = tag; it.ts = Date.now(); it.edited = true;
  store(items); return it;
}
function remove(id) { const items = load(), n = items.length, out = items.filter(x => x.id !== id); store(out); return out.length < n; }
// 按文字找着删（“忘掉膝盖的事”）
function forget(text) {
  const items = load(), key = String(text || '').replace(/忘掉|忘记|别记|删掉|不用记|的事|这件事|那条/g, '').trim();
  if (!key) return [];
  const hit = items.filter(x => x.text.includes(key) || key.split(/[，,\s]/).filter(w => w.length >= 2).some(w => x.text.includes(w)));
  store(items.filter(x => !hit.includes(x))); return hit;
}
function clear() { store([]); }
/* 主动记忆：从用户的话里挑出值得长期记住的事（伤病、忌口、器械场地、作息、目标），不用用户说“记住”。
   只取第一人称的陈述，问句只留前半句（“我膝盖疼能练腿吗” → “我膝盖疼”）。返回 [{ text, tag }] */
const AUTO = [
  ['health', /(受过伤|伤过|扭伤|拉伤|骨折|半月板|韧带|腰椎|颈椎|椎间盘|膝盖疼|膝盖痛|腰疼|腰痛|肩疼|肩痛|手腕疼|手术|痛风|糖尿病|高血压|血压高|心脏病|哮喘|怀孕|备孕|哺乳|贫血|甲减|甲亢)/],
  ['food', /(不吃|不能吃|不喝|吃素|素食|乳糖不耐|过敏|不爱吃|不喜欢吃|讨厌吃|戒了|忌口)/],
  ['gear', /((家里|家)(只)?有|只有|没有|买了)[^，。]{0,8}(哑铃|杠铃|器械|单杠|弹力带|卧推凳|壶铃|健身房)|在家练|没有健身房|办了.{0,4}卡/],
  ['time', /(上夜班|夜班|倒班|三班倒|经常出差|(每周|周)[一二三四五六日天、和]+[^，。]{0,6}(加班|没空|没时间|不能练)|每天[^，。]{0,6}(加班|只有|没时间))/],
  ['goal', /(想|希望|目标是|打算|准备)[^，。]{0,10}(减到|瘦到|增到|练出|参加|比赛|婚礼|拍照|体检)/],
];
function auto(text) {
  const out = [];
  String(text || '').split(/[，,。！!？?；;\n]/).map(x => x.trim()).filter(Boolean).forEach(cl => {
    if (!/^(我|本人|家里|家|最近|平时|每周|每天|周[一二三四五六日])/.test(cl) && !/我/.test(cl)) return;
    if (/^(记住|忘掉|忘记|别记)/.test(cl)) return;
    let c = cl.replace(/^(其实|对了|顺便说一下|另外|还有|但是|不过)/, '').replace(/(能不能|能|可以|可不可以|要不要|该不该|怎么|如何|吗|呢|吧).*$/, '').trim();
    if (c.length < 4 || c.length > 40) return;
    const hit = AUTO.find(([, re]) => re.test(c));
    if (hit && !out.some(x => x.text === c)) out.push({ text: c, tag: hit[0] });
  });
  return out.slice(0, 2);
}
// 给提示词用：最近的若干条
function brief(n) { return load().slice(-(n || 12)).map(x => `- [${TAGS[x.tag] || '其他'}] ${x.text}（id ${x.id}）`).join('\n'); }
return { TAGS, list, add, update, remove, forget, clear, brief, guessTag, auto };
})();
