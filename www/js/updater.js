/* 应用内更新：检查 GitHub Releases → 在 App 里下载安装包（带进度）→ 调起系统安装 */
window.Updater = (() => {
const { APP_VERSION, REPO, LS, toast, sheet, close, esc } = C;
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
let installer = null;
function Installer() {
  if (!installer && window.capacitorExports && window.capacitorExports.registerPlugin) installer = window.capacitorExports.registerPlugin('ApkInstaller');
  return installer;
}
function FS() { return window.capacitorFilesystemPluginCapacitor && window.capacitorFilesystemPluginCapacitor.Filesystem; }
function newer(a, b) {
  const parse = v => { const [n, pre] = String(v).replace(/^v/, '').split('-'); return { n: n.split('.').map(k => +k || 0), pre: pre || '' }; };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if ((x.n[i] || 0) !== (y.n[i] || 0)) return (x.n[i] || 0) > (y.n[i] || 0);
  return !x.pre && !!y.pre; // 同号：正式版比预览版新
}
function prefs() { return Object.assign({ auto: true, last: 0, skip: '' }, LS.get('update') || {}); }
function savePrefs(p) { LS.set('update', Object.assign(prefs(), p)); }

async function latest() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('GitHub 返回 ' + res.status);
  const rel = await res.json();
  const apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name));
  return { tag: rel.tag_name || '', notes: rel.body || '', apk, page: rel.html_url };
}
/* silent：启动时自动检查，没有新版本就不打扰 */
async function check(silent) {
  try {
    const r = await latest();
    savePrefs({ last: Date.now() });
    if (!newer(r.tag, APP_VERSION) || !r.apk) { if (!silent) toast(`已是最新版本 ${APP_VERSION}`); return false; }
    if (silent && prefs().skip === r.tag) return false;
    offer(r); return true;
  } catch (e) { if (!silent) toast('检查更新失败，网络不稳定可稍后再试'); return false; }
}
function autoCheck() { const p = prefs(); if (p.auto && Date.now() - p.last > 12 * 3600e3) setTimeout(() => check(true), 2500); }
function notesHtml(md) {
  const lines = String(md).split('\n').filter(l => l.trim() && !l.startsWith('## ') && !/^第一个版本/.test(l)).slice(0, 8);
  return lines.map(l => `<div class="t-foot l2" style="padding-left:14px;position:relative">${l.startsWith('- ') ? '<span style="position:absolute;left:0">·</span>' : ''}${esc(l.replace(/^- /, ''))}</div>`).join('');
}
function offer(r) {
  const mb = r.apk.size ? (r.apk.size / 1048576).toFixed(1) + ' MB' : '';
  sheet(`<h2>发现新版本 ${esc(r.tag)}</h2><div class="sheet-sub">当前 ${APP_VERSION}${mb ? ' · 安装包 ' + mb : ''}</div>
    <div class="mat card" style="gap:6px;max-height:34vh;overflow:auto">${notesHtml(r.notes) || '<div class="t-foot l2">改进和修复</div>'}</div>
    <button class="pill ink wide" id="up-go">立即更新</button><div class="deck-ctrl" style="margin:0"><button class="pill glass" id="up-later">以后再说</button><button class="pill glass" id="up-skip">跳过这个版本</button></div>`, m => {
    m.querySelector('#up-later').onclick = close;
    m.querySelector('#up-skip').onclick = () => { savePrefs({ skip: r.tag }); close(); };
    m.querySelector('#up-go').onclick = () => download(r);
  });
}
async function download(r) {
  if (!isNative() || !FS()) { window.open(r.apk.browser_download_url, '_blank'); return; }
  sheet(`<h2>正在下载 ${esc(r.tag)}</h2><div class="sheet-sub" id="up-pct">准备中…</div><div class="progress"><i id="up-bar" style="width:0%"></i></div><p class="t-foot l3" style="text-align:center">下载完成后会打开系统安装界面，数据会保留</p>`);
  let handle = null;
  try {
    handle = await FS().addListener('progress', e => {
      const total = e.contentLength || r.apk.size || 0, pct = total ? Math.min(100, Math.round(e.bytes / total * 100)) : 0;
      const bar = document.getElementById('up-bar'), txt = document.getElementById('up-pct');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = total ? `${pct}% · ${(e.bytes / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB` : `${(e.bytes / 1048576).toFixed(1)} MB`;
    });
    const res = await FS().downloadFile({ url: r.apk.browser_download_url, path: 'lianchi-update.apk', directory: 'CACHE', progress: true });
    if (handle) handle.remove();
    await install(res.path, r);
  } catch (e) {
    if (handle) handle.remove();
    sheet(`<h2>下载失败</h2><p class="t-sub l2" style="text-align:center">${esc(e.message || e)}</p><p class="t-foot l3" style="text-align:center">国内访问 GitHub 不稳定，可以换个网络重试，或用浏览器下载</p>
      <button class="pill ink wide" id="up-retry">重试</button><button class="pill glass wide" id="up-web">用浏览器下载</button>`, m => {
      m.querySelector('#up-retry').onclick = () => download(r);
      m.querySelector('#up-web').onclick = () => { window.open(r.apk.browser_download_url, '_blank'); close(); };
    });
  }
}
async function install(path, r) {
  const ins = Installer();
  if (!ins) { toast('安装组件不可用，请用浏览器下载'); window.open(r.apk.browser_download_url, '_blank'); return; }
  const { allowed } = await ins.canInstall();
  if (!allowed) {
    sheet(`<h2>需要允许安装</h2><p class="t-sub l2" style="text-align:center">第一次在 App 内更新，需要在系统设置里允许“练吃日课”安装应用。允许后回到这里继续。</p>
      <button class="pill glass wide" id="up-set">去设置里允许</button><button class="pill ink wide" id="up-ins">已允许，开始安装</button>`, m => {
      m.querySelector('#up-set').onclick = () => ins.openInstallSettings();
      m.querySelector('#up-ins').onclick = async () => { const c = await ins.canInstall(); if (!c.allowed) { toast('还没有允许'); return; } close(); await ins.install({ path }); };
    });
    return;
  }
  close(); await ins.install({ path });
}
return { check, autoCheck, prefs, savePrefs };
})();
