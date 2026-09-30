/* 外观：浅色/深色、主题色、背景色调、毛玻璃模糊与不透明度、头像 */
window.Look = (() => {
const DEF = { mode: 'system', accent: 'ink', tone: 'cool', blur: 26, alpha: 1, lite: false, style: 'glass', v: 2 };
/* 卡片风格（实验）：[id, 名称, 说明, 浅色底, 深色底]；底色也用来给安卓系统栏后面的窗口上色 */
const STYLES = [
  ['glass', '玻璃', '默认：柔和阴影、半透明高光', null, null],
  ['paper', '纸本', '暖色纸张、细线、衬线标题', '#F2EEE6', '#1A1815'],
  ['bold', '粗线条', '粗黑描边、硬投影', '#F3F0E6', '#16150F'],
  ['neon', '霓虹', '总是深色，主题色发光描边', '#07080C', '#07080C'],
  ['soft', '柔雾', '主题色浅底、大圆角、柔和凸起', null, null],
];
const ACCENTS = [['blue', '蓝', '#0A7CFF'], ['indigo', '靛蓝', '#5856D6'], ['green', '松绿', '#1FA35C'], ['orange', '橘', '#F07A1A'], ['rose', '玫红', '#E5486F'], ['ink', '墨', 'ink']];
const TONES = [['cool', '冷灰', '#E8EAEE', '#0B0C0F'], ['warm', '暖灰', '#EDEAE6', '#0F0D0B'], ['mist', '雾蓝', '#E6EBF1', '#0A0D12'], ['sage', '雾绿', '#E7EBE7', '#0B0E0C'], ['white', '素白', '#F4F5F7', '#121316']];
const store = {
  get(k) { try { const v = localStorage.getItem('lcd:' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('lcd:' + k); else localStorage.setItem('lcd:' + k, JSON.stringify(v)); } catch (e) { /* 存不下就不保存 */ } },
};
function get() {
  const saved = store.get('look') || {};
  // 1.7.1 起卡片默认不透明：旧版本存下的默认值 0.56 升级成 1
  if (saved.v !== 2) { if (saved.alpha == null || Math.abs(saved.alpha - 0.56) < 0.001) saved.alpha = 1; saved.v = 2; }
  return Object.assign({}, DEF, saved);
}
function isDark(l) { return l.mode === 'dark' || (l.mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); }
function apply(l) {
  l = l || get();
  const r = document.documentElement;
  // 明暗写成确定的值（跟随系统时也写），卡片风格按它切换深浅；霓虹总是深色
  const dark = l.style === 'neon' || isDark(l);
  r.dataset.mode = dark ? 'dark' : 'light';
  if (l.style && l.style !== 'glass') r.dataset.style = l.style; else delete r.dataset.style;
  if (l.tone === 'cool') delete r.dataset.tone; else r.dataset.tone = l.tone;
  const a = ACCENTS.find(x => x[0] === l.accent) || ACCENTS[0];
  r.style.setProperty('--accent', a[2] === 'ink' ? 'var(--ink)' : a[2]);
  r.style.setProperty('--on-primary', a[2] === 'ink' ? 'var(--bg)' : '#fff');
  r.style.setProperty('--blur', Math.round(l.blur) + 'px');
  r.style.setProperty('--ga', String(l.alpha));
  if (l.lite) r.dataset.lite = ''; else delete r.dataset.lite;
  const t = TONES.find(x => x[0] === l.tone) || TONES[0];
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
  const st = STYLES.find(x => x[0] === l.style) || STYLES[0];
  const bg = (dark ? st[4] : st[3]) || (dark ? t[3] : t[2]);
  const m = document.createElement('meta'); m.name = 'theme-color'; m.content = bg; document.head.appendChild(m);
  native(bg, dark);
}
/* 安卓：系统栏后面的窗口涂成和页面一样的底色（旧版 WebView 会在系统栏位置留白），状态栏图标跟着深浅变 */
const plugins = {};
function native(bg, dark) {
  try {
    if (!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && window.capacitorExports)) return;
    const reg = window.capacitorExports.registerPlugin;
    plugins.chrome = plugins.chrome || reg('AppChrome');
    plugins.bars = plugins.bars || reg('SystemBars');
    plugins.chrome.setBackground({ color: bg }).catch(() => {});
    plugins.bars.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => {});
  } catch (e) { /* 旧版本没有这些插件也不影响使用 */ }
}
function set(patch) { const l = Object.assign(get(), patch); store.set('look', l); apply(l); return l; }
function reset() { store.set('look', null); apply(DEF); }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply());

/* 头像：存成 256×256 的 JPEG */
function avatar() { return store.get('avatar'); }
function setAvatar(dataUrl) { store.set('avatar', dataUrl); }
function cropAvatar(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取这张图片')); };
    img.src = url;
  });
}
function avatarHtml(name, size) {
  const a = avatar(), st = size ? `width:${size}px;height:${size}px;font-size:${Math.round(size * .4)}px` : '';
  return a ? `<img class="avatar" src="${a}" alt="头像" style="object-fit:cover;${st}">` : `<div class="avatar" style="${st}">${String(name || '我').slice(0, 1).replace(/[<>&"]/g, '')}</div>`;
}
apply();
return { DEF, ACCENTS, TONES, STYLES, get, set, reset, apply, isDark, avatar, setAvatar, cropAvatar, avatarHtml };
})();
