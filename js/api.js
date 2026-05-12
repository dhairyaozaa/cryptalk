/**
 * CrypTalk API Client
 */

const API = (() => {
  const BASE = window.CRYPTALK_API || 'http://localhost:3001';
  let _token = null;

  function setToken(t) {
    _token = t;
    if (t) localStorage.setItem('cryptalk_token', t);
    else localStorage.removeItem('cryptalk_token');
  }

  function getToken() {
    if (_token) return _token;
    _token = localStorage.getItem('cryptalk_token');
    return _token;
  }

  async function request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
    };
    const tok = getToken();
    if (tok) opts.headers['Authorization'] = `Bearer ${tok}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function register(username, password, publicKeyB64, encryptedPrivateKey) {
    const data = await request('POST', '/api/register', { username, password, publicKey: publicKeyB64, encryptedPrivateKey });
    setToken(data.token);
    return data;
  }

  async function login(username, password) {
    const data = await request('POST', '/api/login', { username, password });
    setToken(data.token);
    return data;
  }

  async function getMe() { return request('GET', '/api/me'); }

  async function addFriend(friendCode) { return request('POST', '/api/friends/add', { friendCode }); }

  async function getFriends() { return request('GET', '/api/friends'); }

  async function getUserPublicKey(userId) { return request('GET', `/api/users/${userId}/pubkey`); }

  async function sendMessage(recipientId, encryptedPayload, iv, tag, senderPublicKey) {
    return request('POST', '/api/messages/send', { recipientId, encryptedPayload, iv, tag, senderPublicKey });
  }

  async function getMessages(userId) { return request('GET', `/api/messages/${userId}`); }

  function logout() {
    setToken(null);
    CryptoEngine.clearKeys();
    window.location.href = '/index.html';
  }

  return { register, login, getMe, addFriend, getFriends, getUserPublicKey, sendMessage, getMessages, logout, getToken, setToken };
})();

window.API = API;
