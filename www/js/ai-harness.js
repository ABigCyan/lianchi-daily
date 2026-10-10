/*
 * AI 运行框架（harness）：云端助手和离线助手共用的一层。
 * - 工具注册表：每个工具一处定义（说明、参数、是不是修改、步骤文字、执行函数），云端从这里拿工具清单，离线规则也从这里调用；
 * - 统一调用：检查参数（必填、枚举、类型）、出错不中断、结果太长自动截断、每次调用记一条轨迹；
 * - 修改类工具一律经过 ctx.confirm（界面上的确认卡），同一轮里同样的修改不重复执行；
 * - 云端循环：模型调工具 → 执行 → 把结果给模型，直到给出回答；步数用完时让模型按已有结果直接回答；
 * - 上下文：今天、用户资料摘要、AI 记忆，按需拼进提示词。
 * ctx 由界面提供：{ confirm(title, lines, reason, okText) → Promise<boolean>, step(text), signal, via: 'cloud' | 'local', q }
 */
window.Harness = (() => {
const tools = new Map();
const trace = [];          // 最近一次提问的工具调用记录（调试用，也给“过程”展开看）
const MAX_RESULT = 7000;   // 工具结果给模型时最多这么多字，超过就截断并提示

/* ---------- 注册 ---------- */
// spec: { name, description, parameters, write: bool, step: a => '步骤文字', run: async (args, ctx) => result, cloud: true }
function define(spec) {
  if (!spec.name || typeof spec.run !== 'function') throw new Error('工具定义不完整：' + spec.name);
  tools.set(spec.name, Object.assign({ parameters: { type: 'object', properties: {} }, write: false, cloud: true }, spec));
}
const get = name => tools.get(name);
// 给云端模型的工具清单（OpenAI 函数格式里的三项）
function schemas() { return [...tools.values()].filter(t => t.cloud).map(t => ({ name: t.name, description: t.description, parameters: t.parameters })); }
function stepText(name, args) { const t = tools.get(name); try { return t && t.step ? t.step(args || {}) : name; } catch (e) { return name; } }

/* ---------- 参数检查：必填、枚举、基本类型（模型常把数字写成字符串） ---------- */
function check(t, args) {
  const P = t.parameters || {}, props = P.properties || {}, out = Object.assign({}, args), errs = [];
  (P.required || []).forEach(k => { if (out[k] == null || out[k] === '') errs.push(`缺少参数 ${k}`); });
  Object.entries(props).forEach(([k, sch]) => {
    if (out[k] == null) return;
    if ((sch.type === 'integer' || sch.type === 'number') && typeof out[k] === 'string' && out[k].trim() !== '' && !isNaN(+out[k])) out[k] = +out[k];
    if (sch.type === 'boolean' && typeof out[k] === 'string') out[k] = out[k] === 'true';
    if (sch.type === 'array' && typeof out[k] === 'string') { try { const v = JSON.parse(out[k]); if (Array.isArray(v)) out[k] = v; } catch (e) { out[k] = [out[k]]; } }
    if (sch.enum && !sch.enum.includes(out[k])) errs.push(`${k} 只能是 ${sch.enum.join(' / ')}`);
  });
  return { args: out, errs };
}
function clip(result) {
  let s = typeof result === 'string' ? result : JSON.stringify(result);
  if (s.length > MAX_RESULT) s = s.slice(0, MAX_RESULT) + '…（结果太长已截断，需要的话缩小范围再查）';
  return s;
}

/* ---------- 调用一个工具 ---------- */
async function call(name, rawArgs, ctx) {
  const t = tools.get(name), t0 = Date.now();
  if (!t) return { ok: false, error: `没有这个工具：${name}` };
  const { args, errs } = check(t, rawArgs || {});
  if (errs.length) { trace.push({ name, args, ok: false, ms: 0, error: errs.join('；') }); return { ok: false, error: errs.join('；') }; }
  let result;
  try { result = await t.run(args, ctx || {}); }
  catch (e) { result = { ok: false, error: e.message || String(e) }; }
  trace.push({ name, args, ok: !(result && result.ok === false), ms: Date.now() - t0, error: result && result.error });
  return result;
}

/* ---------- 云端循环 ---------- */
async function runCloud({ cfg, messages, ctx, maxSteps = 10 }) {
  trace.length = 0;
  const list = schemas(), seen = new Map(), done = new Set();
  const stopped = () => { if (ctx.signal && ctx.signal.aborted) { const e = new Error('已停止'); e.stopped = true; throw e; } };
  for (let i = 0; i < maxSteps; i++) {
    stopped();
    const msg = await AI.chatOnce(cfg, messages, list, ctx.signal);
    messages.push(msg);
    if (!msg.tool_calls || !msg.tool_calls.length) return msg.content;
    for (const tc of msg.tool_calls) {
      stopped();
      const name = tc.function.name;
      let args = {}, result;
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) { result = { ok: false, error: '参数不是合法的 JSON，请重新调用' }; }
      const key = name + ' ' + JSON.stringify(args), t = tools.get(name);
      if (!result) {
        if (t && t.write && done.has(key)) result = { ok: false, error: '这项修改刚才已经处理过（用户确认或取消过），不要重复调用' };
        else if (t && !t.write && seen.has(key)) result = seen.get(key);   // 同样的查询直接用上次的结果
        else {
          ctx.step && ctx.step(stepText(name, args));
          result = await call(name, args, ctx);
          (t && t.write ? done.add(key) : seen.set(key, result));
        }
      }
      messages.push({ role: 'tool', tool_call_id: tc.id, content: clip(result) });
    }
  }
  // 步数用完：不再给工具，让模型按已经拿到的结果回答
  stopped();
  const last = await AI.chatOnce(cfg, messages.concat([{ role: 'user', content: '（系统：工具调用次数已用完。请只根据上面已经拿到的结果直接回答用户，查不到的就说明没查到。）' }]), list, ctx.signal);
  messages.push({ role: 'assistant', content: last.content || '' });
  return last.content || '（查了很多次还没有结论，请把问题说得具体一点）';
}

/* ---------- 上下文：今天、资料摘要、记忆 ---------- */
function context() {
  const { S, today, DOW, E } = C, p = S.profile, pl = S.plan, d = today();
  const lines = [`今天是 ${d}（周${DOW[E.dow(d)]}）。`,
    `用户：${p.sex === 'F' ? '女' : '男'}，${p.age} 岁，${p.height}cm，${p.weight}kg，当前${pl.goal === 'cut' ? '减脂' : '增肌'}，饮食按${pl.sheet.sheet}《${pl.sheet.name}》，训练${pl.training ? pl.training.splitName : '不做力训'}。`];
  const mem = window.Memory ? Memory.brief(12) : '';
  if (mem) lines.push('用户之前告诉过你、让你记住的事（以用户最新的说法为准）：\n' + mem);
  return lines.join('\n');
}

return { define, get, schemas, stepText, call, runCloud, context, trace, clip };
})();
