/**
 * CrypTalk Backend Server
 * End-to-end encrypted messaging with X25519 key exchange + AES-256-GCM
 * All messages stored encrypted — server NEVER sees plaintext
 *
 * Key backup: private key is encrypted client-side with the user's password
 * before being sent here — server cannot decrypt it but can return it on login
 * so the user's key is restored automatically on any device/browser.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Skip ngrok browser warning for API calls
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// ─── Storage paths ────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');
const KEYS_DIR = path.join(DATA_DIR, 'keys');

[DATA_DIR, MESSAGES_DIR, KEYS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function generateFriendCode() {
  const raw = crypto.randomBytes(16).toString('hex').toUpperCase();
  return `CT-${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20,24)}-${raw.slice(24,28)}-${raw.slice(28,32)}`;
}

function getConvoId(a, b) {
  return [a, b].sort().join('__');
}

function getConvoFile(id) {
  return path.join(MESSAGES_DIR, `${id}.json`);
}

function loadConvo(id) {
  const f = getConvoFile(id);
  if (!fs.existsSync(f)) return [];
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function saveConvo(id, messages) {
  fs.writeFileSync(getConvoFile(id), JSON.stringify(messages, null, 2));
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Connected clients map ────────────────────────────────────────────────────
const clients = new Map();

// ─── Routes ───────────────────────────────────────────────────────────────────

// Register
// encryptedPrivateKey: the user's ECDH private key wrapped with AES-256-GCM
// derived from their password via PBKDF2 — server stores it but cannot read it
app.post('/api/register', async (req, res) => {
  const { username, password, publicKey, encryptedPrivateKey } = req.body;
  if (!username || !password || !publicKey) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const users = loadUsers();

  if (Object.values(users).find(u => u.username === username)) {
    return res.status(409).json({ error: 'Username taken' });
  }

  const id = uuidv4();
  const friendCode = generateFriendCode();
  const passwordHash = await bcrypt.hash(password, 12);

  users[id] = {
    id,
    username,
    passwordHash,
    friendCode,
    publicKey,
    encryptedPrivateKey: encryptedPrivateKey || null,
    friends: [],
    createdAt: Date.now()
  };

  saveUsers(users);
  console.log(`[REGISTER] New user: ${username} | Code: ${friendCode}`);

  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token, id, username, friendCode, publicKey,
    encryptedPrivateKey: users[id].encryptedPrivateKey
  });
});

// Login — returns encryptedPrivateKey so client can unwrap with password
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  const user = Object.values(users).find(u => u.username === username);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  console.log(`[LOGIN] ${username}`);
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    id: user.id,
    username: user.username,
    friendCode: user.friendCode,
    publicKey: user.publicKey,
    encryptedPrivateKey: user.encryptedPrivateKey || null
  });
});

// Get my profile
app.get('/api/me', authMiddleware, (req, res) => {
  const users = loadUsers();
  const user = users[req.user.id];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user.id,
    username: user.username,
    friendCode: user.friendCode,
    publicKey: user.publicKey,
    encryptedPrivateKey: user.encryptedPrivateKey || null,
    friends: user.friends
  });
});

// Add friend by code
app.post('/api/friends/add', authMiddleware, (req, res) => {
  const { friendCode } = req.body;
  const users = loadUsers();
  const me = users[req.user.id];

  const friend = Object.values(users).find(u => u.friendCode === friendCode);
  if (!friend) return res.status(404).json({ error: 'No user with that code' });
  if (friend.id === me.id) return res.status(400).json({ error: "Can't add yourself" });
  if (me.friends.includes(friend.id)) return res.status(409).json({ error: 'Already friends' });

  me.friends.push(friend.id);
  friend.friends.push(me.id);
  saveUsers(users);

  console.log(`[FRIEND] ${me.username} <-> ${friend.username}`);
  res.json({ id: friend.id, username: friend.username, friendCode: friend.friendCode, publicKey: friend.publicKey });
});

// Get friends list
app.get('/api/friends', authMiddleware, (req, res) => {
  const users = loadUsers();
  const me = users[req.user.id];
  const friends = me.friends.map(fid => {
    const f = users[fid];
    return { id: f.id, username: f.username, friendCode: f.friendCode, publicKey: f.publicKey };
  });
  res.json(friends);
});

// Get public key for a user
app.get('/api/users/:id/pubkey', authMiddleware, (req, res) => {
  const users = loadUsers();
  const user = users[req.params.id];
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ publicKey: user.publicKey });
});

// Send encrypted message
app.post('/api/messages/send', authMiddleware, (req, res) => {
  const { recipientId, encryptedPayload, iv, tag, senderPublicKey } = req.body;
  if (!recipientId || !encryptedPayload) return res.status(400).json({ error: 'Missing fields' });

  const users = loadUsers();
  const me = users[req.user.id];
  const recipient = users[recipientId];
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
  if (!me.friends.includes(recipientId)) return res.status(403).json({ error: 'Not friends' });

  const msg = {
    id: uuidv4(),
    senderId: req.user.id,
    recipientId,
    encryptedPayload,
    iv,
    tag,
    senderPublicKey,
    timestamp: Date.now()
  };

  const convoId = getConvoId(req.user.id, recipientId);
  const messages = loadConvo(convoId);
  messages.push(msg);
  saveConvo(convoId, messages);

  console.log(`[MSG] ${me.username} -> ${recipient.username} | Encrypted blob: ${encryptedPayload.length} chars`);

  const recipientWs = clients.get(recipientId);
  if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
    recipientWs.send(JSON.stringify({ type: 'new_message', message: msg }));
  }

  res.json({ success: true, messageId: msg.id });
});

// Get conversation history
app.get('/api/messages/:userId', authMiddleware, (req, res) => {
  const users = loadUsers();
  const me = users[req.user.id];
  if (!me.friends.includes(req.params.userId)) {
    return res.status(403).json({ error: 'Not friends' });
  }

  const convoId = getConvoId(req.user.id, req.params.userId);
  const messages = loadConvo(convoId);
  res.json(messages);
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  let userId = null;

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      if (data.type === 'auth') {
        const decoded = jwt.verify(data.token, JWT_SECRET);
        userId = decoded.id;
        clients.set(userId, ws);
        ws.send(JSON.stringify({ type: 'auth_ok', userId }));
        console.log(`[WS] Authenticated: ${decoded.username}`);
      }
      if (data.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: e.message }));
    }
  });

  ws.on('close', () => { if (userId) clients.delete(userId); });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║          CrypTalk Server Running          ║
║  Port: ${PORT}                               ║
║  Encryption: AES-256-GCM + ECDH P-256    ║
║  Key backup: password-wrapped, server     ║
║  cannot decrypt stored private keys       ║
╚═══════════════════════════════════════════╝
  `);
});
