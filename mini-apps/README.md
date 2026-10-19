# X2Chat Mini-Apps — Developer Guide

> Complete, practical, end-to-end guide: how to build, register, and integrate a mini-app
> into the X2Chat messenger. Self-contained. Deep contract details live in
> [`capability-manifest.v2.json`](./capability-manifest.v2.json) — the machine-readable contract.
> Russian version: https://x2chat.com/miniapps/dev/
>
> API status: **v1 — stable, works everywhere.** **v2** (dotted names like `profile.read`) is
> rolling out backward-compatibly — the old names (`profile:read`) keep working and are **not**
> being removed. **Offline launch** is in development (preview section at the end).

---

## 0. TL;DR — a minimal mini-app in 5 minutes

A mini-app is an ordinary web app (HTML/JS/CSS) that opens inside X2Chat's embedded WebView and
talks to the host over a JS bridge. No stack change required (React/Vue/vanilla — anything).

```html
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>
<h1 id="hello">Loading…</h1>
<script>
  // 1) Wait for the host to be ready
  window.addEventListener('x2chat:ready', async () => {
    // 2) Launch context (who, which chat) — read synchronously from window.X2Chat.launch
    const ctx = window.X2Chat.launch.context;
    // 3) Request data over the bridge (requires a granted scope)
    try {
      const me = await window.x2.requestCapability('profile:read', {});
      document.getElementById('hello').textContent =
        'Hi, ' + (me.data.profile.display_name || 'friend') + '!';
    } catch (e) {
      document.getElementById('hello').textContent = 'No profile access';
    }
  });
</script>
</body></html>
```

Then: host it → register (by manifest) → user installs → the app opens with a session.

---

## 1. How it works (trust model)

| Layer | What |
|---|---|
| **Host** | The X2Chat client (Flutter, iOS/Android). Opens the mini-app in a WebView, injects the bridge and context, mediates every privileged action. |
| **Mini-app** | Your web app at `launch_url` (HTTPS). Sandboxed: navigation is restricted to `allowed_origins`. |
| **Host API** | REST behind the session header `X-X2Chat-Mini-App-Session`. Resolves profile, contacts, accepts drafts, etc. |
| **Launch session** | A short-lived JWT (TTL 30 min) bound to (user, app, optional chat) + granted scopes. Auto-reissued. |
| **Scopes** | Least-privilege: the app declares the scopes it needs, the user consents at install. Missing scope → `403`. |

Apple-style principle (v2): **context (data) is separate from actions (capabilities)**. No action
"guesses" the context — everything is passed explicitly.

---

## 2. Launch context

After the page loads, the host injects `window.X2Chat.launch`:

```jsonc
// window.X2Chat.launch
{
  "sessionToken": "<JWT>",        // for the X-X2Chat-Mini-App-Session header
  "expires_at": "2026-06-20T12:30:00Z",
  "context": {
    // === v2 (nested, the target shape) ===
    "apiVersion": 2,
    "app":  { "id": "...", "slug": "wallet" },
    "user": { "id": 123, "slotId": "A7X29B", "displayName": "...", "username": "...", "avatarUrl": "..." },
    "chat": { "id": 456, "type": "direct", "title": "..." },   // OPTIONAL: key is ABSENT when launched from the launcher
    "deeplink": { "screen": "send", "params": { "to": "..." } }, // OPTIONAL: see §8
    "env":  { "theme": "blue", "locale": "en", "platform": "ios" },

    // === v1 (flat, compatibility — emitted in parallel) ===
    "app_id": "...", "slug": "wallet", "user_id": 123, "slot_id": "A7X29B",
    "chat_id": 456, "scopes": ["profile:read", "message:send"], "theme": "blue", "locale": "en"
  }
}
```

**Important:** `chat`/`chat_id` is present **only** if the app was opened from a conversation. From
the apps menu (launcher) there is no chat — do not rely on it. The context is **immutable** (read-only).

If the context is ever lost (rare): `window.X2ChatHost.postMessage(JSON.stringify({method:'getContext'}))` re-injects it.

