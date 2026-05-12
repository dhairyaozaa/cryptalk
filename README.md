# 🔐 CrypTalk

> **Zero-knowledge, end-to-end encrypted messaging. The server never sees your messages.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Encryption: AES-256-GCM](https://img.shields.io/badge/Encryption-AES--256--GCM-green.svg)]()
[![Key Exchange: ECDH P-256](https://img.shields.io/badge/Key_Exchange-ECDH_P--256-purple.svg)]()
[![Frontend: Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla_JS-yellow.svg)]()
[![Backend: Node.js](https://img.shields.io/badge/Backend-Node.js-brightgreen.svg)]()

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔑 **End-to-End Encryption** | ECDH P-256 key exchange + AES-256-GCM per-message encryption |
| 🚫 **Zero Server Knowledge** | Server stores only ciphertext — mathematically cannot decrypt messages |
| 🪪 **Friend Codes** | Bitcoin wallet-style unique codes for adding friends (no phone numbers, no emails) |
| ⚡ **Real-time Delivery** | WebSocket push with polling fallback |
| 🌋 **Animated UI** | Lava lamp metaball canvas, glassmorphism panels, smooth animations |
| 🖥️ **Local Storage** | All encrypted message blobs stored on your machine |
| 🔒 **Private Key Never Leaves Device** | Keys generated in browser, stored in localStorage, never transmitted |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ALICE'S DEVICE                        │
│                                                              │
│  ┌─────────────────┐       ┌──────────────────────────────┐ │
│  │  Browser        │       │  Private Key (localStorage)  │ │
│  │  (frontend/)    │◄─────►│  NEVER leaves this device    │ │
│  └────────┬────────┘       └──────────────────────────────┘ │
│           │ ECDH Shared Secret                               │
│           │ AES-256-GCM Encrypt                              │
└───────────┼──────────────────────────────────────────────────┘
            │ Ciphertext only (base64)
            ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVER (your machine)                    │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │  Express + WebSocket                            │        │
│  │  Stores: { encryptedPayload, iv, tag }          │        │
│  │  CANNOT DECRYPT — no private keys here          │        │
│  └─────────────────────────────────────────────────┘        │
└───────────┼──────────────────────────────────────────────────┘
            │ Ciphertext only
            ▼
┌─────────────────────────────────────────────────────────────┐
│                         BOB'S DEVICE                         │
│                                                              │
│  ┌─────────────────┐       ┌──────────────────────────────┐ │
│  │  Browser        │       │  Private Key (localStorage)  │ │
│  │  (frontend/)    │◄─────►│  ECDH → Shared Secret        │ │
│  └─────────────────┘       │  AES-256-GCM Decrypt         │ │
│                             └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Encryption Protocol

1. **Key Generation** — On registration, each client generates an ECDH P-256 key pair using the browser's native `crypto.subtle` API.
2. **Key Exchange** — Public keys are uploaded to the server. Private keys are stored only in `localStorage` and never transmitted.
3. **Shared Secret** — When Alice messages Bob, her browser derives a shared secret using her private key and Bob's public key via ECDH. Bob derives the same shared secret using his private key and Alice's public key.
4. **Message Encryption** — Each message is encrypted with AES-256-GCM using a random 96-bit IV. The GCM auth tag provides integrity verification.
5. **Storage** — The server stores only `{ encryptedPayload, iv, tag, senderPublicKey }`. It has no way to decrypt this data.
6. **Decryption** — On receipt, Bob derives the shared secret and decrypts locally in the browser.

---

## 📁 Project Structure

```
cryptalk/
├── frontend/                 ← Static files — push to GitHub Pages
│   ├── index.html            ← Auth page (login/register)
│   ├── app.html              ← Main chat application
│   ├── css/
│   │   └── style.css         ← Full UI styles + animations
│   └── js/
│       ├── crypto.js         ← E2E encryption engine (Web Crypto API)
│       ├── api.js            ← REST API client
│       ├── websocket.js      ← WebSocket client with reconnection
│       ├── lava.js           ← Lava lamp canvas animation
│       └── toast.js          ← Notification system
│
├── backend/                  ← Runs on YOUR machine
│   ├── src/
│   │   └── server.js         ← Express + WebSocket server
│   ├── data/                 ← Created at runtime (gitignored)
│   │   ├── users.json        ← User accounts + public keys
│   │   └── messages/         ← Encrypted message blobs per conversation
│   ├── .env.example          ← Environment template
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- A terminal

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/cryptalk.git
cd cryptalk/backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and set a strong JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Paste the output as JWT_SECRET in .env
```

### 3. Start the Backend Server

```bash
npm start
```

You should see:
```
╔═══════════════════════════════════════════╗
║          CrypTalk Server Running          ║
║  Port: 3001                               ║
║  Encryption: AES-256-GCM + X25519 ECDH   ║
║  Storage: Local encrypted blobs only      ║
╚═══════════════════════════════════════════╝
```

### 4. Serve the Frontend

Serve the `frontend/` folder with any static file server:

```bash
# Option A: Python (built-in)
cd frontend
python3 -m http.server 8080

# Option B: Node http-server
npx http-server frontend -p 8080

# Option C: VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

Open `http://localhost:8080` in your browser.

### 5. Configure API URL

In both `frontend/index.html` and `frontend/app.html`, update:

```javascript
window.CRYPTALK_API = 'http://localhost:3001'; // ← change to your server URL
```

---

## 🌐 Deploying to GitHub Pages (Frontend)

The frontend is 100% static — no build step needed.

```bash
# Push just the frontend folder
git subtree push --prefix frontend origin gh-pages
```

Or set GitHub Pages source to the `frontend/` folder in your repo settings.

> ⚠️ When deployed to GitHub Pages, update `CRYPTALK_API` in both HTML files to point to your backend server's public URL.

---

## 🔒 Security Notes

### What the server CANNOT do
- Read your messages (no private keys)
- Impersonate you (JWT-signed identity)
- Inject fake messages (GCM auth tag verification)

### What you should know
- **Private key is stored in `localStorage`** — clearing your browser data will lose the ability to decrypt old messages. Consider exporting your key.
- **No forward secrecy** — this implementation uses static ECDH keys. For production, implement ephemeral key exchange (Signal Protocol's Double Ratchet).
- **Key verification** — check the fingerprint panel (🔑 button in chat) to verify you're talking to the right person, not a MITM attacker who compromised the server.
- **HTTPS required for production** — run behind nginx with a TLS certificate. Never run on plain HTTP in production.

### Recommended Production Hardening
- [ ] Put backend behind nginx + Let's Encrypt TLS
- [ ] Add rate limiting (`express-rate-limit`)
- [ ] Implement ephemeral session keys (Double Ratchet / Signal Protocol)
- [ ] Add key backup/export functionality
- [ ] Audit `bcrypt` rounds for your hardware (currently 12)
- [ ] Add CSRF protection for the REST API
- [ ] Consider storing encrypted messages in SQLite instead of flat JSON

---

## 🧠 HCI Design Principles Applied

| Principle | Implementation |
|---|---|
| **Visibility of System Status** | WS connection dot, encryption badges on every message, loading states |
| **Error Prevention** | Password strength meter, friend code format validation |
| **Recognition over Recall** | Friend codes displayed prominently, copy button always visible |
| **Aesthetic & Minimalist Design** | Glassmorphism UI, information shown only when relevant |
| **Feedback** | Toast notifications for all actions, decryption reveal animation |
| **User Control** | Key fingerprint panel, sign-out, clear visual of encryption state |

---

## 🌋 Distributed Computing Notes

CrypTalk's design allows for horizontal scaling:

- **Stateless REST API** — JWT authentication means any server instance can handle any request
- **WebSocket affinity** — for multi-server deployments, add Redis pub/sub (e.g. `socket.io-redis`) to broadcast messages across nodes
- **Storage** — replace flat JSON with a distributed database (CockroachDB, MongoDB Atlas) for multi-node deployments
- **Key Distribution** — public keys can be replicated across CDN edges; only private endpoints need auth

---

## 📜 License

MIT — see [LICENSE](LICENSE)

---

## 🙏 Cryptography Libraries Used

- **Web Crypto API** — browser-native, FIPS 140-2 compliant implementation
- **bcrypt** — password hashing (server-side)
- **jsonwebtoken** — session management

*No third-party crypto libraries in the browser — only the built-in `crypto.subtle` API.*

---

<div align="center">
  <strong>Built with 🔐 and paranoia</strong><br/>
  <em>Your messages are yours alone.</em>
</div>
"# cryptalk" 
"# cryptalk" 
