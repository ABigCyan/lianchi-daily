/* 界面组件：图标、堆叠卡组、圆环、导航栏、触感反馈（遵循 Apple HIG） */
window.Kit = (() => {
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const P = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
/* 线条图标（自绘，风格接近系统图标；SF Symbols 授权不允许用在安卓上） */
const I = {
  today: P('<rect x="3.5" y="4.5" width="17" height="16" rx="4"/><path d="M8 2.8v3.4M16 2.8v3.4M8.3 13.2l2.6 2.6 4.8-5"/>'),
  train: P('<path d="M2.8 9.5v5M5.8 7v10M18.2 7v10M21.2 9.5v5M5.8 12h12.4"/>'),
  food: P('<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.5 1.5-3.5 4-3.5 7.5 0 1.5.8 2.5 2 2.5H17"/>'),
  data: P('<path d="M4.5 20V12M10 20V5M15.5 20v-6M21 20V9"/>'),
  me: P('<circle cx="12" cy="8.3" r="3.9"/><path d="M4.3 20.6c1.3-3.8 4.3-5.6 7.7-5.6s6.4 1.8 7.7 5.6"/>'),
  check: P('<path d="M5 12.5l4.6 4.6L19 7.6"/>'),
  camera: P('<path d="M4 8.2h3.2l1.8-2.7h6l1.8 2.7H20a1 1 0 0 1 1 1v9.3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.2a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.4" r="3.5"/>'),
  photo: P('<rect x="3" y="4.5" width="18" height="15" rx="3.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5.2-5.2L7 19.5"/>'),
  pencil: P('<path d="M4 20h4.2L19.3 8.9a2.1 2.1 0 0 0-3-3L5.2 16.9 4 20z"/>'),
  left: P('<path d="M15 5l-7 7 7 7"/>'),
  right: P('<path d="M9 5l7 7-7 7"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  flame: P('<path d="M12 21c3.9 0 6.5-2.6 6.5-6.3 0-3.7-2.8-6-3.8-9.7-1.8 1.2-2.6 3.3-2.6 5-1-.9-1.6-2.2-1.7-3.6C8 8.1 5.5 11 5.5 14.7 5.5 18.4 8.1 21 12 21z"/>'),
  scale: P('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M8.2 9.6a5 5 0 0 1 7.6 0M12 9.6l1.4 2.1"/>'),
  moon: P('<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2z"/>'),
  run: P('<circle cx="14.5" cy="4.5" r="1.9"/><path d="M5 20.5l3.6-4.8 3 2.1 1.6-5.2 2.7 2.3H19M9 10.5l2.8-2.2 3.7.6"/>'),
  clock: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  later: P('<path d="M9 14l-4-4 4-4"/><path d="M5 10h9.5a4.5 4.5 0 0 1 0 9H11"/>'),
  sparkles: P('<path d="M11 3.5l1.6 4.4L17 9.5l-4.4 1.6L11 15.5l-1.6-4.4L5 9.5l4.4-1.6zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/>'),
  share: P('<path d="M12 15V3.5M8 7.3l4-3.8 4 3.8M5.5 11v8a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-8"/>'),
  download: P('<path d="M12 3.5V15M8 11.2l4 3.8 4-3.8M5.5 16v3a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-3"/>'),
  bell: P('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5zM10 20.5a2 2 0 0 0 4 0"/>'),
  doc: P('<path d="M6.5 3h7.5l4 4v13.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-17a.5.5 0 0 1 .5-.5z"/><path d="M13.5 3v4.5H18M9 12.5h6M9 16h6"/>'),
  info: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>'),
  list: P('<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.1M4.5 12h.1M4.5 17.5h.1"/>'),
  stack: P('<rect x="5" y="8" width="14" height="12" rx="3"/><path d="M7.5 5h9M9.5 2.5h5"/>'),
  person2: P('<circle cx="12" cy="8.3" r="3.9"/><path d="M4.3 20.6c1.3-3.8 4.3-5.6 7.7-5.6s6.4 1.8 7.7 5.6"/>'),
  calendar: P('<rect x="3.5" y="4.5" width="17" height="16" rx="4"/><path d="M8 2.8v3.4M16 2.8v3.4M3.5 10h17"/>'),
  heart: P('<path d="M12 20s-7.5-4.4-7.5-10.1A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.7C19.5 15.6 12 20 12 20z"/>'),
  globe: P('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z"/>'),
  search: P('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5"/>'),
  up: P('<path d="M6 14l6-6 6 6"/>'),
  down: P('<path d="M6 10l6 6 6-6"/>'),
  trash: P('<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13.5h9l1-13.5"/>'),
  image: P('<rect x="3" y="4.5" width="18" height="15" rx="3.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5.2-5.2L7 19.5"/>'),
};
const KIND = { train: ['训练', I.train, 'k-train'], food: ['饮食', I.food, 'k-food'], cardio: ['有氧', I.run, 'k-cardio'], habit: ['习惯', I.clock, 'k-habit'], sleep: ['睡眠', I.moon, 'k-sleep'], scale: ['称重', I.scale, 'k-habit'] };

/* ---------- 触感反馈（HIG：动效之外用触感补充反馈） ---------- */
/* 震动设置：all 全部开 / long 只有长按时 / off 关（我的 → 设置） */
let hapticMode = (() => { try { return JSON.parse(localStorage.getItem('lcd:haptic')) || 'all'; } catch (e) { return 'all'; } })();
function setHaptic(m) { hapticMode = m; try { localStorage.setItem('lcd:haptic', JSON.stringify(m)); } catch (e) { /* 存不下不影响 */ } }
function haptic(kind, fromLongPress) {
  if (hapticMode === 'off' || (hapticMode === 'long' && !fromLongPress)) return;
  try {
    const H = window.capacitorHaptics && window.capacitorHaptics.Haptics;
    if (H && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      if (kind === 'success') H.notification({ type: 'SUCCESS' }); else H.impact({ style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
    } else if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(kind === 'success' ? [10, 40, 10] : 8);
  } catch (e) { /* 没有触感也不影响使用 */ }
}

/* ---------- 大标题 + 滚动后显示的玻璃导航栏 ---------- */
function largeTitle(title, subtitle, trailing) {
  setNav(title);
  return `<header class="largetitle"><div><h1>${title}</h1>${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}</div>${trailing || ''}</header>`;
}
function setNav(title) { const n = $('#navbar'); if (n) n.querySelector('.glass').textContent = title; navShown = null; onScroll(); }
let navShown = null;
function onScroll() { const n = $('#navbar'), v = scrollY > 56; if (n && v !== navShown) { navShown = v; n.classList.toggle('show', v); } }
addEventListener('scroll', onScroll, { passive: true });

/* ---------- 活动圆环 ---------- */
function rings(list) { // list: [{v, max, color}]
  const R0 = 52, W = 13;
  let g = '';
  list.forEach((r, i) => {
    const R = R0 - i * (W + 3), C = 2 * Math.PI * R, pct = r.max ? Math.min(r.v / r.max, 1.5) : 0;
    const shown = Math.min(pct, 1), off = C * (1 - shown);
    g += `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${r.color}" stroke-opacity=".2" stroke-width="${W}"/>`;
    g += `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${r.color}" stroke-width="${W}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .6s"/>`;
  });
  return `<svg viewBox="0 0 120 120" role="img" aria-label="${list.map(r => r.label + ' ' + Math.round(r.v) + '/' + r.max).join('，')}">${g}</svg>`;
}

/* ---------- 堆叠卡组 ---------- */
/* items: [{key, cls, html}]；右滑 = onRight（完成），左滑 = onLeft（稍后/下一张） */
/* 三张卡叠在同一个网格格子里，每张按自己的内容撑出尺寸：后面露出的卡就是下一张的真实大小，翻页不跳 */
const promoted = {};
function deck(id, items, emptyHtml, labels) {
  labels = labels || { r: '完成', l: '稍后' };
  if (!items.length) { delete promoted[id]; return `<div class="deck-empty mat">${emptyHtml || '没有了'}</div>`; }
  const top = items[0], anim = promoted[id]; delete promoted[id];
  let h = `<div class="deck" id="${id}">`;
  h += `<div class="dc top mat ${top.cls || ''} ${anim ? 'promote' : ''}" data-key="${top.key}"><span class="swipe-tag r">${labels.r}</span><span class="swipe-tag l">${labels.l}</span>${top.html}</div>`;
  items.slice(1, 3).forEach((it, i) => h += `<div class="dc behind b${i + 1} mat ${it.cls || ''} ${anim ? 'promote' : ''}" aria-hidden="true" inert>${it.html}</div>`);
  return h + '</div>';
}
function bindDeck(id, onRight, onLeft) {
  const root = document.getElementById(id); if (!root) return;
  const card = root.querySelector('.dc.top'); if (!card) return;
  const key = card.dataset.key, tr = card.querySelector('.swipe-tag.r'), tl = card.querySelector('.swipe-tag.l');
  let x0 = 0, y0 = 0, dx = 0, drag = false, decided = false, pid = null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const set = v => { card.style.transform = `translateX(${v}px) rotate(${v / 22}deg)`; if (tr) tr.style.opacity = Math.max(0, Math.min(1, v / 90)); if (tl && onLeft) tl.style.opacity = Math.max(0, Math.min(1, -v / 90)); };
  card.addEventListener('pointerdown', e => {
    if (e.target.closest('input,button,select,textarea,a,label')) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; drag = true; decided = false; pid = e.pointerId;
  });
  card.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== pid) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!decided) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; decided = true; if (Math.abs(my) > Math.abs(mx)) { drag = false; return; } card.setPointerCapture(pid); card.classList.add('dragging'); }
    dx = mx; set(dx);
  });
  const end = () => {
    if (!drag) return; drag = false; card.classList.remove('dragging');
    if (dx > 100) fly(1); else if (dx < -100 && onLeft) fly(-1); else { set(0); card.style.transform = ''; }
  };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  function fly(dir) {
    haptic(dir > 0 ? 'success' : 'light');
    if (reduce) { (dir > 0 ? onRight : onLeft)(key); return; }
    card.style.transform = `translateX(${dir * innerWidth * 1.2}px) rotate(${dir * 24}deg)`; card.style.opacity = '0';
    setTimeout(() => { promoted[id] = true; (dir > 0 ? onRight : onLeft)(key); }, 260);
  }
  root.flyRight = () => fly(1); root.flyLeft = () => onLeft && fly(-1);
}

