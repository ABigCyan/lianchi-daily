/* 入口：页面切换与启动 */
(() => {
const { $, $$, S, LS, E, today } = C;
const PAGES = { today: window.Today, train: window.Train, food: window.Food, data: window.Data, me: window.Me };
function render() {
  const app = $('#app');
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
  if (t === S.tab && t === 'me') S.sub = null;
  S.tab = t; S.edit = false; if (['today', 'train', 'food'].includes(t) && S.tab !== 'me') S.day = today();
  render(); scrollTo(0, 0);
});
(function boot() {
  const p = LS.get('profile');
  if (p) { S.profile = Object.assign({}, Me.DEF, p, { parts: Object.assign({}, Me.DEF.parts, p.parts || {}) }); S.plan = E.build(S.profile); }
  render();
  setInterval(() => { if (S.tab === 'today') Today.updateNow(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.profile) { if (S.tab === 'today' && !S.edit) { S.day = today(); render(); } Me.scheduleNotifs(); } });
  if (S.profile) Me.scheduleNotifs();
})();
})();