---

## 3. JS bridge and SDK

Low level — two globals:
- `window.x2.requestCapability(scope, payload)` → `Promise` (under the hood: bridge with a `requestId`).
- `window.X2ChatHost.postMessage(jsonString)` → send a command to the host.

Recommended: the SDK wrapper `x2-mini-app.js` (ask the platform operator): `createX2MiniAppClient()`
with `requestCapability`, typed methods, and a fallback. Bundle it or import as an ES module.

**Response contract** is identical for bridge and SDK fetch-fallback: if the bridge is unavailable,
the SDK does `fetch('<origin>/api/v1/mini-apps/host/capabilities/request', {...})`. Same response shape.

---

## 4. Capabilities

Call: `await window.x2.requestCapability('<name>', <payload>)`. Both v1 names (`profile:read`) and
v2 names (`profile.read`) are accepted — they are equivalent. Response: `{ success, scope, data }`.

| Action | v1 name | v2 name | Scope | payload | data |
|---|---|---|---|---|---|
| User profile | `profile:read` | `profile.read` | `identity.profile.read` | `{}` | `{ profile:{id,slot_id,display_name,username,avatar_url,language,theme} }` |
| Current chat | `chat:context` | `chat.current` | `context.chat.read` | `{}` | `{ chat:{chat_id,title,type} \| {chat_id:null} }` |
| Pick a contact (picker) | `contacts:pick` | `contacts.pick` | `identity.contacts.pick` | `{}` | `{ user_id, slot_id, display_name, group }` |
| Resolve a contact by id | — | `contacts.resolve` | `identity.contacts.resolve` | `{by:{userId\|slotId\|chatId}}` | `{ user_id, slot_id, display_name, group } \| {error}` |
| Message draft | `message:send` | `message.compose` | `messaging.compose` | `{text}` | `{ok, draft, note}` |
| Share to a chat | `share:forward` | `share.toChat` | — (host-mediated) | `{text?,url?}` | `{success, sentTo[]}` |
| System "Share" | `share:external` | `share.external` | — | `{text?,url?,title?}` | `{success}` |
| Voices (read) | `voice:personas:read` | `voice.personas.read` | `voice.personas.read` | `{}` | `{personas[]}` |
| Voice (set) | `voice:persona:set` | `voice.personas.set` | `voice.personas.set` | `{persona_id}` | `{ok, persona_id, label, engine}` |
| Refresh session | `session:refresh` | `session.refresh` | — (management) | `{}` | `{sessionToken, expiresIn, expiresAt}` |

Examples:
```js
// Profile
const me = await x2.requestCapability('profile:read', {});
console.log(me.data.profile.slot_id);

// Contact picker → picked contact's slot_id
const c = await x2.requestCapability('contacts:pick', {});
if (c.data.slot_id) sendTo(c.data.slot_id);

// Resolve a specific contact (v2 — no picker, works from the launcher)
const r = await x2.requestCapability('contacts.resolve', { by: { slotId: 'A7X29B' } });

// Draft into the current chat
await x2.requestCapability('message:send', { text: 'Done ✅' });
```

> **Context/action boundary (v2):** "send a message to a specific chat" in v2 requires an EXPLICIT
> `target` (`message.send {text, target:{chatId|slotId}}`), not "the current chat". While the v2
> client is rolling out, use v1 `message:send` (current chat) / `share:forward` (picker).

### 4.1. Camera / microphone (`getUserMedia`)
Works (QR scanner, etc.). On Android the WebView permission is granted by the host; on iOS it's
WKWebView. Just call `navigator.mediaDevices.getUserMedia(...)`. The OS-level permission is already
declared by the X2Chat app.

---

## 5. Host events (`window.addEventListener`)