/* ---------- 其他 ---------- */
function chk(on) { return `<span class="chk ${on ? 'on' : ''}">${I.check}</span>`; }
function row({ icon, kind, title, sub, val, chev, attrs, cls }) {
  const k = kind ? KIND[kind] : null;
  return `<button class="row ${cls || ''}" ${attrs || ''}>${icon || k ? `<span class="row-ico ${k ? k[2] : ''}" ${!k && icon ? 'style="background:var(--label3)"' : ''}>${icon || k[1]}</span>` : '<span></span>'}<span class="row-main"><span class="row-title">${title}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span><span class="row-val ${chev ? 'chev' : ''}">${val || ''}</span></button>`;
}
/* ---------- 长按：500ms 不动算长按，带震动；滑动或抬起就取消 ---------- */
function longPress(el, cb) {
  let t = null, x = 0, y = 0, fired = false;
  const stop = () => { clearTimeout(t); t = null; };
  el.addEventListener('pointerdown', e => { fired = false; x = e.clientX; y = e.clientY; stop(); t = setTimeout(() => { fired = true; haptic('medium', true); cb(e); }, 500); });
  el.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - x, e.clientY - y) > 8) stop(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => el.addEventListener(n, stop));
  el.addEventListener('contextmenu', e => e.preventDefault());
  // 长按触发后，松手时的那次点击不再当作普通点击
  el.addEventListener('click', e => { if (fired) { e.preventDefault(); e.stopImmediatePropagation(); fired = false; } }, true);
}

