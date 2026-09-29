/*
 * 拍照估算饮食：支持 OpenAI 兼容接口（通义千问、智谱、Kimi、豆包、OpenAI 等）和 Anthropic Claude 原生接口。
 * 用户填入自己的接口地址和 Key（只保存在手机本地），扫描可用模型，选一个支持图片的模型。
 * 在 App 里请求走 Capacitor 原生 HTTP，没有浏览器跨域限制。
 */
window.AI = (() => {
  const PRESETS = [
    { id: 'dashscope', name: '阿里云百炼（通义千问）', type: 'openai', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    { id: 'zhipu', name: '智谱 GLM', type: 'openai', base: 'https://open.bigmodel.cn/api/paas/v4' },
    { id: 'doubao', name: '火山方舟（豆包）', type: 'openai', base: 'https://ark.cn-beijing.volces.com/api/v3' },
    { id: 'moonshot', name: '月之暗面 Kimi', type: 'openai', base: 'https://api.moonshot.cn/v1' },
    { id: 'openai', name: 'OpenAI', type: 'openai', base: 'https://api.openai.com/v1' },
    { id: 'anthropic', name: 'Anthropic Claude', type: 'anthropic', base: 'https://api.anthropic.com' },
    { id: 'custom', name: '其他（OpenAI 兼容接口）', type: 'openai', base: '' },
  ];
  const VISION = /(-vl|vl-|vision|4v|omni|gpt-4o|gpt-4\.1|gpt-5|claude|gemini|glm-4\.?\dv|qvq|doubao-seed|pixtral|llava|internvl)/i;
  // 不适合拍照识别的：OCR 专用、实时语音、代码、纯推理
  const NOT_FOR_FOOD = /(ocr|realtime|audio|tts|asr|embedding|code|coder|image-gen|wanx)/i;
  // 自动选择时的优先顺序：靠前的先选
  const PREFER = [/^qwen3-vl-plus$/i, /^qwen-vl-max(-latest)?$/i, /^qwen3-vl-plus/i, /^qwen-vl-max/i, /^qwen3-vl-flash$/i, /^qwen-vl-plus/i, /^glm-4\.?\dv/i, /^doubao-seed/i, /^gpt-4o$/i, /^gpt-5/i, /-vl-/i, /vl/i, /vision/i];
  const trimBase = b => String(b || '').trim().replace(/\/+$/, '');

  function anthropicHeaders(key) {
    return {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    };
  }
  async function httpJson(url, opts, timeoutMs = 90000) {
    let res;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    // 外部传入的 signal（用户点“停止”）也能中断请求
    const outer = opts && opts.signal;
    if (outer && ctl) { if (outer.aborted) ctl.abort(); else outer.addEventListener('abort', () => ctl.abort(), { once: true }); }
    const fopts = { ...opts }; delete fopts.signal;
    try { res = await fetch(url, ctl ? { ...fopts, signal: ctl.signal } : fopts); }
    catch (e) {
      if (outer && outer.aborted) { const err = new Error('已停止'); err.stopped = true; throw err; }
      if (e && e.name === 'AbortError') throw new Error(`请求超过 ${timeoutMs / 1000} 秒没有返回，可能这个模型不支持看图或太慢，请换一个带“图”的模型`);
      throw new Error('网络请求失败，请检查网络或接口地址（' + (e.message || e) + '）');
    } finally { if (timer) clearTimeout(timer); }
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) { /* 非 JSON */ }
    if (!res.ok) {
      const msg = (data && (data.error && (data.error.message || data.error.type) || data.message)) || text.slice(0, 200);
      const err = new Error(`接口返回 ${res.status}：${msg}`);
      err.status = res.status; err.body = msg;
      throw err;
    }
    return data;
  }

  /* 扫描可用模型 */
  async function listModels(cfg) {
    const base = trimBase(cfg.base);
    if (!base || !cfg.key) throw new Error('请先填写接口地址和 API Key');
    let ids = [];
    if (cfg.type === 'anthropic') {
      let after = '';
      for (let i = 0; i < 5; i++) {
        const d = await httpJson(`${base}/v1/models?limit=100${after ? '&after_id=' + encodeURIComponent(after) : ''}`, { headers: anthropicHeaders(cfg.key) });
        (d.data || []).forEach(m => ids.push({ id: m.id, name: m.display_name || m.id }));
        if (!d.has_more) break;
        after = d.last_id;
      }
    } else {
      const d = await httpJson(`${base}/models`, { headers: { Authorization: 'Bearer ' + cfg.key } });
      (d.data || d.models || []).forEach(m => ids.push({ id: m.id || m.name, name: m.id || m.name }));
    }
    ids = ids.filter(m => m.id).map(m => ({ ...m, vision: (cfg.type === 'anthropic' || VISION.test(m.id)) && !NOT_FOR_FOOD.test(m.id) }));
    ids.sort((a, b) => (b.vision - a.vision) || a.id.localeCompare(b.id));
    return ids;
  }
  function defaultModel(cfg, models) {
    if (cfg.type === 'anthropic') {
      const pref = models.find(m => m.id === 'claude-opus-5');
      if (pref) return pref.id;
    }
    const vis = models.filter(m => m.vision && !/thinking/i.test(m.id));
    for (const re of PREFER) { const hit = vis.find(m => re.test(m.id)); if (hit) return hit.id; }
    return (vis[0] || models.find(m => m.vision) || models[0] || {}).id || '';
  }

  /* ---------- 内置的“饮食识别助手” ---------- */
  function systemPrompt() {
    const rates = window.FOOD_RATES;
    const fmt = arr => arr.map(([n, r]) => `${n} ${Math.round(r * 100)}%`).join('；');
    return [
      '你是一个饮食识别助手，服务于按《健身Excel超级套表》（B站好人松松）执行减脂/增肌饮食的用户。',
      '任务：看一张餐食照片，估算照片里每种食物的熟重（克）和碳水、蛋白质、脂肪，并按套表的规则给出提醒。',
      '',
      '估重方法：用餐具作参照（普通中式饭碗口径约 11-12cm，一平碗米饭约 150-200g；餐盘直径约 20-26cm；外卖长方形饭盒一盒米饭约 330g）。看不清的部分按常见一人份估计，并调低 confidence。',
      '',
      '营养率优先用套表表19的数据（按熟重计）：',
      '碳水率：' + fmt(rates.carb) + '。',
      '蛋白质率：' + fmt(rates.protein) + '。',
      '固定重量：' + rates.fixed.map(([n, v]) => `${n}：${v}`).join('；') + '。',
      '表里没有的食物用你的常识估算。',
      '',
      '混合菜肴必须拆开算（套表表17第1问）：主料 + 瘦肉部分（熟瘦肉蛋白质约25%、脂肪约3-5%）+ 肥肉部分（脂肪约90%）+ 菜肴吃进去的油（一般 5-10g，重油菜更多）。',
      '',
      '每种食物归入一个 category：',
      '主食碳水（米饭、面、馒头、薯类、玉米等）；瘦肉（去皮鸡鸭、没有白色脂肪层的猪牛羊、鱼虾贝、肝肾肚血）；',
      '高脂肉（鸡鸭皮、排骨、大排、糖醋里脊、锅包肉、鸡翅、猪蹄、牛腩、牛排、肥牛肥羊、烤肉、炸肉、午餐肉、肉肠肉饼肉馅肉丸、饺子馅）；',
      '糖油混合物（饼干、蛋糕、点心、甜品、油条、煎饼、手抓饼、葱油饼、花式面包、膨化食品）；',
      '吸油菜（煎炒鸡蛋、番茄炒蛋、油烧茄子、干煸菜）；蔬菜；水果；蛋奶；饮料；其他。',
      '',
      'flags 用中文短句列出需要注意的问题，例如“有高脂肉：红烧排骨，套表要求只吃瘦肉”“面条饱腹感低，碳水容易超”“水果要算进碳水”。没有问题就给空数组。',
      'advice 用一两句中文（不超过 80 字），结合用户这一餐的目标，说这餐碳水、蛋白质够不够，怎么调整（比如米饭少吃多少克、再加多少瘦肉）。',
      'kcal = 碳水×4 + 蛋白质×4 + 脂肪×9。数字取整。',
      '如果照片里不是食物，items 返回空数组，advice 说明原因。',
      '只输出一个 JSON 对象，不要输出其他文字，字段名必须和下面完全一致（数字不带单位）：',
      '{"items":[{"name":"米饭","grams":200,"carbs_g":60,"protein_g":5,"fat_g":1,"kcal":269,"category":"主食碳水","note":""}],',
      ' "total":{"carbs_g":60,"protein_g":5,"fat_g":1,"kcal":269},"flags":[],"advice":"……","confidence":0.8}',
    ].join('\n');
  }
  const SCHEMA = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' }, grams: { type: 'number' },
            carbs_g: { type: 'number' }, protein_g: { type: 'number' }, fat_g: { type: 'number' }, kcal: { type: 'number' },
            category: { type: 'string', enum: ['主食碳水', '瘦肉', '高脂肉', '糖油混合物', '吸油菜', '蔬菜', '水果', '蛋奶', '饮料', '其他'] },
            note: { type: 'string' },
          },
          required: ['name', 'grams', 'carbs_g', 'protein_g', 'fat_g', 'kcal', 'category', 'note'],
          additionalProperties: false,
        },
      },
      total: {
        type: 'object',
        properties: { carbs_g: { type: 'number' }, protein_g: { type: 'number' }, fat_g: { type: 'number' }, kcal: { type: 'number' } },
        required: ['carbs_g', 'protein_g', 'fat_g', 'kcal'],
        additionalProperties: false,
      },
      flags: { type: 'array', items: { type: 'string' } },
      advice: { type: 'string' },
      confidence: { type: 'number' },
    },
    required: ['items', 'total', 'flags', 'advice', 'confidence'],
    additionalProperties: false,
  };
  function userText(ctx) {
    return [
      ctx.text ? `我吃了：${ctx.text}（没有照片，请按文字描述估算）` : `这是我的${ctx.meal || '一餐'}照片。`,
      ctx.goal ? `我现在是${ctx.goal === 'cut' ? '减脂' : '增肌'}期。` : '',
      ctx.target ? `这一餐的目标：碳水约 ${ctx.target.c}g，蛋白质约 ${ctx.target.p}g。` : '',
      ctx.eaten ? `今天之前已记录：碳水 ${ctx.eaten.c}g，蛋白质 ${ctx.eaten.p}g；全天目标碳水 ${ctx.day.c}g、蛋白质 ${ctx.day.p}g。` : '',
      ctx.note ? `补充说明：${ctx.note}` : '',
      '请按要求输出 JSON。',
    ].filter(Boolean).join('\n');
  }
  function parseJson(text) {
    const s = String(text || '').replace(/```json|```/g, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('模型没有返回 JSON：' + s.slice(0, 120));
    const obj = JSON.parse(s.slice(a, b + 1));
    // 不同模型的字段名不完全一样（OpenAI 兼容接口不强制结构），这里兼容常见写法
    const pick = (o, keys) => { for (const k of keys) if (o[k] != null && o[k] !== '') return +String(o[k]).replace(/[^\d.]/g, '') || 0; return 0; };
    const G = ['grams', 'weight_g', 'weight', 'gram', 'amount_g', '重量'], C = ['carbs_g', 'carb_g', 'carbs', 'carb', 'carbohydrate_g', 'carbohydrates', '碳水'];
    const P = ['protein_g', 'protein', 'proteins', '蛋白质'], F = ['fat_g', 'fat', 'fats', '脂肪'], K = ['kcal', 'calories', 'energy_kcal', 'calorie', '热量'];
    const confs = [];
    obj.items = (obj.items || obj.foods || []).map(it => {
      const c = pick(it, C), p = pick(it, P), f = pick(it, F);
      if (it.confidence != null) confs.push(+it.confidence);
      return {
        name: String(it.name || it.food || '未知'), grams: Math.round(pick(it, G)),
        carbs_g: Math.round(c), protein_g: Math.round(p), fat_g: Math.round(f),
        kcal: Math.round(pick(it, K) || (c * 4 + p * 4 + f * 9)), category: it.category || '其他', note: it.note || '',
      };
    });
    if (obj.confidence == null && confs.length) obj.confidence = confs.reduce((a, b) => a + b, 0) / confs.length;
    const t = obj.items.reduce((s, it) => ({ carbs_g: s.carbs_g + it.carbs_g, protein_g: s.protein_g + it.protein_g, fat_g: s.fat_g + it.fat_g, kcal: s.kcal + it.kcal }), { carbs_g: 0, protein_g: 0, fat_g: 0, kcal: 0 });
    obj.total = t;
    obj.flags = Array.isArray(obj.flags) ? obj.flags.map(String) : [];
    obj.advice = String(obj.advice || '');
    obj.confidence = Math.max(0, Math.min(1, +obj.confidence || 0));
    return obj;
  }

  async function analyze(cfg, dataUrl, ctx) {
    const base = trimBase(cfg.base);
    if (!base || !cfg.key || !cfg.model) throw new Error('请先在“我的 → 大模型接口”里填好接口、Key 并选择模型');
    const b64 = dataUrl ? dataUrl.split(',')[1] : '';
    const sys = systemPrompt();
    const text = userText(ctx);
    if (cfg.type === 'anthropic') {
      const body = {
        model: cfg.model, max_tokens: 4000, system: sys,
        messages: [{ role: 'user', content: dataUrl ? [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          { type: 'text', text },
        ] : [{ type: 'text', text }] }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      };
      let d;
      try { d = await httpJson(`${base}/v1/messages`, { method: 'POST', headers: anthropicHeaders(cfg.key), body: JSON.stringify(body) }); }
      catch (e) {
        if (e.status !== 400) throw e;
        delete body.output_config; // 旧模型不支持结构化输出时，退回提示词约束
        d = await httpJson(`${base}/v1/messages`, { method: 'POST', headers: anthropicHeaders(cfg.key), body: JSON.stringify(body) });
      }
      if (d.stop_reason === 'refusal') throw new Error('模型拒绝了这次请求，请换一张照片或换个模型');
      const out = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      return parseJson(out);
    }
    const body = {
      model: cfg.model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: dataUrl ? [{ type: 'image_url', image_url: { url: dataUrl } }, { type: 'text', text }] : text },
      ],
      response_format: { type: 'json_object' },
    };
    const headers = { Authorization: 'Bearer ' + cfg.key, 'content-type': 'application/json' };
    let d;
    try { d = await httpJson(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) }); }
    catch (e) {
      if (e.status !== 400) throw e;
      delete body.response_format;
      d = await httpJson(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
    }
    const msg = d.choices && d.choices[0] && d.choices[0].message;
    const content = msg && (typeof msg.content === 'string' ? msg.content : (msg.content || []).map(x => x.text || '').join(''));
    if (typeof window !== 'undefined' && window.__AI_DEBUG) window.__AI_DEBUG(content);
    return parseJson(content);
  }

  /* 压缩照片：最长边 1024px，JPEG 0.8 */
  function compress(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, 1024 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取这张图片')); };
      img.src = url;
    });
  }

  /* 热量数据分析：只发送汇总数字，不发照片 */
  async function analyzeWeek(cfg, summary) {
    const base = trimBase(cfg.base);
    if (!base || !cfg.key || !cfg.model) throw new Error('请先在“我的 → 大模型接口”里填好接口、Key 并选择模型');
    const sys = '你是按《健身Excel超级套表》（B站好人松松）执行饮食训练的教练助手。根据用户最近几天的热量和体重数据，用中文给出不超过 200 字的分析：先一句话结论，再列 2-3 条具体可执行的建议（比如每天少吃多少克米饭、瘦肉吃够没有）。套表规则：减脂 2 周约减重 2%；体重只比较 1-2 周平均值；只吃瘦肉，不吃高脂肉和糖油混合物；减脂期记录到的摄入本就低于实际（原表预留了 10-20%）。不要编造数据里没有的信息。';
    const user = '我的数据（JSON）：' + JSON.stringify(summary);
    if (cfg.type === 'anthropic') {
      const d = await httpJson(`${base}/v1/messages`, { method: 'POST', headers: anthropicHeaders(cfg.key), body: JSON.stringify({ model: cfg.model, max_tokens: 2000, system: sys, messages: [{ role: 'user', content: user }] }) });
      return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    }
    const d = await httpJson(`${base}/chat/completions`, { method: 'POST', headers: { Authorization: 'Bearer ' + cfg.key, 'content-type': 'application/json' }, body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }) });
    const m = d.choices && d.choices[0] && d.choices[0].message;
    return String(m && (typeof m.content === 'string' ? m.content : (m.content || []).map(x => x.text || '').join('')) || '').trim();
  }


  /* ---------- 助手：多轮对话 + 工具调用 ---------- */
  // 助手用文字模型：优先选工具调用稳定的大模型；没有就用拍照识别的那个
  const CHAT_PREFER = [/^qwen3-max$/i, /^qwen-plus-latest$/i, /^qwen-plus$/i, /^qwen3-max/i, /^qwen-max$/i, /^deepseek-v3\.2$/i, /^deepseek-v3/i, /^glm-5/i, /^glm-4\.[5-9]/i,
    /^kimi-k2\.\d$/i, /^gpt-5/i, /^gpt-4\.1/i, /^gpt-4o$/i, /^claude-(opus|sonnet)/i, /^doubao-seed/i, /^moonshot-v1/i];
  function defaultChatModel(cfg, models) {
    const ok = (models || []).filter(m => !/(thinking|-r1|ocr|realtime|audio|tts|asr|embedding|coder|code|image|wanx|vl|vision|distill|preview)/i.test(m.id));
    for (const re of CHAT_PREFER) { const hit = ok.find(m => re.test(m.id)); if (hit) return hit.id; }
    return cfg.model || (ok[0] || {}).id || '';
  }
  // 对话统一用 OpenAI 格式保存；Claude 接口时临时转换
  function toAnthropic(messages) {
    const out = [];
    messages.forEach(m => {
      if (m.role === 'system') return;
      if (m.role === 'tool') {
        const block = { type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content };
        const last = out[out.length - 1];
        if (last && last.role === 'user' && Array.isArray(last.content) && last.content.every(b => b.type === 'tool_result')) last.content.push(block);
        else out.push({ role: 'user', content: [block] });
        return;
      }
      if (m.role === 'assistant') {
        const content = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        (m.tool_calls || []).forEach(tc => { let input = {}; try { input = JSON.parse(tc.function.arguments || '{}'); } catch (e) { /* 参数坏了就给空 */ } content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input }); });
        out.push({ role: 'assistant', content: content.length ? content : [{ type: 'text', text: '…' }] });
        return;
      }
      out.push({ role: 'user', content: m.content });
    });
    return out;
  }
  /* 发一轮：返回 { content, tool_calls }（OpenAI 格式的 assistant 消息） */
  async function chatOnce(cfg, messages, tools, signal) {
    const base = trimBase(cfg.base), model = cfg.chatModel || cfg.model;
    if (!base || !cfg.key || !model) throw new Error('请先在“我的 → 大模型接口”里填好接口、Key 并选择模型');
    if (cfg.type === 'anthropic') {
      const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
      const body = { model, max_tokens: 4000, temperature: 0.2, system: sys, messages: toAnthropic(messages) };
      if (tools && tools.length) body.tools = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
      const post = () => httpJson(`${base}/v1/messages`, { method: 'POST', headers: anthropicHeaders(cfg.key), body: JSON.stringify(body), signal }, 120000);
      // 有的模型不接受 temperature，报 400 就去掉再试一次
      const d = await post().catch(e => { if (e.status !== 400) throw e; delete body.temperature; return post(); });
      const blocks = d.content || [];
      return {
        role: 'assistant',
        content: blocks.filter(b => b.type === 'text').map(b => b.text).join(''),
        tool_calls: blocks.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } })),
      };
    }
    const body = { model, temperature: 0.2, messages: messages.map(m => { const x = { role: m.role, content: m.content == null ? '' : m.content }; if (m.tool_calls && m.tool_calls.length) x.tool_calls = m.tool_calls; if (m.tool_call_id) x.tool_call_id = m.tool_call_id; return x; }) };
    if (tools && tools.length) body.tools = tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
    const post = () => httpJson(`${base}/chat/completions`, { method: 'POST', headers: { Authorization: 'Bearer ' + cfg.key, 'content-type': 'application/json' }, body: JSON.stringify(body), signal }, 120000);
    const d = await post().catch(e => { if (e.status !== 400) throw e; delete body.temperature; return post(); });
    const m = (d.choices && d.choices[0] && d.choices[0].message) || {};
    const content = typeof m.content === 'string' ? m.content : (m.content || []).map(x => x.text || '').join('');
    const calls = (m.tool_calls || []).map((tc, i) => ({ id: tc.id || 'call_' + Date.now() + '_' + i, type: 'function', function: { name: tc.function.name, arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments || {}) } }));
    return { role: 'assistant', content: content.replace(/<think>[\s\S]*?<\/think>/g, '').trim(), tool_calls: calls };
  }
  /* 跑完一次提问：模型要调工具就执行，直到给出文字回答（最多 8 轮） */
  async function agent(cfg, messages, tools, runTool, onStep, signal) {
    for (let i = 0; i < 8; i++) {
      if (signal && signal.aborted) { const err = new Error('已停止'); err.stopped = true; throw err; }
      const msg = await chatOnce(cfg, messages, tools, signal);
      messages.push(msg);
      if (!msg.tool_calls || !msg.tool_calls.length) return msg.content;
      for (const tc of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) { /* 忽略 */ }
        if (onStep) onStep({ name: tc.function.name, args });
        let result;
        try { result = await runTool(tc.function.name, args); } catch (e) { result = { error: e.message || String(e) }; }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: typeof result === 'string' ? result : JSON.stringify(result) });
      }
    }
    return '（查了太多次还没有结论，请把问题说得具体一点）';
  }

  /* 助手看图：用“看图模型”把照片描述成文字（器械、动作、食物），再交给助手按套表回答 */
  async function describeImage(cfg, dataUrl, question, signal) {
    const base = trimBase(cfg.base);
    if (!cfg.model) throw new Error('没有设置看图模型');
    const sys = '你是健身房里的助手，帮用户看照片。用中文描述照片里的东西：如果是健身器械，说出器械的常见名称（中文和英文）、主要练哪块肌肉、常见的调节部位；如果是动作，说出动作名称和主要发力肌肉；如果是食物，说出食物名称和大概分量。只描述看到的内容，看不清就说看不清，不超过 150 字。';
    const text = '用户的问题：' + (question || '这是什么？');
    const b64 = dataUrl.split(',')[1];
    if (cfg.type === 'anthropic') {
      const d = await httpJson(`${base}/v1/messages`, { method: 'POST', headers: anthropicHeaders(cfg.key), signal, body: JSON.stringify({ model: cfg.model, max_tokens: 800, system: sys,
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text }] }] }) });
      return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    }
    const d = await httpJson(`${base}/chat/completions`, { method: 'POST', headers: { Authorization: 'Bearer ' + cfg.key, 'content-type': 'application/json' }, signal,
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: sys }, { role: 'user', content: [{ type: 'image_url', image_url: { url: dataUrl } }, { type: 'text', text }] }] }) });
    const m = (d.choices && d.choices[0] && d.choices[0].message) || {};
    return String(typeof m.content === 'string' ? m.content : (m.content || []).map(x => x.text || '').join('')).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  return { PRESETS, listModels, defaultModel, defaultChatModel, describeImage, analyze, analyzeWeek, compress, systemPrompt, chatOnce, agent };
})();
