// X2Chat Mini-App — starter / стартовый шаблон.
// Демонстрирует: x2chat:ready, чтение контекста, capabilities (profile/contacts/
// message/share), события хоста (refresh/back/exit/session), nav-state, graceful-
// деградацию (в т.ч. offline). Без зависимостей — голый мост window.x2 / X2ChatHost.
// Можно заменить на SDK x2-mini-app.js (createX2MiniAppClient) — запросите у оператора платформы.

'use strict';

// ---- тонкая обёртка над мостом (тот же контракт, что у SDK) -------------------
const X2 = {
  get launch() { return (window.X2Chat && window.X2Chat.launch) || null; },
  // requestCapability → Promise<{success, scope, data}>. Бросает на ошибке/без права.
  request(scope, payload = {}) {
    if (!window.x2 || typeof window.x2.requestCapability !== 'function') {
      return Promise.reject(new Error('bridge_unavailable'));
    }
    return window.x2.requestCapability(scope, payload);
  },
  // послать команду хосту (close / nav-state / refresh-ack)
  post(method, extra = {}) {
    if (window.X2ChatHost && typeof window.X2ChatHost.postMessage === 'function') {
      window.X2ChatHost.postMessage(JSON.stringify({ method, ...extra }));
    }
  },
};

// ---- маленькие хелперы UI -----------------------------------------------------
const $ = (id) => document.getElementById(id);
const log = (msg) => {
  const el = $('log');
  const line = document.createElement('div');
  line.className = 'log-line';
  line.textContent = '› ' + msg;
  el.prepend(line);
};
const setOut = (id, obj) => { $(id).textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2); };

// Унифицированная обработка ответа capability: success / нет права / offline / отмена.
async function callCap(scope, payload, outId) {
  try {
    const res = await X2.request(scope, payload);
    // некоторые client-side capability возвращают {success:false,error} вместо throw
    const data = res && res.data !== undefined ? res.data : res;
    if (data && data.error === 'offline') { setOut(outId, '📴 офлайн — попробуйте позже'); log(scope + ' → offline'); return null; }
    if (data && (data.cancelled || data.error === 'user_cancel')) { setOut(outId, '✋ отменено'); return null; }
    setOut(outId, data);
    log(scope + ' → ok');
    return data;
  } catch (e) {
    const m = String(e && e.message || e);
    if (m.includes('403') || m.toLowerCase().includes('право')) setOut(outId, '🔒 нет права (' + scope + ') — добавьте scope в манифест');
    else if (m.includes('bridge_unavailable')) setOut(outId, '⏳ мост ещё не готов — дождитесь x2chat:ready');
    else setOut(outId, '⚠️ ' + m);
    log(scope + ' → error: ' + m);
    return null;
  }
}

// ---- рендер контекста запуска -------------------------------------------------
function renderContext() {
  const ctx = (X2.launch && X2.launch.context) || {};
  // v2 (вложенный) с фолбэком на v1 (плоский)
  const user = ctx.user || { id: ctx.user_id, slotId: ctx.slot_id, displayName: ctx.display_name };
  const chat = ctx.chat || (ctx.chat_id != null ? { id: ctx.chat_id } : null);
  $('whoami').textContent = (user.displayName || user.username || 'Пользователь') +
    (user.slotId ? ' · ' + user.slotId : '');
  $('chatinfo').textContent = chat ? ('Чат #' + (chat.id) + (chat.type ? ' (' + chat.type + ')' : ''))
                                   : 'Запуск из лаунчера (без чата)';
  setOut('ctx', ctx);
  // тема/локаль из env
  const env = ctx.env || { theme: ctx.theme, locale: ctx.locale };
  if (env && env.theme) document.body.setAttribute('data-theme', env.theme);
}

// ---- привязка кнопок (общая для хоста и standalone) --------------------------
let bound = false;
function bindButtons() {
  if (bound) return; bound = true;
  $('btn-profile').onclick   = () => callCap('profile:read', {}, 'out');
  $('btn-contacts').onclick  = () => callCap('contacts:pick', {}, 'out');
  $('btn-message').onclick   = () => {
    const text = $('msg').value.trim();
    if (!text) { setOut('out', 'введите текст'); return; }
    callCap('message:send', { text }, 'out');
  };
  $('btn-share').onclick     = () => callCap('share:external', { text: 'Из мини-аппа X2Chat', url: location.href }, 'out');
  $('btn-close').onclick     = () => X2.post('close');
}

// ---- инициализация при готовности хоста --------------------------------------
let started = false;
function init() {
  if (started) return; started = true;
  renderContext();
  bindButtons();
  log('x2chat:ready — контекст получен');
  X2.post('_navState', { canGoBack: false, confirmExit: false }); // «назад» по экранам аппа
}

// x2chat:ready может прийти ДО или ПОСЛЕ загрузки скрипта — обрабатываем оба случая.
if (X2.launch) init();
window.addEventListener('x2chat:ready', init);

// Standalone (вне X2Chat / локальный просмотр): показать оболочку + подсказку.
setTimeout(() => {
  if (started) return;
  renderContext();                       // дефолты из пустого контекста
  bindButtons();
  $('whoami').textContent = 'Откройте внутри X2Chat';
  $('chatinfo').textContent = 'Standalone — мост недоступен (это нормально вне приложения)';
  log('standalone: хост не обнаружен');
}, 400);

// ---- события хоста ------------------------------------------------------------
window.addEventListener('x2chat:refresh', () => {
  log('x2chat:refresh — обновляю');
  renderContext();
  X2.post('_refreshHandled');           // подтверждаем — иначе хост сделает полный reload через 2с
});
window.addEventListener('x2chat:back', () => {
  log('x2chat:back');
  // здесь: уйти на предыдущий экран вашего аппа и переслать _navState
});
window.addEventListener('x2chat:exitRequest', () => {
  log('x2chat:exitRequest');
  if (confirm('Выйти из приложения?')) X2.post('close');
});
window.addEventListener('x2chat:session', (e) => {
  log('x2chat:session → ' + JSON.stringify(e.detail || {}));
  renderContext();                      // токен переиздан — перечитать свежий контекст
});