/* ---------- 选时间：iOS 式上下滑动的滚轮（替换系统的时钟弹窗） ---------- */
const IH = 40, pad2 = n => String(n).padStart(2, '0');
function timeWheel(value, title, cb) {
  const [h0, m0] = String(value || '08:00').split(':').map(n => +n || 0);
  const layer = document.createElement('div');
  layer.className = 'tw-layer';
  const col = (n, name) => `<div class="tw-col" data-col="${name}" role="listbox" aria-label="${name === 'h' ? '小时' : '分钟'}"><div class="tw-pad"></div>${[...Array(n)].map((_, i) => `<div class="tw-item" data-i="${i}">${pad2(i)}</div>`).join('')}<div class="tw-pad"></div></div>`;
  layer.innerHTML = `<div class="tw-sheet" role="dialog" aria-modal="true"><div class="tw-head"><button class="tw-btn" data-tw="x">取消</button><b>${title || '选择时间'}</b><button class="tw-btn ok" data-tw="ok">完成</button></div>
    <div class="tw-body"><div class="tw-band" aria-hidden="true"></div>${col(24, 'h')}<span class="tw-colon">:</span>${col(60, 'm')}</div></div>`;
  document.body.appendChild(layer);
  const cols = [...layer.querySelectorAll('.tw-col')];
  const idx = c => Math.max(0, Math.min(c.children.length - 3, Math.round(c.scrollTop / IH)));
  const mark = c => { const i = idx(c); c.querySelectorAll('.tw-item').forEach(el => el.classList.toggle('on', +el.dataset.i === i)); return i; };
  cols[0].scrollTop = h0 * IH; cols[1].scrollTop = m0 * IH;
  cols.forEach(c => {
    let last = mark(c), raf = 0;
    c.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const i = mark(c); if (i !== last) { last = i; haptic('light'); } }); }, { passive: true });
    c.addEventListener('click', e => { const it = e.target.closest('.tw-item'); if (it) c.scrollTo({ top: +it.dataset.i * IH, behavior: 'smooth' }); });
  });
  const close = ok => {
    if (ok) cb(pad2(idx(cols[0])) + ':' + pad2(idx(cols[1])));
    layer.classList.add('out'); setTimeout(() => layer.remove(), 180);
  };
  layer.addEventListener('click', e => { if (e.target === layer) close(false); });
  layer.querySelector('[data-tw="x"]').onclick = () => close(false);
  layer.querySelector('[data-tw="ok"]').onclick = () => close(true);
  window.__closeWheel = () => { if (document.body.contains(layer)) { close(false); return true; } return false; };
}
/* 页面里所有 <input type="time"> 自动换成只读文本框，点一下弹出滚轮；改完照常触发 input / change 事件 */
function upgradeTimeInputs() {
  document.querySelectorAll('input[type="time"]').forEach(i => { i.type = 'text'; i.readOnly = true; i.size = 5; i.classList.add('tw-input'); i.setAttribute('inputmode', 'none'); });
}
new MutationObserver(upgradeTimeInputs).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('click', e => {
  const i = e.target.closest && e.target.closest('input.tw-input');
  if (!i || i.disabled) return;
  e.preventDefault(); i.blur();
  const lab = i.id && document.querySelector(`label[for="${i.id}"]`);
  timeWheel(i.value, lab ? lab.textContent : (i.getAttribute('aria-label') || '选择时间'), v => {
    i.value = v;
    i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true }));
  });
});

/* ---------- 横向滚动条两端的内容渐隐（只在那一侧还有内容时） ---------- */
function fadeEdges(el) {
  if (!el) return;
  const upd = () => { el.classList.toggle('fade-l', el.scrollLeft > 2); el.classList.toggle('fade-r', el.scrollLeft + el.clientWidth < el.scrollWidth - 2); };
  el.addEventListener('scroll', upd, { passive: true }); upd();
  const on = el.querySelector('[aria-pressed="true"]');
  if (on && (on.offsetLeft + on.offsetWidth > el.clientWidth)) { el.scrollLeft = on.offsetLeft - 24; upd(); }
}

return { I, KIND, haptic, setHaptic, hapticMode: () => hapticMode, longPress, timeWheel, fadeEdges, largeTitle, setNav, rings, deck, bindDeck, chk, row, $, $$ };
})();
