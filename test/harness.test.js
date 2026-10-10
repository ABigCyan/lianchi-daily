// 用法：node test/harness.test.js —— AI 运行框架（ai-harness.js）：工具注册、参数检查、云端循环（用假的模型按剧本返回工具调用）
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const ctx = { console, setTimeout, AbortController }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../www/js/ai-harness.js', 'utf8'), ctx);
const H = ctx.Harness;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// 假工具：一个查询、一个修改（修改要确认）
let reads = 0, writes = 0;
H.define({ name: 'look', description: '查', parameters: { type: 'object', properties: { q: { type: 'string' }, k: { type: 'integer' }, mode: { type: 'string', enum: ['a', 'b'] } }, required: ['q'] }, step: a => '查：' + a.q, run: async a => { reads++; return { ok: true, q: a.q, k: a.k, big: 'x'.repeat(9000) }; } });
H.define({ name: 'change', description: '改', write: true, parameters: { type: 'object', properties: { v: { type: 'number' } }, required: ['v'] }, run: async (a, c) => { if (!await c.confirm('改', ['v=' + a.v])) return { ok: false, error: '用户取消了' }; writes++; return { ok: true }; } });
H.define({ name: 'boom', description: '出错', run: async () => { throw new Error('坏了'); } });

(async () => {
  // 参数检查：必填、枚举、字符串数字自动转换
  ok((await H.call('look', {}, {})).error.includes('缺少参数 q'), '必填');
  ok((await H.call('look', { q: 'x', mode: 'z' }, {})).error.includes('只能是'), '枚举');
  ok((await H.call('look', { q: 'x', k: '3' }, {})).k === 3, '数字转换');
  ok((await H.call('nope', {}, {})).error.includes('没有这个工具'), '未知工具');
  ok((await H.call('boom', {}, {})).ok === false, '异常变成错误结果');
  ok(H.clip({ big: 'x'.repeat(9000) }).includes('已截断'), '结果截断');
  ok(H.schemas().length === 3 && H.schemas()[0].parameters, '工具清单');

  // 云端循环：模型按剧本调用 → 同样的查询只执行一次、同样的修改只确认一次、最后给回答
  const script = [
    { tool_calls: [{ id: '1', function: { name: 'look', arguments: '{"q":"a"}' } }, { id: '2', function: { name: 'look', arguments: '{"q":"a"}' } }] },
    { tool_calls: [{ id: '3', function: { name: 'change', arguments: '{"v":1}' } }] },
    { tool_calls: [{ id: '4', function: { name: 'change', arguments: '{"v":1}' } }, { id: '5', function: { name: 'look', arguments: '不是JSON' } }] },
    { content: '好了' },
  ];
  let i = 0, confirms = 0; reads = 0; writes = 0;
  ctx.AI = { chatOnce: async (cfg, msgs, tools) => { assert.ok(tools.length === 3); return Object.assign({ role: 'assistant', content: '' }, script[i++]); } };
  const steps = [], messages = [{ role: 'user', content: '帮我' }];
  const ans = await H.runCloud({ cfg: {}, messages, ctx: { step: t => steps.push(t), confirm: async () => { confirms++; return true; } } });
  ok(ans === '好了', '最后的回答');
  ok(reads === 1, '同样的查询只执行一次');
  ok(writes === 1 && confirms === 1, '同样的修改只确认一次');
  const toolMsgs = messages.filter(m => m.role === 'tool');
  ok(toolMsgs.length === 5, '每个调用都有结果');
  ok(toolMsgs[3].content.includes('已经处理过'), '重复修改被拦下');
  ok(toolMsgs[4].content.includes('不是合法的 JSON'), '坏参数');
  ok(steps[0] === '查：a', '步骤文字');

  // 步数用完：再问一次模型，不再执行工具
  i = 0; ctx.AI = { chatOnce: async () => (i++ < 3 ? { role: 'assistant', content: '', tool_calls: [{ id: 'x' + i, function: { name: 'look', arguments: `{"q":"${i}"}` } }] } : { role: 'assistant', content: '按已有结果回答' }) };
  const ans2 = await H.runCloud({ cfg: {}, messages: [{ role: 'user', content: 'x' }], ctx: { step() {}, confirm: async () => true }, maxSteps: 3 });
  ok(ans2 === '按已有结果回答', '步数用完后直接回答');

  // 取消：信号中止后抛出“已停止”
  const ctl = new AbortController(); ctl.abort();
  await assert.rejects(H.runCloud({ cfg: {}, messages: [], ctx: { signal: ctl.signal, step() {}, confirm: async () => true } }), e => e.stopped); n++;
  console.log(`AI 运行框架：${n} 项检查全部通过`);
})().catch(e => { console.error(e); process.exit(1); });
