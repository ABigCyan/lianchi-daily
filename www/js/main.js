/* 入口：页面切换与启动 */
(() => {
const { $, $$, S, LS, E, today } = C;
const PAGES = { today: window.Today, train: window.Train, food: window.Food, data: window.Data, me: window.Me };
const TABS = [['today', '今天', Kit.I.today], ['train', '训练', Kit.I.train], ['food', '饮食', Kit.I.food], ['data', '数据', Kit.I.data], ['me', '我的', Kit.I.me]];
$$('#tabs button').forEach((b, i) => { b.innerHTML = TABS[i][2] + TABS[i][1]; b.setAttribute('aria-label', TABS[i][1]); });
function render() {
  const app = $('#app');
  document.body.dataset.tab = S.profile ? S.tab : 'me';
  if (S.chatOn && S.profile) { app.innerHTML = Assistant.view(); $('#tabs').hidden = true; Assistant.bind(); return; }
  if (S.guideOn) { app.innerHTML = Guide.view(); $('#tabs').hidden = true; Guide.bind(); return; }
  if (!S.profile) { app.innerHTML = Me.viewFirst(); $('#tabs').hidden = true; Me.bindFirst(); return; }
  $('#tabs').hidden = false;
  $$('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false'));
  if (S.tab !== 'train') Train.stop();
  const pg = PAGES[S.tab] || Today;
  app.innerHTML = pg.view(); pg.bind();
}
window.__render = render;
$$('#tabs button').forEach(b => b.onclick = () => {
  const t = b.dataset.tab;
  if (t === S.tab) { if (t === 'me') S.sub = null; scrollTo({ top: 0, behavior: 'smooth' }); if (t !== 'me') return; }
  Kit.haptic('light');
  S.tab = t; S.edit = false; if (['today', 'train', 'food'].includes(t)) S.day = today();
  render(); scrollTo(0, 0);
});
/* ---------- 安卓返回键：先关弹窗、退出子页面，回到“今天”后连按两次才回桌面 ---------- */
function goBack() {
  if (window.__closeWheel && window.__closeWheel()) return true;
  const m = $('#modal');
  if (m && !m.hidden) { C.close(); return true; }
  if (S.chatOn) { S.chatOn = false; if (window.visualViewport) visualViewport.onresize = null; render(); scrollTo(0, 0); return true; }
  if (S.guideOn) return Guide.back();
  if (S.sub) { S.sub = S.sub === 'localai' && S.subBack ? S.subBack : null; S.subBack = null; S.firstImport = false; render(); scrollTo(0, 0); return true; }
  if (S.edit) { S.edit = false; render(); return true; }
  if (!S.profile) return false;
  if (S.tab !== 'today') { S.tab = 'today'; S.day = today(); render(); scrollTo(0, 0); return true; }
  if (S.day !== today()) { S.day = today(); render(); scrollTo(0, 0); return true; }
  return false;
}
let lastBack = 0;
const AppPlugin = window.capacitorApp && window.capacitorApp.App;
if (AppPlugin && window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
  AppPlugin.addListener('backButton', () => {
    if (goBack()) { Kit.haptic('light'); lastBack = 0; return; }
    const now = Date.now();
    if (now - lastBack < 2000) { lastBack = 0; AppPlugin.minimizeApp(); return; }
    lastBack = now; C.toast('再按一次返回桌面');
  });
}
window.__goBack = goBack;
(function boot() {
  const p = LS.get('profile');
  if (p) { S.profile = Object.assign({}, Me.DEF, p, { parts: Object.assign({}, Me.DEF.parts, p.parts || {}) }); S.plan = E.build(S.profile); }
  if (!p || LS.get('guideNext')) Guide.start();
  render();
  if (S.profile) Updater.autoCheck();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.profile) { if (S.tab === 'today' && !S.edit && !S.sub && !S.guideOn) { S.day = today(); render(); } Me.scheduleNotifs(); } });
  if (S.profile) Me.scheduleNotifs();
})();
})();
