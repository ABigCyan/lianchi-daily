/*
 * 助手的界面和对话：以《健身Excel超级套表》为准回答，套表没写的再查补充资料。
 * 分层：ai-harness.js（工具注册、调用循环、上下文）→ ai-tools.js（所有工具）→ ai-memory.js（AI 记忆）
 *       → ai-local.js（离线规则和小模型提示词）→ 本文件（对话界面、确认卡、云端/离线两条流程的串联）。
 * 每次修改都要用户点确认卡。
 */
window.Assistant = (() => {
const { E, $, $$, esc, S, LS, today, DOW, toast, render, tasksFor } = C;
const { I } = Kit;

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
  return [
    '你是“练好吃对”App 里的助手，以《健身Excel超级套表》（B站好人松松）为准回答健身、饮食、训练问题；套表没写的，可以查补充资料（国际指南、立场声明、Meta 分析的共识）。也能帮用户修改计划、按用户情况定制训练。',
    '规则：',
    '1. 先查再答。涉及用户自己的数字（热量、碳水、蛋白质、今天练什么）用 get_my_plan / get_today / get_history；涉及方法、原则、常见问题用 search_excel，必要时用 read_excel_rows 读完整回答。',
    '2. 只转述工具返回的原文和 App 算出的数字。不要自己推断后果或补充理由（比如“会导致失衡”“影响体态”“更安全”），原文没写的一律不说。每个要点后面用括号标出处，照抄工具给的 src，例如（表17 第32行）。',
    '3. 套表搜了两三次仍查不到，再用 search_refs 查补充资料；查到了要说明“套表没有写，以下是补充资料”，出处写成（补充：来源简称）。两边都没有，就说“套表和补充资料都没有写”，不要编，也不要用没有出处的通用知识回答。',
    '10. 套表和补充资料有差异时：先说套表怎么说（标表号），再说补充资料怎么说（标来源），说明 App 默认按套表，由用户决定。不要用补充资料否定套表。',
    '11. 定制计划：先 get_my_plan 了解用户（经验、每周几次、地点、器械、伤病、重点部位、每次多久）。能用设置解决的用 update_profile（planMode、sessionMin、equip、focusParts、avoid、split 选补充分化）；套表分化和补充分化都不合适时，先 list_groups，再 create_custom_split。定制时肌群和动作仍来自套表模板，每周每个主要部位总组数尽量接近套表、每次约 20 组；把依据写进 reason。伤病只做“避开动作”，不做诊断，提醒就医。',
    '4. 不做医疗诊断；伤病、疾病、用药问题提醒就医。',
    '7. 安排当天或以后的日子（节假日回来、今天有事、聚餐、加班）：先 get_today 看那一天，再按套表规则用 edit_timeline（删/加/改时间）、set_meal_amounts（挪各餐分量，全天合计保持配额）、set_day_training（这天练不练）。不吃零食/夜宵时分量并到其他餐（表5 B89）；练前餐只垫碳水（表5 I44）；休息日自己安排，不必一轮练完才休息（表21 C8）。',
    '8. 用户发了照片时，消息里会附上“图片识别”的文字。识别器械、说明器械怎么调这类套表没写的操作常识可以用常识回答，但要在句末标“（常识，非套表）”；组数、次数、重量、饮食分量、计划安排仍然只按套表。',
    '12. 用户说吃了什么、要记饮食或算热量：先 search_foods 查表19，再用 log_food 记（表19 没有的菜估算碳水蛋白质脂肪并设 estimated=true，回答里说明是估算）；说“改成”时 replace=true。只问热量不让记时，只回答不调用 log_food。',
    '9. 需要教程视频时用 video_links 或 exercise_info，把链接原样给用户（Markdown 链接格式 [文字](网址)），不要自己编视频号。',
    '5. 用户要改计划（目标、目标体重、训练日、部位、分化、动作、组数、今天练什么）：直接调用 update_profile / edit_training / set_today_training，App 会弹出确认卡，由用户决定改不改，你不用再口头问“要不要改”。和套表建议冲突时，把冲突和出处写进 reason，照样调用工具。一次请求里有几项修改，就都放进同一次调用。',
    '13. 训练动作：调顺序用 reorder_training，换动作用 swap_exercise（先 exercise_info 看同一肌群的备选），加/删动作和组数用 edit_training（add 可以一次加多个），每个动作的次数、组间休息、是否力竭用 set_exercise_params（默认按表21 C11-C14，改得和套表不同要在 reason 里说明）。',
    '16. 练到一半：用户问后面怎么练、要改练、换动作、加减组数时，先 get_today 看 training_progress 和每个动作的 done_sets / remaining_sets / logged，做完的动作不要再安排，只调整还没做的部分；参考前面几组的重量次数给建议。',
    '14. 训练记录：问到用过多重、该用多重、进步了没有，用 get_training_log；建议重量按表21 C12（每组都做到次数上限就加一档，有一组不到下限就减一档）。',
    '15. 记忆：要主动记。用户说“记住…”，或者话里带出了长期有效的信息（伤病、忌口、器械和场地、作息、目标、偏好），不用等用户要求，直接用 remember 记一条；说“忘掉…”或信息过时用 forget。回答时参考下面的记忆，但以用户这次说的为准。记体重、腰围这些当天的数用 log_body，不要用 remember。',
    '6. 中文回答，先结论后理由，一般不超过 250 字。可以用“- ”列要点、用 **粗体** 强调，不要用表格和标题。',
    '补充动作和补充分化都要说明“补充”。',
    Harness.context(),
  ].join('\n');
}

function confirmCard(title, lines, reason, okText) {
  return new Promise(resolve => {
    const id = 'c' + Date.now();
    st.view.push({ k: 'confirm', id, title, lines, reason, state: 'wait', ok: okText });
    st.pending[id] = resolve; draw();
  });
}
/* 主动记忆：用户话里带出的伤病、忌口、器械、作息、目标，自动记下并在对话里提示一句（可以到“我的 → AI 记忆”删） */
function autoRemember(q) {
  Memory.auto(q).forEach(x => { const it = Memory.add(x.text, x.tag, 'auto'); if (it) { st.view.push({ k: 'step', t: `记住了：${it.text}（可以在“我的 → AI 记忆”里删）` }); draw(); } });
}
/* 给工具用的界面接口：步骤、确认卡、中止信号 */
function uiCtx(ctl, via, q) {
  return { signal: ctl.signal, via, q,
    step: t => { if (ctl.signal.aborted) return; st.view.push({ k: 'step', t }); draw(); },
    confirm: (title, lines, reason, okText) => ctl.signal.aborted ? Promise.resolve(false) : confirmCard(title, lines, reason, okText) };
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
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/（(表[\d０-９][^）]{0,40})）/g, '<span class="cite">$1</span>')
    .replace(/（(补充[：:][^）]{1,60})）/g, '<span class="cite ext">$1</span>');
}
function itemHtml(v) {
  if (v.k === 'user') return `<div class="msg me">${v.img ? `<img class="msg-img" src="${v.img}" alt="发送的图片">` : ''}${esc(v.t)}</div>`;
  if (v.k === 'bot') return `<div class="msg bot">${md(v.t)}</div>`;
  if (v.k === 'step') return `<div class="step">${I.search || ''}<span>${esc(v.t)}</span></div>`;
  if (v.k === 'srcs') return `<details class="srcs"><summary>原文 · ${v.items.map(x => esc(x.src)).join('、')}</summary>${v.items.map(x => `<div class="src-item"><b>${esc(x.src)}${x.title ? ' · ' + esc(x.title) : ''}</b><p>${esc(x.text)}</p></div>`).join('')}</details>`;
  if (v.k === 'err') return `<div class="msg err">${esc(v.t)}</div>`;
  if (v.k === 'confirm') return `<div class="confirm mat"><div class="eyebrow">${esc(v.title)}</div>${v.lines.map(l => `<div class="t-headline" style="font-weight:600">${esc(l)}</div>`).join('')}${v.reason ? `<div class="t-foot l2">${esc(v.reason)}</div>` : ''}
    ${v.state === 'wait' ? `<div class="deck-ctrl" style="margin:4px 0 0"><button class="pill glass" data-cf="${v.id}|0">取消</button><button class="pill ink" data-cf="${v.id}|1">${esc(v.ok || '确认修改')}</button></div>` : `<div class="t-foot" style="color:${v.state === 'ok' ? 'var(--ok)' : 'var(--ink3)'}">${v.state === 'ok' ? (v.ok ? '已记上' : '已修改') : '已取消'}</div>`}</div>`;
  return '';
}
const SUGGEST = ['我今天该吃多少碳水和蛋白质？出处在哪？', '减脂两周体重不掉怎么办？', '今天练什么？为什么是这些？', '高位下拉上次用了多重？这次该用多重？', '我每周只能练两次，怎么安排？', '我只有哑铃和凳子，膝盖不太好，帮我改计划', '练前要怎么热身？'];
function view() {
  const cfg = S.ai, loc = LocalBrain.useLocal(), model = loc ? `内置 ${LocalAI.current().name}（离线）` : (cfg.chatModel || cfg.model);
  let h = `<div class="chat-top"><button class="back" data-cback>${I.left}返回</button><div class="chat-title"><b>助手</b><span>${model ? esc(model) : '未设置模型'}</span></div><button class="gbtn" data-cclear aria-label="清空对话">${I.trash || '清空'}</button></div>`;
  h += '<div class="chat-list" id="chat-list">';
  if (!st.view.length) h += `<div class="chat-empty"><div class="guide-mark" style="width:52px;height:52px;border-radius:16px">${I.sparkles}</div><p class="t-sub l2">以《健身Excel超级套表》为准回答，每条都标出处；套表没写的再查补充资料（国际指南和研究共识），会标明“补充”。也可以让我按你的情况改计划、定制分化，改之前会先问你。</p><div class="chips">${SUGGEST.map(q => `<button class="sugg" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
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
/* 忙/闲：回答期间开原生前台服务保活（切到别的 App、锁屏也能答完），顶部的助手按钮显示“正在回答”；
   答完时人不在对话页就提示一下，App 在后台就发通知 */
let busyP = null;
const busyPlugin = () => busyP || (busyP = window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && (window.capacitorExports ? capacitorExports.registerPlugin('Busy') : Capacitor.registerPlugin('Busy')));
function setBusy(on, done) {
  st.busy = on;
  try { const P = busyPlugin(); if (P) (on ? P.start({ text: '助手正在回答…' }) : P.stop({ done: done || '' })).catch(() => {}); } catch (e) { /* 没有保活也照常回答 */ }
  $$('[data-ai]').forEach(b => b.classList.toggle('busy', on));
  if (!on && done && !S.chatOn) toast('助手回答好了，点右上角查看');
}
function finish(ctl) {
  if (st.ctl !== ctl) return;
  const last = [...st.view].reverse().find(v => v.k === 'bot' || v.k === 'err');
  st.ctl = null; setBusy(false, ctl.signal.aborted || !last || last.k === 'err' ? '' : last.t.replace(/\s+/g, ' ').slice(0, 80));
}
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
  if (LocalBrain.useLocal()) return askLocal(q, img);
  if (!cfg.key || !(cfg.chatModel || cfg.model)) { toast('先在“我的 → 大模型接口”里设置'); return; }
  setDraft(''); st.img = null;
  const ctl = st.ctl = new AbortController();
  setBusy(true); st.view.push({ k: 'user', t: q, img: img ? img.thumb : null });
  if (!st.msgs.length || st.msgs[0].role !== 'system') st.msgs.unshift({ role: 'system', content: '' });
  st.msgs[0].content = sysPrompt();
  const mark = st.msgs.length;
  draw();
  try {
    await AITools.loadKB().catch(() => {});
    let content = q;
    if (img) {
      st.view.push({ k: 'step', t: '看图片' }); draw();
      const desc = await AI.describeImage(cfg, img.data, q, ctl.signal);
      content = `${q}\n\n[图片识别（${cfg.model}）]：${desc}`;
    }
    st.msgs.push({ role: 'user', content });
    const ans = await Harness.runCloud({ cfg, messages: st.msgs, ctx: uiCtx(ctl, 'cloud', q) });
    // 主动记忆的兜底：模型这轮没调用 remember，但用户的话里有值得记的事，就按规则记下
    if (!ctl.signal.aborted && !Harness.trace.some(t => t.name === 'remember')) autoRemember(q);
    if (!ctl.signal.aborted) st.view.push({ k: 'bot', t: ans || '（没有回答）' });
  } catch (e) {
    st.view.push({ k: 'err', t: e.stopped || ctl.signal.aborted ? '已停止' : (e.message || String(e)) });
    // 没完成的一轮：保留用户的问题，去掉半截的工具调用，补一句“被打断”，下次对话格式仍然完整
    st.msgs = st.msgs.slice(0, mark);
    st.msgs.push({ role: 'user', content: q }, { role: 'assistant', content: '（这次回答被打断了）' });
  }
  finish(ctl);
  persist(); draw();
}
async function askLocal(q, img) {
  const d = today(), ctl = st.ctl = new AbortController();
  setDraft(''); st.img = null; setBusy(true);
  st.view.push({ k: 'user', t: q, img: img ? img.thumb : null }); draw();
  const live = { k: 'bot', t: '', live: true };
  let raw = '', raf = 0;
  const paint = () => { raf = 0; const el = [...document.querySelectorAll('.msg.bot')].pop(); if (el && live.t) el.innerHTML = md(live.t); const l = $('#chat-list'); if (l) l.scrollTop = l.scrollHeight; };
  const onToken = t => { raw += t; live.t = LocalAI.clean(raw); if (!raf) raf = requestAnimationFrame(paint); };
  const ctx = uiCtx(ctl, 'local', q), B = LocalBrain;
  const reply = (t, step) => { if (step) st.view.push({ k: 'step', t: step }); st.view.push({ k: 'bot', t }); st.msgs.push({ role: 'user', content: q }, { role: 'assistant', content: t }); };
  try {
    let question = q;
    if (img) {
      // 内置的 Qwen3.5 是图文模型：下载了看图组件就在手机上看；没有的话联网用云端看图模型
      if (await LocalAI.visionReady()) {
        // 饭菜照片问热量 / 要记：按“食物 克数”列出来，再按表19 算
        if (/吃|热量|卡|碳水|蛋白|饭|菜|记/.test(q)) {
          st.view.push({ k: 'step', t: '看图片（内置模型）：找出食物和分量' }); draw();
          const fp = await B.foodsFromPhoto(img.data, ctl.signal);
          if (fp.items.length) {
            const sum = fp.items.reduce((t, x) => t + FoodDB.calc(x.f, x.amt || (x.f.unit === 'g' ? 100 : 1)).kcal, 0);
            const unknownNote = fp.unknown.length ? `\n表19 里没有：${fp.unknown.join('、')}，没算进去。` : '';
            if (B.FOOD_VERB.test(q) || /记/.test(q)) {
              const meal = FoodDB.mealOf(q) || 'extra';
              const r = await Harness.call('log_food', { date: d, meal_key: tasksFor(d).meals.some(m => m.key === meal) ? meal : 'extra', foods: fp.items.map(x => ({ name: x.f.n, amount: x.amt || (x.f.unit === 'g' ? 100 : 1) })) }, ctx);
              return reply((r.ok ? `已记好：${r.done}。\n${r.day_total}。` : r.error === '用户取消了' ? '好的，没有记。' : '没记上：' + r.error) + unknownNote);
            }
            return reply(`照片里大约有：\n${B.foodAnswer(fp.items)}\n合计约 ${sum} kcal（分量是模型估的，可以在饮食页改克数）。${unknownNote}`, statLine(fp.stats));
          }
          question = `${q}\n（图片内容：${fp.raw || '没认出食物'}）`;
        } else {
          st.view.push({ k: 'step', t: '看图片（内置模型）' }); draw();
          const ds = await B.describePhoto(q, img.data, ctl.signal);
          st.view.push({ k: 'bot', t: '图片里：' + (ds.text || '没看清') }); draw();
          question = `${q}\n（图片内容：${ds.text}）`;
        }
      } else if (S.ai.key && S.ai.model && navigator.onLine) {
        st.view.push({ k: 'step', t: '看图片（云端看图模型）' }); draw();
        question = `${q}\n（图片内容：${await AI.describeImage(S.ai, img.data, q, ctl.signal)}）`;
      } else throw new Error('离线看图要先在“我的 → 内置模型”里下载看图组件（或者联网用云端看图模型）');
    }
    const plain = q.replace(/\s+/g, ' ').trim();
    if (!/^(请|帮我|你)?(要)?(记住|记着|记得|忘掉|忘记|别记|不用记)/.test(plain)) autoRemember(plain);
    // 1. 打招呼、道谢、问能做什么
    if (B.HELLO_RE.test(plain) || B.WHO_RE.test(plain)) return reply(B.LOCAL_HELP);
    if (B.THANKS_RE.test(plain)) return reply('不客气，有需要再叫我。');
    // 练到哪了 / 还剩什么：直接按今天的记录回答
    if (/(还剩|剩下|还有哪|还要练|练到哪|练完了吗|进度|做了几组|做完了吗)/.test(plain) && C.training() && !B.EDIT_RE.test(plain.replace(/做完|练完/g, ''))) {
      const items = C.sessionItems(d).items, line = B.progressLine(d, items);
      if (items.length) return reply(line || `今天还没开始：${items.map(it => `${it.ex.n} ${it.sets} 组`).join('、')}。`);
    }
    // 记住 / 忘掉：先于记饮食判断（“记住我早上不吃鸡蛋”不是记早饭）
    if (/^(请|帮我|你)?(要)?(记住|记着|记得|忘掉|忘记|别记|不用记)/.test(plain)) { const res = await B.runActions(B.ruleEdits(plain, d), q, ctx); return reply(res.join('\n') || '没听懂要记什么'); }
    // 2. 记饮食 / 问食物热量（按表19 规则拆，不用模型）
    const fp = FoodDB.parse(q);
    if (fp.items.length && (B.FOOD_VERB.test(q) || (fp.meal && !B.timeIn(q)) || B.KCAL_Q.test(q))) {
      const record = B.FOOD_VERB.test(q) || (fp.meal && !B.KCAL_Q.test(q)) || /完成|打卡/.test(q);
      if (!record) return reply(B.foodAnswer(fp.items), '查表19');
      const meal = fp.meal || (tasksFor(d).meals.slice().sort((a, b) => Math.abs(C.dayMin(a.time) - C.dayMin(E.mt(new Date().getHours() * 60 + new Date().getMinutes()))) - Math.abs(C.dayMin(b.time) - C.dayMin(E.mt(new Date().getHours() * 60 + new Date().getMinutes()))))[0] || {}).key || 'extra';
      const need = fp.items.filter(x => x.amt == null);
      if (need.length) return reply(`${need.map(x => `“${x.f.n}”${x.ask ? '：' + x.ask : ''}`).join('；')}。补上克数再说一次，比如“午饭吃了 150g 米饭”；也可以到饮食页“选食物”里点选。`, '查表19');
      st.view.push({ k: 'step', t: '查表19：' + fp.items.map(x => x.f.n).join('、') }); draw();
      const r = await Harness.call('log_food', { date: d, meal_key: meal, replace: fp.replace, foods: fp.items.map(x => ({ name: x.f.n, amount: x.amt })) }, ctx);
      const t = r.ok ? `已记好：${r.done}。\n${r.day_total}。${fp.unknown.length ? `\n表19 里没有：${fp.unknown.join('、')}，可以在饮食页“自己填”。` : ''}` : r.error === '用户取消了' ? '好的，没有记。' : '没记上：' + r.error;
      return reply(t);
    }
    if (fp.unknown.length && B.FOOD_VERB.test(q) && !B.EDIT_RE.test(q.replace(/改成|换成|改为/g, '')) && !B.findEx(q)) return reply(`表19 里没有“${fp.unknown.join('、')}”，离线没法估算。可以在饮食页用“自己填”，或者联网后用“AI 估算”。`, '查表19：没有找到');
    // 3. 改安排、改资料：先用规则，规则听不懂再问模型，模型的结果逐条检查
    // 规则总是先试一遍（很便宜）；规则听不懂、但看起来是要改东西时，才问模型
    const ruled = /[？?]|怎么|为什么|吗$/.test(plain) ? [] : B.ruleEdits(q, d);
    if (ruled.length || B.EDIT_RE.test(q) || /目标体重|体重|腰围|臀围|胸围|臂围|大腿围|体脂/.test(q) && /\d/.test(q)) {
      let acts = ruled, how = '';
      if (!acts.length) {
        st.view.push({ k: 'step', t: '理解要改什么' }); draw();
        const r = await LocalAI.chat([{ role: 'system', content: B.LP.action(d) }, { role: 'user', content: q }], { signal: ctl.signal, maxTokens: 200, temperature: 0 });
        acts = B.checkActions(B.parseActions(r.text), q, d); how = statLine(r.stats);
      }
      if (acts.length) {
        const res = await B.runActions(acts, q, ctx);
        reply(res.join('\n'));
        if (how) st.view.push({ k: 'step', t: how });
        return;
      }
      if (!B.PERSONAL_RE.test(q) && !/[？?]|怎么|为什么|吗/.test(q)) return reply('没听懂要改什么。可以这样说：“今天不练了”“晚饭改到 21:00”“把卧推放到第一个”“侧平举休息 60 秒”“记住我左膝受过伤”。复杂的修改（换分化、定制计划）请联网用云端助手。');
    }
    // 4. 回答问题：App 先检索套表原文；问自己的数字时再带上“我的计划”；模型只根据这些回答
    await AITools.loadKB();
    const personal = B.PERSONAL_RE.test(q);
    const R = B.localRetrieve(question);
    if (personal) R.sources = R.sources.slice(0, 1); // 问自己的数字：以“我的计划”为主，原文最多一段，免得混淆
    if (!R.found && !personal) return reply('套表里没有写这个。可以换个说法再问，或者联网后问云端助手（它会查补充资料，并标明“补充”）。', '查套表：没有找到相关原文');
    st.view.push({ k: 'step', t: R.sources.length ? `查套表：${R.sources.map(h => h.src + (h.title ? `「${h.title}」` : '')).join('、')}` : '用你的计划回答' });
    st.view.push(live); draw();
    const srcText = R.sources.map(h => `[${h.src}]${h.title ? `（问答：${h.title}）` : ''} ${h.text}`).join('\n\n');
    const user = (personal ? `【我的计划】\n${B.planBrief(d)}\n\n` : '') + `【资料】\n${srcText || '（没有找到相关原文）'}\n\n【问题】${question}`;
    const r = await LocalAI.chat([{ role: 'system', content: B.LP.qa(personal) }, { role: 'user', content: user }], { signal: ctl.signal, onToken, maxTokens: LocalAI.current().maxTokens || 500, temperature: 0.2 });
    live.t = LocalAI.clean(r.text) || '（没有回答）'; delete live.live;
    // 原文附在回答下面，可以自己核对
    if (R.sources.length) st.view.push({ k: 'srcs', items: R.sources.map(h => ({ src: h.src, title: h.title || '', text: h.text.slice(0, 1600) })) });
    st.view.push({ k: 'step', t: statLine(r.stats) });
    st.msgs.push({ role: 'user', content: q }, { role: 'assistant', content: live.t });
  } catch (e) {
    if (live.live) { st.view = st.view.filter(v => v !== live || v.t); delete live.live; }
    st.view.push({ k: 'err', t: e.stopped || ctl.signal.aborted ? '已停止' : (e.message || String(e)) });
  } finally {
    finish(ctl);
    persist(); draw();
  }
}
function statLine(s) {
  if (!s) return '内置模型';
  const sec = ms => (ms / 1000).toFixed(1) + ' 秒';
  return `内置 ${LocalAI.current().name}${s.loadMs > 300 ? ` · 加载 ${sec(s.loadMs)}` : ''} · 读资料 ${sec(s.prefillMs || 0)}${s.promptTokens ? `（${s.promptTokens} 词元）` : ''} · 生成 ${sec(s.genMs || 0)}`;
}
async function pickImage(file) {
  try {
    const data = await AI.compress(file);
    const thumb = await new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'), k = Math.min(1, 240 / Math.max(im.width, im.height)); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.7)); }; im.src = data; });
    st.img = { data, thumb }; draw();
  } catch (e) { toast(e.message || '图片读不出来'); }
}
function bind() {
  $('[data-cback]').onclick = () => { S.chatOn = false; render(); scrollTo(0, 0); };
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
function open() { S.chatOn = true; render(); AITools.loadKB().catch(() => {}); }
// 键盘弹出/收起时（对话框底部跟着键盘平滑移动，见 ui-kit.js）：原来停在最底下的，动画过程中一直保持在最底下
Kit.onKeyboard((h, dur) => {
  const l = $('#chat-list'); if (!l || !S.chatOn) return;
  if (l.scrollHeight - l.scrollTop - l.clientHeight > 120 && h) return;
  const end = performance.now() + (dur || 120) + 80;
  (function follow() { l.scrollTop = l.scrollHeight; if (performance.now() < end) requestAnimationFrame(follow); })();
  setTimeout(() => { l.scrollTop = l.scrollHeight; }, (dur || 120) + 100); // 动画结束再对齐一次（后台时 rAF 不跑）
});
return { view, bind, open, ask, busy: () => st.busy };
})();