| Event | detail | When | What the app should do |
|---|---|---|---|
| `x2chat:ready` | `window.X2Chat.launch` | After inject/session reissue | Initialize |
| `x2chat:refresh` | — | Pull-to-refresh (swipe down) | Refresh the CURRENT screen, send `_refreshHandled` (else a full reload happens after 2s) |
| `x2chat:back` | — | Back button while `canGoBack` | Go to the previous screen, re-send `_navState` |
| `x2chat:theme` | `window.X2Chat.themeParams` | After inject and whenever the user changes the theme | Recolor: use CSS vars `--x2-bg`, `--x2-surface`, `--x2-card`, `--x2-text`, `--x2-hint`, `--x2-accent`, `--x2-accent-text`, `--x2-border`, `--x2-danger` (always with a fallback). On desktop the panel takes your page's `body`/`html` background color — set it explicitly |
| `x2chat:language` | `{ language, rtl }` | The user switched the X2Chat interface language | Re-render in `language` (`ru`, `en`, `es`, `de`, `fr`, `zh`, `ar`; `ar` is RTL; unknown → `en`). The same code is in the `x2_lang` launch-URL parameter, `window.X2Chat.language` and `context.locale`; helper: `https://ix.x2chat.com/mini-apps/x2-i18n.js`; catalog name/description translations: manifest `name_i18n` / `description_i18n` (see the live docs) |
| `x2chat:exitRequest` | — | Close button (in the header or on the "return" plate) while `confirmExit` | Ask "exit?", on yes — `postMessage({method:'close'})` |
| `x2chat:session` | `{state:'active'}` | After session reissue | May refresh UI if it depends on the token |
| `x2chat:visibility` | `{state:'hidden'\|'visible'}` | The user minimized your app / came back to it | Pause timers, polling, video; the host stops camera and microphone itself on `hidden` |

Minimize and return: back on your root screen and the "⌄" button in the header **minimize** the app
instead of closing it — the page stays alive, a "return" plate appears under the X2Chat header, and a tap
brings the user back to the same place. Only the close button (or your `postMessage({method:'close'})`)
closes the app. A minimized app can call the user: `window.x2.setAttention(true, 'text up to 80 chars')` —
a dot on the plate/icon and the text instead of the subtitle; `setAttention(false)` clears it, and it clears
itself when the user returns. Current state: `window.X2Chat.visibility`. On desktop the app opens in a right-hand panel
360–600 px wide (or “full window”) — your layout must work from 360 px.

Navigation (contract): report your internal nav state so the host's back button walks your app's
screen hierarchy instead of minimizing the app:
```js
window.X2ChatHost.postMessage(JSON.stringify({ method:'_navState', canGoBack: true, confirmExit: false }));
// pull-to-refresh ack:
window.X2ChatHost.postMessage(JSON.stringify({ method:'_refreshHandled' }));
```

---

## 6. Host API (REST behind the session)

Base path: `/api/v1/mini-apps/host`. Header: `X-X2Chat-Mini-App-Session: <sessionToken>`.

| Method | Path | Scope |
|---|---|---|
| GET | `/me` | `profile:read` |
| GET | `/chat` | `chat:context` |
| POST | `/message-draft` | `message:send` (body `{text}`) |
| POST | `/capabilities/request` | body `{scope, payload}` — single entry point (accepts v1 and v2 names) |

Usually you don't call these directly — use `x2.requestCapability` (the bridge injects the token
and reissues the session on 401).

**Direct fetch** (e.g. from the SDK fetch-fallback):
```js
const res = await fetch('/api/v1/mini-apps/host/capabilities/request', {
  method: 'POST',
  headers: { 'content-type': 'application/json',
             'X-X2Chat-Mini-App-Session': window.X2Chat.launch.sessionToken },
  body: JSON.stringify({ scope: 'profile:read', payload: {} })
});
```
CORS: `X-X2Chat-Mini-App-Session` must be in allow-headers; `allowed_origins` must include your app's origin.

---

## 7. Server-to-server: notify a recipient (`host/notify`) — LIVE

If your app's backend needs to notify an X2Chat user with a **system push** (e.g. "you received a
transfer") even when they haven't opened the app — use the s2s endpoint. Auth is by an **app-key**
(a secret issued by the platform operator), not a launch session.

