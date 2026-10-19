# X2Chat Mini-App — Starter Template

Готовый рабочий шаблон мини-приложения X2Chat. Скопируйте, захостите, зарегистрируйте,
кастомизируйте. Полное руководство: [`../../README.md`](../../README.md) · https://x2chat.com/miniapps/dev/

## Файлы
| Файл | Что |
|---|---|
| `index.html` | разметка + подключение `styles.css`/`app.js` |
| `app.js` | вся интеграция с X2Chat (без зависимостей, голый мост) — **читайте его, это и есть пример** |
| `styles.css` | минимальные стили, тема из `context.env.theme`, mobile-first, safe-area |
| `manifest.json` | манифест для регистрации (замените `YOUR-DOMAIN`, `slug`, `scopes`) |
| `icon.svg` | иконка (для прод-каталога положите рядом `icon.png` — см. гайд §12) |

## Что демонстрирует `app.js`
- Ожидание `x2chat:ready` (и случай, когда событие пришло до загрузки скрипта).
- Чтение контекста (v2 вложенный `context.user/chat/env` с фолбэком на v1 плоский).
- Capabilities: `profile:read`, `contacts:pick`, `message:send`, `share:external`.
- События хоста: `x2chat:refresh` (+ `_refreshHandled` ack), `x2chat:back`, `x2chat:exitRequest`, `x2chat:session`.
- Сообщение nav-state хосту (`_navState`), закрытие (`close`).
- **Graceful-деградация**: нет права (`403`), мост не готов, отмена, `{error:'offline'}` — без падений.

## Как запустить
1. **Локально** (только UI-оболочка, без хоста — мост покажет «ещё не готов»):
   `python3 -m http.server 8000` в этой папке → `http://localhost:8000`.
2. **На устройстве** (полный поток): захостите папку по HTTPS, пропишите `launch_url`+`icon` в
   `manifest.json`, зарегистрируйте (гайд §10), установите в X2Chat. Capabilities заработают
   внутри X2Chat-WebView.

## Кастомизация
- Меняйте `scopes` в `manifest.json` под нужные права (least-privilege — берите минимум).
- Хотите свой бэкенд-push получателю? См. `host/notify` (гайд §7) — нужен app-key у оператора.
- Хотите типизированные методы вместо голого моста? запросите SDK `x2-mini-app.js` у оператора платформы.

## Dual-DC
Реестр не реплицируется — зарегистрируйте на **каждом** ДЦ (`ix.x2chat.com`, `ru.x2chat.com`).
`slug` одинаков; Host API выбирается по origin. Подробнее — гайд §11.1.
