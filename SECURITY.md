# Security

## Reporting a vulnerability

Write to **security@x2chat.com**. Please include what you did, what happened, and what you expected. We answer every report, and we will tell you plainly whether we can fix it and when.

Please do not open a public issue for a vulnerability.

## How the app protects you

The full security model is published at **https://x2chat.com/security/** — identity keys, message encryption, call encryption, key verification, and an honest list of what is not protected yet.

Short version:

- Identity: Ed25519 signing key and an RSA-2048 wrapping key, generated on the device. No phone number, no email, no server-side password.
- Messages and files: a fresh AES-256-GCM key per message, wrapped for each recipient device. The server stores and relays ciphertext.
- Calls: audio over our own QUIC transport (Opus, AES-256-GCM); video over WebRTC with Insertable Streams, so relays see encrypted frames.
- Key verification: in person by QR. A key you verified always wins over one the server offers, and silent key replacement is refused.

Known gaps, stated plainly: no forward secrecy yet, no external audit yet, metadata visible to the server, bot chats not end-to-end encrypted.
