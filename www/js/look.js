/* 外观：浅色/深色、主题色、背景色调、毛玻璃模糊与不透明度、头像 */
window.Look = (() => {
const DEF = { mode: 'system', accent: 'blue', tone: 'cool', blur: 26, alpha: 0.56 };
const ACCENTS = [['blue', '蓝', '#0A7CFF'], ['indigo', '靛蓝', '#5856D6'], ['green', '松绿', '#1FA35C'], ['orange', '橘', '#F07A1A'], ['rose', '玫红', '#E5486F'], ['ink', '墨', 'ink']];
const TONES = [['cool', '冷灰', '#E8EAEE', '#0B0C0F'], ['warm', '暖灰', '#EDEAE6', '#0F0D0B'], ['mist', '雾蓝', '#E6EBF1', '#0A0D12'], ['sage', '雾绿', '#E7EBE7', '#0B0E0C'], ['white', '素白', '#F4F5F7', '#121316']];
const store = {
  get(k) { try { const v = localStorage.getItem('lcd:' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('lcd:' + k); else localStorage.setItem('lcd:' + k, JSON.stringify(v)); } catch (e) { /* 存不下就不保存 */ } },
};
function get() { return Object.assign({}, DEF, store.get('look') || {}); }
function isDark(l) { return l.mode === 'dark' || (l.mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); }
function apply(l) {
  l = l || get();
  const r = document.documentElement;
  if (l.mode === 'system') delete r.dataset.mode; else r.dataset.mode = l.mode;
  if (l.tone === 'cool') delete r.dataset.tone; else r.dataset.tone = l.tone;
  const a = ACCENTS.find(x => x[0] === l.accent) || ACCENTS[0];
  r.style.setProperty('--accent', a[2] === 'ink' ? 'var(--ink)' : a[2]);
  r.style.setProperty('--blur', Math.round(l.blur) + 'px');
  r.style.setProperty('--ga', String(l.alpha));
  const t = TONES.find(x => x[0] === l.tone) || TONES[0];
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
  const m = document.createElement('meta'); m.name = 'theme-color'; m.content = isDark(l) ? t[3] : t[2]; document.head.appendChild(m);
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
return { DEF, ACCENTS, TONES, get, set, reset, apply, isDark, avatar, setAvatar, cropAvatar, avatarHtml };
})();
