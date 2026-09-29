/*
 * 内置大模型（离线）：模型文件下载到 App 私有目录，用原生插件 LocalLlm（llama.cpp）在手机上生成。
 * 浏览器里调试时，可以在 localStorage 里设 lcd:llmDev = "http://127.0.0.1:8080"，改用电脑上的 llama-server。
 */
window.LocalAI = (() => {
const MODELS = [
  { id: 'qwen3-1.7b', name: 'Qwen3 1.7B', tag: '推荐', file: 'Qwen3-1.7B-Q4_0.gguf', size: 1056782912,
    url: 'https://modelscope.cn/models/unsloth/Qwen3-1.7B-GGUF/resolve/master/Qwen3-1.7B-Q4_0.gguf', note: '回答更稳；运行时约占 1.5GB 内存' },
  { id: 'qwen3-0.6b', name: 'Qwen3 0.6B', tag: '轻量', file: 'Qwen3-0.6B-Q4_0.gguf', size: 382156480,
    url: 'https://modelscope.cn/models/unsloth/Qwen3-0.6B-GGUF/resolve/master/Qwen3-0.6B-Q4_0.gguf', note: '更快、更省电，回答质量差一些' },
];
const DIR = 'models';
const store = { get: () => Object.assign({ model: 'qwen3-1.7b', use: 'cloud', have: {}, threads: 4 }, C.LS.get('local') || {}), set: v => C.LS.set('local', v) };
const native = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
let plugin = null;
const P = () => plugin || (plugin = window.capacitorExports && window.capacitorExports.registerPlugin('LocalLlm'));
const FS = () => window.capacitorFilesystemPluginCapacitor && window.capacitorFilesystemPluginCapacitor.Filesystem;
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
  try { const st = await FS().stat({ path: `${DIR}/${m.file}`, directory: 'DATA' }); return !m.size || st.size === m.size || st.size > 1e8; } catch (e) { return false; }
}
async function pathOf(m) { const r = await FS().getUri({ path: `${DIR}/${m.file}`, directory: 'DATA' }); return r.uri; }

/* 下载模型：带进度；文件大，建议连 Wi-Fi */
async function download(m, onProgress) {
  if (!native() || !FS()) throw new Error('只有安卓 App 里能下载');
  let handle = null;
  try {
    handle = await FS().addListener('progress', e => { if (e.url === m.url || !e.url) onProgress && onProgress(e.bytes, e.contentLength || m.size); });
    await FS().downloadFile({ url: m.url, path: `${DIR}/${m.file}`, directory: 'DATA', progress: true, recursive: true });
  } finally { if (handle) handle.remove(); }
  const p = prefs(); p.have[m.id] = true; setPrefs(p);
}
async function remove(m) {
  try { await P().unload(); } catch (e) { /* 没加载也没关系 */ }
  try { await FS().deleteFile({ path: `${DIR}/${m.file}`, directory: 'DATA' }); } catch (e) { /* 本来就没有 */ }
  const p = prefs(); delete p.have[m.id]; setPrefs(p);
}

/* 生成：messages 用 OpenAI 格式（system/user/assistant）；onToken 边生成边回调；signal 可中止 */
async function chat(messages, { onToken, onPrefill, signal, maxTokens = 512, temperature = 0.3 } = {}) {
  if (!native() && dev()) return chatDev(messages, { onToken, signal, maxTokens, temperature });
  const m = current();
  if (!(await exists(m))) throw new Error('还没有下载内置模型，到“我的 → 大模型接口 → 内置模型”下载');
  const t0 = Date.now();
  await P().load({ path: await pathOf(m), nCtx: 4096, threads: prefs().threads || 4 });
  const loadMs = Date.now() - t0;
  const subs = [await P().addListener('token', e => onToken && onToken(e.text)), await P().addListener('prefill', e => onPrefill && onPrefill(e))];
  const abort = () => P().stop();
  if (signal) signal.addEventListener('abort', abort, { once: true });
  try {
    const r = await P().generate({ messages, maxTokens, temperature });
    if (signal && signal.aborted) { const err = new Error('已停止'); err.stopped = true; throw err; }
    return { text: r.text, stats: { loadMs, prefillMs: r.prefillMs, genMs: r.genMs, promptTokens: r.promptTokens, pieces: r.pieces } };
  } finally {
    subs.forEach(s => s.remove());
    if (signal) signal.removeEventListener('abort', abort);
  }
}
/* 浏览器调试：电脑上的 llama-server（OpenAI 兼容接口，流式） */
async function chatDev(messages, { onToken, signal, maxTokens, temperature }) {
  const t0 = Date.now();
  const res = await fetch(String(dev()).replace(/\/+$/, '') + '/v1/chat/completions', { method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, stream: true, max_tokens: maxTokens, temperature, top_k: 20, top_p: 0.8, cache_prompt: false }) });
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
/* Qwen3 会输出 <think></think>：去掉（生成中途也能用） */
function clean(t) { return String(t || '').replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/^\s+/, ''); }

return { MODELS, prefs, setPrefs, current, info, exists, download, remove, chat, clean, native, dev };
})();
