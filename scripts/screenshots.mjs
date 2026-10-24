// 生成 README 用的 App 截图：用本机 Chrome 无头模式打开 www/，放一个演示用的资料和三周体重记录，按页面截图到 docs/screens/。
// 用法：node scripts/screenshots.mjs        （需要装了 Google Chrome；会临时在 8799 端口起一个静态服务器）
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'screens');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8799, DBG = 9333, W = 390, H = 844;
const sleep = ms => new Promise(r => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', String(PORT), '-d', join(ROOT, 'www')], { stdio: 'ignore' });
const profileDir = mkdtempSync(join(tmpdir(), 'lcd-shots-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${profileDir}`, '--hide-scrollbars', '--mute-audio', '--no-first-run', 'about:blank'], { stdio: 'ignore' });

let ws, id = 0; const waits = {};
async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json(); const p = list.find(t => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch { }
    await sleep(200);
  }
  throw new Error('连不上 Chrome');
}
const send = (method, params = {}) => new Promise(ok => { const n = ++id; waits[n] = ok; ws.send(JSON.stringify({ id: n, method, params })); });
const run = async js => { const r = await send('Runtime.evaluate', { expression: `(async()=>{${js}})()`, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) console.log('页面报错', r.result.exceptionDetails.text); return r.result && r.result.result && r.result.result.value; };
async function shot(name, wait = 900) {
  await sleep(wait);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'));
  console.log('截图', name);
}

try {
  ws = new WebSocket(await connect());
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && waits[m.id]) { waits[m.id](m); delete waits[m.id]; } });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') console.log('页面报错：', m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Page.bringToFront'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  const go = async () => { await send('Page.navigate', { url: `http://localhost:${PORT}/` }); await sleep(1800); };

  // 1. 第一次打开：引导
  await go(); await run(`localStorage.clear()`); await go();
  await shot('01-welcome');

  // 演示资料：男 26 岁 175cm 82kg，健身房三分化，晚饭前练；三周体重从 84.2 降到 82
  await run(`
    const p = { name: '小林', sex: 'M', age: 26, height: 175, weight: 82, waist: 88, goal: 'auto', lift: true, level: 'new', place: 'gym',
      liftDays: [0, 1, 2, 3, 4, 5], parts: { chest: true, back: true, shoulder: true, arm: true, legs: true, abs: true }, liftTime: '18:30',
      wake: '07:30', breakfast: '08:00', lunch: '12:00', dinner: '19:30', sleep: '23:30', eggsMilk: true, startDate: new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10), startWeight: 84.2 };
    localStorage.setItem('lcd:profile', JSON.stringify(Object.assign({}, Me.DEF, p)));
    localStorage.setItem('lcd:guideNext', 'false'); localStorage.setItem('lcd:seenVersion', JSON.stringify(C.APP_VERSION));
    const months = {}, t = new Date();
    for (let i = 21; i >= 0; i--) { const d = new Date(t - i * 864e5), k = d.toISOString().slice(0, 10), ym = k.slice(0, 7);
      (months[ym] = months[ym] || {})[k] = { done: {}, weight: Math.round((84.2 - (21 - i) * 0.105 + Math.sin(i) * 0.25) * 10) / 10 }; }
    Object.entries(months).forEach(([ym, m]) => localStorage.setItem('lcd:m:' + ym, JSON.stringify(m)));`);
  await go();
  await shot('02-today', 1200);
  await run(`document.querySelector('[data-tab=train]').click()`); await shot('03-train', 1200);
  // 动作要点：打开第一个动作的“要点”
  await run(`const b = document.querySelector('.dc.top [data-tips]') || document.querySelector('[data-tips]'); b && b.click()`);
  await shot('04-tips', 1200);
  await run(`const h = [...document.querySelectorAll('.fsec h3')].find(x => x.textContent === '看动作'); if (h) { h.scrollIntoView({ block: 'start' }); const d = document.querySelector('[data-demo]'); d && d.click(); }`);
  await shot('05-demo', 6000);
  await run(`C.close()`); await sleep(600);
  await run(`document.querySelector('[data-tab=food]').click()`); await shot('06-food', 1200);
  await run(`document.querySelector('[data-tab=data]').click()`); await sleep(800);
  await run(`const h = [...document.querySelectorAll('h2,h3,button,.sec-title,span')].find(x => x.textContent.trim().startsWith('体重')); if (h) scrollTo(0, h.getBoundingClientRect().top + scrollY - 120)`);
  await shot('07-data', 1200);
  await run(`document.querySelector('[data-tab=me]').click()`); await shot('08-me', 1200);
  // 深色模式
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await run(`document.querySelector('[data-tab=today]').click()`); await shot('09-today-dark', 1200);
} finally {
  try { ws && ws.close(); } catch { }
  chrome.kill(); server.kill();
  await sleep(500); rmSync(profileDir, { recursive: true, force: true });
}
