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
  const VISION = /(vl|vision|4v|omni|gpt-4o|gpt-4\.1|gpt-5|claude|gemini|glm-4\.?\dv|qvq|seed|kimi-k2|o3|o4|pixtral|llava|internvl)/i;
  const trimBase = b => String(b || '').trim().replace(/\/+$/, '');

  function anthropicHeaders(key) {
    return {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    };
  }
  async function httpJson(url, opts) {
    let res;
    try { res = await fetch(url, opts); }
    catch (e) { throw new Error('网络请求失败，请检查网络或接口地址（' + (e.message || e) + '）'); }
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
    ids = ids.filter(m => m.id).map(m => ({ ...m, vision: cfg.type === 'anthropic' || VISION.test(m.id) }));
    ids.sort((a, b) => (b.vision - a.vision) || a.id.localeCompare(b.id));
    return ids;
  }
  function defaultModel(cfg, models) {
    if (cfg.type === 'anthropic') {
      const pref = models.find(m => m.id === 'claude-opus-5');
      if (pref) return pref.id;
    }
    const v = models.find(m => m.vision);
    return (v || models[0] || {}).id || '';
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
      '只输出一个 JSON 对象，不要输出其他文字。',
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
      `这是我的${ctx.meal || '一餐'}照片。`,
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
    obj.items = (obj.items || []).map(it => ({
      name: String(it.name || '未知'), grams: Math.round(+it.grams || 0),
      carbs_g: Math.round(+it.carbs_g || 0), protein_g: Math.round(+it.protein_g || 0), fat_g: Math.round(+it.fat_g || 0),
      kcal: Math.round(+it.kcal || 0), category: it.category || '其他', note: it.note || '',
    }));
    const t = obj.items.reduce((s, it) => ({ carbs_g: s.carbs_g + it.carbs_g, protein_g: s.protein_g + it.protein_g, fat_g: s.fat_g + it.fat_g, kcal: s.kcal + it.kcal }), { carbs_g: 0, protein_g: 0, fat_g: 0, kcal: 0 });
    obj.total = t;
    obj.flags = Array.isArray(obj.flags) ? obj.flags.map(String) : [];
    obj.advice = String(obj.advice || '');
    obj.confidence = Math.max(0, Math.min(1, +obj.confidence || 0));
    return obj;
  }

  async function analyze(cfg, dataUrl, ctx) {
    const base = trimBase(cfg.base);
    if (!base || !cfg.key || !cfg.model) throw new Error('请先在“设置 → 拍照识别”里填好接口、Key 并选择模型');
    const b64 = dataUrl.split(',')[1];
    const sys = systemPrompt();
    const text = userText(ctx);
    if (cfg.type === 'anthropic') {
      const body = {
        model: cfg.model, max_tokens: 4000, system: sys,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          { type: 'text', text },
        ] }],
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
        { role: 'user', content: [{ type: 'image_url', image_url: { url: dataUrl } }, { type: 'text', text }] },
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

  return { PRESETS, listModels, defaultModel, analyze, compress, systemPrompt };
})();
