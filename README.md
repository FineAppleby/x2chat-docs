# X2Chat for developers

Developer documentation for [X2Chat](https://x2chat.com) — an end-to-end encrypted messenger that needs no
phone number, and a workspace: chats, calls, an AI assistant, a wallet, notes, tasks, mini apps and games
in one app. The messenger app is on [GitHub as a showcase](https://github.com/FineAppleby/x2chat).

There are two ways to build on X2Chat, and they combine well:

| | **Bots** | **Mini apps** |
|---|---|---|
| What it is | A server that talks over HTTP | A web app running inside the chat |
| Lives | In a conversation, as a participant | In a panel or a window, next to the conversation |
| Build with | Any language; Telegram libraries work | HTML/JS/CSS, any framework |
| Good for | Notifications, commands, quests, automation | Wallets, dashboards, forms, games, tools |
| Start here | [`bot-api/`](./bot-api/) | [`mini-apps/`](./mini-apps/) |

## Bot API

A Telegram-compatible HTTP API. Change the base URL and most existing bot code runs as is. On top of the
familiar methods, X2Chat adds styled buttons with automatic contrast correction, personas, chat themes,
persistent menus and a start button, so users never have to type a command.

→ [`bot-api/README.md`](./bot-api/README.md) · machine-readable UI contract:
[`bot-api/ui-schema.v1.json`](./bot-api/ui-schema.v1.json) · live reference with examples:
[x2chat.com/bots](https://x2chat.com/bots/)

## Mini apps

An ordinary web app that opens inside X2Chat and talks to the host over a JS bridge: it can read the
launch context, ask for the user's profile, open a contact picker, drop a draft into the current chat,
share, follow the app's theme and language, minimise and come back. Every capability is a scope the user
consents to at install — nothing is granted silently.

→ [`mini-apps/README.md`](./mini-apps/README.md) · machine-readable contract:
[`mini-apps/capability-manifest.v2.json`](./mini-apps/capability-manifest.v2.json) · a complete working
template: [`mini-apps/examples/starter/`](./mini-apps/examples/starter/) · live reference:
[x2chat.com/miniapps/dev](https://x2chat.com/miniapps/dev/)

## Two data centres

X2Chat runs in two data centres in different jurisdictions, `ru.x2chat.com` and `ix.x2chat.com`. Bots work
against either. The mini-app registry is **not** replicated: register your app on both, keeping the same
`slug` — it is the stable key.

## What is honest to know

- Bot messages are not end-to-end encrypted — a bot is a server and holds no device key. Conversations
  between people are. Say in your bot's description what you store.
- Mini apps run in a sandboxed WebView; navigation is limited to the origins you declare, and a missing
  scope returns 403 rather than silently failing.
- The app's own source code is not published. These are the integration contracts, and they are stable:
  version 1 names keep working as version 2 rolls out.

## Getting in touch

- Bots, mini apps, operator keys for server-to-server notifications — **bots@x2chat.com**
- Security reports — **security@x2chat.com**, see [SECURITY.md](./SECURITY.md)
- Bugs and proposals about the documentation — [issues](../../issues)
