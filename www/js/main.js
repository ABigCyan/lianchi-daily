/* 入口：页面切换与启动 */
(() => {
const { $, $$, S, LS, E, today } = C;
const PAGES = { today: window.Today, train: window.Train, food: window.Food, data: window.Data, me: window.Me };
const TABS = [['today', '今天', Kit.I.today], ['train', '训练', Kit.I.train], ['food', '饮食', Kit.I.food], ['data', '数据', Kit.I.data], ['me', '我的', Kit.I.me]];
$$('#tabs button').forEach((b, i) => { b.innerHTML = TABS[i][2] + TABS[i][1]; b.setAttribute('aria-label', TABS[i][1]); });
function render() {
  const app = $('#app');
  document.body.dataset.tab = S.profile ? S.tab : 'me';
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
(function boot() {
  const p = LS.get('profile');
  if (p) { S.profile = Object.assign({}, Me.DEF, p, { parts: Object.assign({}, Me.DEF.parts, p.parts || {}) }); S.plan = E.build(S.profile); }
  render();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.profile) { if (S.tab === 'today' && !S.edit && !S.sub) { S.day = today(); render(); } Me.scheduleNotifs(); } });
  if (S.profile) Me.scheduleNotifs();
})();
})();
