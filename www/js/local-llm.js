/*
 * 内置大模型（离线）：模型文件下载到 App 私有目录，用原生插件 LocalLlm（llama.cpp）在手机上生成。
 * 浏览器里调试时，可以在 localStorage 里设 lcd:llmDev = "http://127.0.0.1:8080"，改用电脑上的 llama-server。
 */
window.LocalAI = (() => {
const MODELS = [
  // Qwen3.5：只有 1/4 的层是完整注意力，上下文开到 8K 也只多占几十 MB；思考模式在原生层关掉（等同 enable_thinking=false）
  { id: 'qwen35-2b', name: 'Qwen3.5 2B', tag: '推荐', file: 'Qwen3.5-2B-Q4_0.gguf', size: 1214873856, nCtx: 8192, maxTokens: 500,
    url: 'https://modelscope.cn/models/unsloth/Qwen3.5-2B-GGUF/resolve/master/Qwen3.5-2B-Q4_0.gguf', note: '回答最完整；运行时约占 1.6GB 内存',
    vision: { file: 'mmproj-Qwen3.5-2B-F16.gguf', size: 668227264, url: 'https://modelscope.cn/models/unsloth/Qwen3.5-2B-GGUF/resolve/master/mmproj-F16.gguf' } },
  { id: 'qwen35-0.8b', name: 'Qwen3.5 0.8B', tag: '轻量', file: 'Qwen3.5-0.8B-Q4_0.gguf', size: 507154688, nCtx: 8192, maxTokens: 500,
    url: 'https://modelscope.cn/models/unsloth/Qwen3.5-0.8B-GGUF/resolve/master/Qwen3.5-0.8B-Q4_0.gguf', note: '更快、更省电，回答质量差一些',
    vision: { file: 'mmproj-Qwen3.5-0.8B-F16.gguf', size: 204987232, url: 'https://modelscope.cn/models/unsloth/Qwen3.5-0.8B-GGUF/resolve/master/mmproj-F16.gguf' } },
  { id: 'qwen3-1.7b', name: 'Qwen3 1.7B', tag: '上一版', file: 'Qwen3-1.7B-Q4_0.gguf', size: 1056782912, nCtx: 4096, maxTokens: 450,
    url: 'https://modelscope.cn/models/unsloth/Qwen3-1.7B-GGUF/resolve/master/Qwen3-1.7B-Q4_0.gguf', note: '1.7 版本用的模型，已经下载过可以继续用' },
];
const DIR = 'models';
const store = { get: () => Object.assign({ enabled: false, model: 'qwen35-2b', use: 'cloud', have: {}, threads: 4 }, C.LS.get('local') || {}), set: v => C.LS.set('local', v) };
const native = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
let plugin = null;
const P = () => plugin || (plugin = window.capacitorExports && window.capacitorExports.registerPlugin('LocalLlm'));
const dev = () => { try { return JSON.parse(localStorage.getItem('lcd:llmDev')) || localStorage.getItem('lcd:llmDev'); } catch (e) { return localStorage.getItem('lcd:llmDev'); } };

function prefs() { return store.get(); }
function setPrefs(p) { store.set(Object.assign(store.get(), p)); }
function current() { const p = prefs(); return MODELS.find(m => m.id === p.model) || MODELS[0]; }

/* 这台手机能不能跑、模型下载了没有 */
async function info() {
  if (!native()) return dev() ? { available: true, dev: true, ready: true, reason: '' } : { available: false, reason: '只有安卓 App 里能用内置模型' };
  try {
    const i = await P().info();
    const m = current(), have = await exists(m);
    return { ...i, ready: i.available && have, have };
  } catch (e) { return { available: false, reason: '内置模型组件不可用' }; }
}
async function exists(m) {
  if (!native()) return !!dev();
  try { return (await P().fileInfo({ file: m.file, size: m.size })).done; } catch (e) { return false; }
}
async function partial(m) { if (!native()) return 0; try { return (await P().fileInfo({ file: m.file, size: m.size })).partial || 0; } catch (e) { return 0; } }
async function pathOf(m) { return (await P().fileInfo({ file: m.file, size: m.size })).path; }

/* 下载：原生插件负责（断点续传、后台进行），这里只记进度，页面随时可以重新画进度条 */
const dl = { id: null, bytes: 0, total: 0, running: false, error: '' };
const watchers = new Set();
let subscribed = false;
function onDownload(fn) { watchers.add(fn); return () => watchers.delete(fn); }
async function subscribe() {
  if (subscribed || !native()) return;
  subscribed = true;
  await P().addListener('download', e => {
    const m = MODELS.find(x => x.file === e.file || (x.vision && x.vision.file === e.file));
    Object.assign(dl, { id: m ? m.id + (m.file === e.file ? '' : ':vision') : null, bytes: e.bytes || 0, total: e.total || (m && m.size) || 0, running: !e.done && !e.error, error: e.error || '' });
    watchers.forEach(fn => { try { fn(dl); } catch (err) { /* 画进度条出错不影响下载 */ } });
  });
}
async function download(m) {
  if (!native()) throw new Error('只有安卓 App 里能下载');
  await subscribe();
  Object.assign(dl, { id: m.id, bytes: await partial(m), total: m.size, running: true, error: '' });
  watchers.forEach(fn => fn(dl));
  await P().download({ url: m.url, file: m.file, size: m.size });
  const p = prefs(); p.have[m.id] = true; setPrefs(p);
}
function pause() { if (native()) P().cancelDownload(); }
/* 看图（Qwen3.5 是图文模型）：另外下载一个视觉投影文件 mmproj，下载后离线也能看照片 */
async function visionReady(m) { m = m || current(); if (!m.vision) return false; if (!native()) return !!dev(); return exists(m.vision); }
async function downloadVision(m) {
  if (!native()) throw new Error('只有安卓 App 里能下载');
  await subscribe();
  Object.assign(dl, { id: m.id + ':vision', bytes: await partial(m.vision), total: m.vision.size, running: true, error: '' });
  watchers.forEach(fn => fn(dl));
  await P().download({ url: m.vision.url, file: m.vision.file, size: m.vision.size });
}
async function removeVision(m) { if (native() && m.vision) await P().deleteModel({ file: m.vision.file }); }
async function remove(m) {
  if (native()) await P().deleteModel({ file: m.file });
  const p = prefs(); delete p.have[m.id]; setPrefs(p);
}

/* 生成：messages 用 OpenAI 格式（system/user/assistant）；onToken 边生成边回调；signal 可中止 */
async function chat(messages, { onToken, onPrefill, signal, maxTokens = 512, temperature = 0.3, image } = {}) {
  if (!native() && dev()) return chatDev(messages, { onToken, signal, maxTokens, temperature, image });
  const m = current();
  if (!(await exists(m))) throw new Error('还没有下载内置模型，到“我的 → 内置模型”下载');
  if (image && !(await visionReady(m))) throw new Error('还没有下载看图组件，到“我的 → 内置模型”下载');
  if (image) image = await shrink(image);
  const t0 = Date.now();
  await P().load({ path: await pathOf(m), nCtx: m.nCtx || 4096, threads: prefs().threads || 4, mmproj: image ? await pathOf(m.vision) : '' });
  const loadMs = Date.now() - t0;
  const subs = [await P().addListener('token', e => onToken && onToken(e.text)), await P().addListener('prefill', e => onPrefill && onPrefill(e))];
  const abort = () => P().stop();
  if (signal) signal.addEventListener('abort', abort, { once: true });
  try {
    // noThink：在对话模板后面接一个空的思考块，等同 chat_template_kwargs.enable_thinking=false
    const r = await P().generate({ messages, maxTokens, temperature, noThink: true, image: image || '' });
    if (signal && signal.aborted) { const err = new Error('已停止'); err.stopped = true; throw err; }
    return { text: r.text, stats: { loadMs, prefillMs: r.prefillMs, genMs: r.genMs, promptTokens: r.promptTokens, pieces: r.pieces } };
  } finally {
    subs.forEach(s => s.remove());
    if (signal) signal.removeEventListener('abort', abort);
  }
}
/* 浏览器调试：电脑上的 llama-server（OpenAI 兼容接口，流式） */
async function chatDev(messages, { onToken, signal, maxTokens, temperature, image }) {
  const t0 = Date.now();
  if (image) image = await shrink(image);
  // 带图：OpenAI 格式，图片放在最后一条用户消息里（llama-server 要用 --mmproj 启动）
  if (image) { const i = messages.map(x => x.role).lastIndexOf('user'); messages = messages.map((x, k) => k === i ? { role: 'user', content: [{ type: 'image_url', image_url: { url: image.startsWith('data:') ? image : 'data:image/jpeg;base64,' + image } }, { type: 'text', text: x.content }] } : x); }
  const res = await fetch(String(dev()).replace(/\/+$/, '') + '/v1/chat/completions', { method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, stream: true, max_tokens: maxTokens, temperature, top_k: 20, top_p: 0.8, cache_prompt: false, chat_template_kwargs: { enable_thinking: false } }) });
  if (!res.ok) throw new Error('llama-server 返回 ' + res.status);
  const rd = res.body.getReader(), dec = new TextDecoder();
  let buf = '', text = '', first = 0;
  for (;;) {
    const { value, done } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:') || line === 'data: [DONE]') continue;
      try { const d = JSON.parse(line.slice(5)); const piece = (d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content) || ''; if (piece) { if (!first) first = Date.now(); text += piece; onToken && onToken(piece); } } catch (e) { /* 半行 */ }
    }
  }
  return { text, stats: { loadMs: 0, prefillMs: (first || Date.now()) - t0, genMs: Date.now() - (first || Date.now()) } };
}
/* 给内置模型看的图缩小到长边 448 像素：手机 CPU 上图片越大越慢（图片会变成上千个词元），448 已经够看清器械和饭菜 */
function shrink(dataUrl, max = 448) {
  return new Promise((ok, bad) => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.85)); }; im.onerror = () => bad(new Error('图片读不出来')); im.src = dataUrl; });
}
/* Qwen3 会输出 <think></think>：去掉（生成中途也能用） */
function clean(t) { return String(t || '').replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/^\s+/, ''); }

return { MODELS, prefs, setPrefs, current, info, exists, partial, download, pause, remove, dl, onDownload, chat, clean, native, dev, visionReady, downloadVision, removeVision };
})();
