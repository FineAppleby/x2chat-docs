# X2Chat Bot API

Telegram-compatible HTTP API for bots in X2Chat. If you have written a Telegram bot, you already know
this API — most client libraries (`python-telegram-bot`, `node-telegram-bot-api`, `telegraf`) work after
changing the base URL.

Full interactive reference, with examples in several languages: **https://x2chat.com/bots/** (RU/EN).

> **One honest note up front.** Messages sent by a bot are not end-to-end encrypted: a bot is a server
> and holds no device key. Conversations between people stay end-to-end encrypted as always. Tell your
> users what your bot stores.

---

## Create a bot

In the X2Chat app: **Settings → My bots → Create**. You get a `@username` and a token. The token is shown
once — store it somewhere safe. If you lose it, reissue it in the same screen; the old one stops working
immediately.

## Authentication

Two equivalent ways:

```bash
# token in the path
curl https://x2chat.com/api/v1/bot/<TOKEN>/getMe

# token in a header
curl -H "X-Bot-Token: <TOKEN>" https://x2chat.com/api/v1/bot/getMe
```

Responses follow the Telegram shape: `{"ok": true, "result": …}` or
`{"ok": false, "error_code": 400, "description": "…"}`. Some methods add a `warnings` array when the
server had to trim or drop a field it could not accept.

## Methods

| Method | What it does |
|---|---|
| `getMe` | Bot profile, plus `ui_schema_version` and the list of supported UI features |
| `sendMessage` | Send text. Accepts `parse_mode` (HTML, MarkdownV2, Markdown), `reply_markup` |
| `sendPhoto` | Send an image: a `file_id`, an `https://` URL (≤10 MB), a data URI, or `{base64, mime}` |
| `sendChatAction` | Show "typing…", "sending a photo…" — clears after ~3 s, repeat while you work |
| `editMessageText` | Edit your own message; may also change the keyboard, persona and bubble |
| `editMessageReplyMarkup` | Replace or remove the keyboard of your own message |
| `deleteMessage` · `forwardMessage` | Delete / forward |
| `getUpdates` | Long polling (see below) |
| `setWebhook` · `getWebhookInfo` · `deleteWebhook` | Webhook delivery instead of polling |
| `setMyCommands` · `getMyCommands` · `deleteMyCommands` | The command list, per language |
| `answerCallbackQuery` | Answer a button press: text, alert, URL, or an effect |
| `setMyDescription` · `setMyShortDescription` | Texts shown in the bot's profile and in link previews |
| `setMyPhoto` · `getMyPhoto` · `deleteMyPhoto` | The bot's avatar (png/jpeg/webp, ≤2 MB, once per minute) |
| `setMyStartButton` · `getMyStartButton` | The big "Start" button shown before the first message |
| `setMyMenu` · `getMyMenu` · `deleteMyMenu` | A persistent menu next to the input field, and quick buttons |
| `setMyTheme` · `getMyTheme` · `deleteMyTheme` | Colours of your bot's chat |

Every bot has an avatar from the moment it is created: until you upload one, X2Chat serves a generated
image, stable per username.

## Receiving updates

**Long polling.** `GET /getUpdates?offset=<last_update_id>&timeout=25` — the server holds the request
until something arrives, up to 25 seconds. Your HTTP client should wait longer than `timeout` (say,
`timeout + 10 s`).

`offset` acknowledges: everything with `update_id ≤ offset` is deleted and will never be returned again,
even if you later start from zero. A negative `offset = -N` returns the last N updates and forgets the
rest. Both `offset = last_update_id` and the Telegram style `offset = last_update_id + 1` work.

**Webhooks.** `setWebhook` with an `https://` URL; add a secret and X2Chat will send it back in a header,
so you can verify the caller. `getWebhookInfo` reports the last error and the number of consecutive
failures.

Updates carry `from.language_code` — the user's interface language (`ru, en, es, de, fr, zh, ar`) when it
is known. Use it to answer in their language.

## Keyboards

Standard Telegram inline keyboards work unchanged: `text` with `callback_data`, `url`,
`switch_inline_query`, `web_app`, `login_url`, `pay`.

X2Chat adds four button behaviours:

```jsonc
{ "inline_keyboard": [[
  { "text": "Go to the lighthouse", "send_text": true },          // sends the text as the USER's own message
  { "text": "📋 Copy the code", "copy_text": { "text": "123456" } }, // copies to the clipboard, nothing reaches the bot
  { "text": "📰 News", "callback_data": "news",
    "text_i18n": { "ru": "📰 Новости", "de": "📰 Neuigkeiten" } }  // label in the user's language
]]}
```

`send_text` is what makes quest and survey bots feel like a real conversation: the tap becomes an ordinary
message from the user, and your bot receives it as text. `text_i18n` accepts only the seven supported
languages; anything else is dropped with a warning.

## Styling (UI v2)

Beyond Telegram, a bot can style its own chat. The full contract is in
[`ui-schema.v1.json`](./ui-schema.v1.json); the short version:

- **Buttons** — `style` (primary, secondary, success, danger, ghost, link), `color`, `text_color`,
  `border_color`, `shape` (rounded, pill, square), `size`, `icon` (emoji, a built-in symbol name, or an
  https image), `width`, `disabled`, `selected`, `badge`.
- **Keyboard layout** — `layout {columns 1…8, gap, align}`, `one_time` (the keyboard locks after the first
  press), `selected_callback` (the pressed button stays marked).
- **Persona** — `as {name, avatar_url | avatar_emoji, color}` lets one bot speak as several characters. The
  server always marks the message as coming from a bot and adds your bot's name: a persona cannot
  impersonate a person, and reserved names (X2Chat, System, Support, Admin, Moderator…) are rejected.
- **Bubble and theme** — per-message `bubble {color, text_color, accent}` and a chat-wide
  `theme {accent, background, bubble, button_defaults}`.
- **Effects** — `answerCallbackQuery` accepts `effect`: `haptic`, `sound`, `confetti`, `shake`.

**Contrast is corrected automatically.** Every colour you send is checked against both a light and a dark
bubble: text must reach 4.5:1, borders and fills 1.5:1. If it does not, the server nudges your colour until
it does, or drops the field and tells you in `warnings`. You cannot accidentally ship an unreadable button.

Unknown fields are ignored rather than rejected, so new features never break old bots. Hard violations
(more than 100 buttons, more than 8 in a row, `callback_data` over 64 bytes, a button without text) return
400.

## Menus instead of typed commands

Users should not have to type `/start`.

- **Start button** — `setMyStartButton {text, payload}`. Until the user has written anything, the input
  field is replaced by one big button; the tap sends `/start <payload>` as a normal message.
- **Command menu** — the client shows your `setMyCommands` list next to the input, translated per user.
- **Bot menu** — `setMyMenu` gives a richer structure: a menu button, items in a list or a grid, submenus
  up to three levels, and up to six quick buttons above the input. An item can run a command, send text,
  fire a callback without posting anything, open a URL or a web app, or trigger the system share sheet.
  Menus can differ per chat and per language.

## Rate limits

Per bot, not per IP:

| Bucket | Methods | Limit |
|---|---|---|
| Updates | `getUpdates` | 600 / minute |
| Sending (burst) | everything else | 30 / second |
| Sending (sustained) | everything else | 1200 / minute |
| Failed auth | per IP | 300 / 15 minutes |

Over the limit you get HTTP 429 with `Retry-After` and a Telegram-shaped body:

```json
{"ok": false, "error_code": 429, "description": "Too Many Requests: retry after 5",
 "parameters": {"retry_after": 5}}
```

Some methods have their own cooldown: the theme and the avatar can each change once per minute.

## Connecting a bot by QR

Three flows, all documented with live examples at **https://x2chat.com/bots/**:

| Flow | Who shows the QR | Who scans | The site receives |
|---|---|---|---|
| Pair-Connect | your site | the X2Chat app | bot token + chat id — onboarding in one scan |
| Integration QR | the X2Chat app | your site | bot token + chat id — for CLI and scripts |
| Webhook QR | your site | the X2Chat app | a webhook secret, verified by a ping |

## Links

- Interactive reference with examples — https://x2chat.com/bots/
- Mini apps (apps that run inside the chat) — [`../mini-apps/`](../mini-apps/)
- Questions and anything that needs an operator key — bots@x2chat.com