```
POST {HOST_API}/api/v1/mini-apps/host/notify
Headers: X-X2Chat-App-Key: <app secret>
Body: {
  "to":   { "user_id": 123 }  |  { "slot_id": "A7X29B" },
  "push": { "title": "Wallet", "body": "You received 50 USDT" },
  "deeplink": "https://ix.x2chat.com/apps/wallet/?screen=history",  // opt., https/x2chat only
  "dedup_key": "tx-0xABC123"                                        // opt., dedup guard
}
→ { "success": true, "pushed": true, "deduped": false }
```
- Delivery via FCM/APNS/HMS/Mi; respects the user's notification settings and Do-Not-Disturb.
- `title` is prefixed with the app name; `deeplink` allows only `https`/`x2chat` schemes.
- Anti-abuse: per-recipient rate limit (default 6/hour) + per-key cap + dedup.
- The app-key is stored hashed (sha256) and bound to an IP allowlist (call only from your server).
- Codes: `401` invalid key · `403` no permission / IP not allowed · `429` rate limit.

Request an app-key and (optionally) the IP allowlist from the platform operator.

---

## 8. Deep-links (open the app on a specific screen)

A link with a query can be opened directly in X2Chat:
`https://ix.x2chat.com/apps/<slug>/?screen=send&to=<...>`. The host loads the app with the full URL —
read `window.location.search` (and `context.deeplink` in v2). The app is resolved by the longest
matching `launch_url` prefix (not by domain).

---

## 9. Session lifecycle

- Launch-JWT TTL is **30 minutes**, extended on activity.
- On expiry (`401`) the container **itself** reissues the session via the user's auth and retries
  the call — the mini-app doesn't notice (token-broker), plus an `x2chat:session{active}` event.
- Explicit refresh: `session:refresh` (usually unnecessary).
- Don't cache `sessionToken` for long — read the fresh one from `window.X2Chat.launch` after `x2chat:session`.

---

## 10. Registration and publishing

### 10.1. Manifest (`manifest.json` on your domain)
```jsonc
{
  "slug": "my-app",                 // ^[a-z0-9][a-z0-9-]{1,62}$, unique
  "name": "My App",
  "launch_url": "https://my.cdn.com/app/",   // HTTPS, same host as the manifest
  "version": "1.0.0",
  "scopes": ["profile:read", "message:send"],// requested scopes (least-privilege)
  "description": "…",
  "category": "tools",
  "icon": "https://my.cdn.com/app/icon.png"  // opt.; defaults to {launch_url}/icon.png
}
```
Supported scopes are validated at registration. No scopes → auto-publish; with scopes → operator review.

### 10.2. Self-registration by manifest
```
POST {HOST_API}/api/v1/mini-apps/register   (user-auth of the logged-in developer)
Body: { "manifest_url": "https://my.cdn.com/app/manifest.json" }
```
The backend fetches the manifest, validates it (slug/name/launch_url, hostOf(manifest)==hostOf(launch_url),
scopes, launch_url 200), saves it, mirrors it to the second DC. The response carries slug/status.

### 10.3. Account-confirmed registration (QR/approve, no token)
```
POST /api/v1/mini-apps/register/init  → { session_id, approve_url, poll_url, qr_payload }
```
The developer opens `approve_url` in X2Chat (logged in) → confirms → the initiator polls `poll_url`
until `status:approved`.

### 10.4. Install + launch (done by the client)
```
POST /api/v1/mini-apps/:appId/install   { chat_id?, scopes:[…] }   // the user consents to scopes
POST /api/v1/mini-apps/:appId/launch?chat_id=<opt>                  // → {launch_url, allowed_origins, session_token, context}
```

---

## 11. Hosting

