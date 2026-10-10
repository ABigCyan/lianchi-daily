/*
 * AI 记忆：用户告诉助手、或让助手记住的长期信息（伤病、器械、作息、口味、目标……），存在本机。
 * 云端和离线助手回答前都会带上；“我的 → 设置 → AI 记忆”里可以查看、删除、自己加。
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
function remove(id) { const items = load(), n = items.length, out = items.filter(x => x.id !== id); store(out); return out.length < n; }
// 按文字找着删（“忘掉膝盖的事”）
function forget(text) {
  const items = load(), key = String(text || '').replace(/忘掉|忘记|别记|删掉|不用记|的事|这件事|那条/g, '').trim();
  if (!key) return [];
  const hit = items.filter(x => x.text.includes(key) || key.split(/[，,\s]/).filter(w => w.length >= 2).some(w => x.text.includes(w)));
  store(items.filter(x => !hit.includes(x))); return hit;
}
function clear() { store([]); }
// 给提示词用：最近的若干条
function brief(n) { return load().slice(-(n || 12)).map(x => `- [${TAGS[x.tag] || '其他'}] ${x.text}（id ${x.id}）`).join('\n'); }
return { TAGS, list, add, remove, forget, clear, brief, guessTag };
})();