- **Your own domain** (CDN): set `launch_url` + `allowed_origins`. Serve over HTTPS.
- **Under an X2Chat sub-path** (no domain of your own): `https://ru.x2chat.com/apps/<slug>/` and
  `https://ix.x2chat.com/apps/<slug>/`. **The front-end must use relative paths**
  (`fetch('api/...')`, `src="static/..."` — no leading `/`, otherwise it hits X2Chat's own API).
  `launch_url` ends with a slash.

### 11.1. Dual-DC (IMPORTANT)
The `mini_apps` registry is **not replicated** across DCs (IX/RU). Register on **each** DC. A launch
token is valid only on the issuing DC. Pick the Host API by origin: `ru.x2chat.com → RU`,
`ix.x2chat.com → IX`. **The slug is identical across DCs** — it's the stable key (the id differs).
For s2s `host/notify` the app-key works on both DCs; call the HOST_API configured for you.

---

## 12. Icon
The in-client catalog is an icon grid; the icon is supplied by the app itself (like a favicon).
Put `icon.png` next to `launch_url` (same folder): `https://…/app/icon.png`. Icon updates are picked
up (cache-busting by ETag/time).

---

## 13. Errors and troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401` on Host API | Launch session expired/revoked, or the request hit the wrong DC | Container auto-reissues; verify HOST_API matches the app origin |
| `403` on a capability | Scope not granted at install | Request the scope in the manifest; the user must reinstall (re-consent) |
| `429` on `host/notify` | Notification rate limit exceeded | Dedup by `dedup_key`, don't spam; only meaningful events |
| `contacts:pick` → old `400` | Old client build | Resolution by `contact_user_id`/`contacts.resolve` is already fixed; update the app |
| App opens "empty" on share | Old client build | Share receive on warm-start is fixed in recent builds |
| `requestCapability` rejected | No bridge (you loaded before injection) | Listen for `x2chat:ready`; the SDK has a fetch-fallback |

---

## 14. v1 → v2 migration (what you need to know)

- **v1 does not break.** Names `profile:read`, `message:send`, `contacts:pick` keep working
  (aliases → the same handlers). Deprecation is markup-only, without disabling, until v2 is proven.
- **v2 adds:** dotted names (`profile.read`), a nested immutable context (`context.user`,
  `context.chat?`), least-privilege scopes (split `message.compose`/`message.send`,
  `contacts.pick`/`contacts.resolve`), an explicit `target` on `message.send`.
- **Recommendation now:** write against v1 names (stable everywhere) or use the SDK — when the v2
  client rolls out, your code keeps working. New: `contacts.resolve` (resolve a contact by id without
  a picker, works from the launcher) is already available on the Host API.

---

## 15. Offline launch (PREVIEW — in development)

Goal: the app launches **without internet** from a locally installed signed bundle (Apple
Notarization model). Design for it now:

- **`.x2bundle`** — a zip with the static files + `manifest.json` (offline manifest) + `asset-inventory.json`
  (per-file sha256). Signed with Ed25519 (operator notarization).
- In the offline manifest, declare `offline_capable: true` and `offline_scopes` — which capabilities
  the app expects offline. Behavior without network:
  - `share.external`, `voice.personas.set` (DSP) — **work**;
  - `message.send`/`share.toChat` — **queued**, delivered when online (`{queued:true}`);
  - `profile.read`/`chat.current`/`contacts.*` — from **last-known cache**; if absent — `{error:'offline'}`;
  - any other networked call — immediately `{error:'offline'}` (no hanging).
- Declare your **CSP** in the bundle manifest (`connect-src` limits where the app reaches the network).
- Money apps (wallet): offline **only with a valid signature** — otherwise online-only.

Write the app so it degrades cleanly on `{error:'offline'}` — that is offline readiness.

---

## Related documents
- [`capability-manifest.v2.json`](./capability-manifest.v2.json) — machine-readable source-of-truth (input/output types).
- Live docs: https://x2chat.com/miniapps/dev/ (RU/EN)
- **Starter template**: [`examples/starter/`](./examples/starter/) — a complete working example (manifest + index.html + app.js + README).

_Questions and the `host/notify` app-key — from the platform operator._
