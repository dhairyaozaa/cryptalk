/**
 * CrypTalk Crypto Engine v2
 * ──────────────────────────────────────────────────────────────────
 * Full end-to-end encryption using Web Crypto API (zero dependencies)
 *
 * Protocol:
 *   1. On REGISTER — generate ECDH P-256 key pair
 *      • Store raw private key in cookie + localStorage
 *      • Wrap private key with AES-256-GCM derived from password via PBKDF2
 *      • Upload wrapped (encrypted) private key to server
 *
 *   2. On LOGIN — server returns wrapped private key
 *      • Unwrap with PBKDF2(password) → restore raw private key
 *      • Save to cookie + localStorage automatically
 *      • Works on ANY browser/device — no "key not found" ever
 *
 *   3. On message send — ECDH shared secret → AES-256-GCM encrypt
 *   4. Server stores only ciphertext — mathematically cannot decrypt
 */

const CryptoEngine = (() => {

  // ─── Key Generation ──────────────────────────────────────────────

  async function generateKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );

    const publicKeyRaw  = await crypto.subtle.exportKey('spki',  keyPair.publicKey);
    const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKey:      keyPair.publicKey,
      privateKey:     keyPair.privateKey,
      publicKeyB64:   arrayBufferToBase64(publicKeyRaw),
      privateKeyB64:  arrayBufferToBase64(privateKeyRaw)
    };
  }

  // ─── Import keys ─────────────────────────────────────────────────

  async function importPublicKey(b64) {
    return crypto.subtle.importKey(
      'spki', base64ToArrayBuffer(b64),
      { name: 'ECDH', namedCurve: 'P-256' },
      true, []
    );
  }

  async function importPrivateKey(b64) {
    return crypto.subtle.importKey(
      'pkcs8', base64ToArrayBuffer(b64),
      { name: 'ECDH', namedCurve: 'P-256' },
      true, ['deriveKey', 'deriveBits']
    );
  }

  // ─── Password-based key wrapping (PBKDF2 + AES-256-GCM) ─────────
  // This lets us store the private key on the server safely:
  // server gets an encrypted blob it cannot open without the password.

  async function deriveWrapKey(password, salt) {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey(
      'raw', enc.encode(password),
      { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false, ['wrapKey', 'unwrapKey']
    );
  }

  /**
   * Wrap (encrypt) a CryptoKey with password → base64 blob
   * Returns: "salt_b64:iv_b64:wrapped_b64"
   */
  async function wrapPrivateKey(privateKey, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const wrapKey = await deriveWrapKey(password, salt);

    const wrapped = await crypto.subtle.wrapKey(
      'pkcs8', privateKey, wrapKey,
      { name: 'AES-GCM', iv }
    );

    return [
      arrayBufferToBase64(salt),
      arrayBufferToBase64(iv),
      arrayBufferToBase64(wrapped)
    ].join(':');
  }

  /**
   * Unwrap (decrypt) a wrapped private key blob with password
   * Input: "salt_b64:iv_b64:wrapped_b64"
   * Returns: CryptoKey
   */
  async function unwrapPrivateKey(wrappedBlob, password) {
    const parts = wrappedBlob.split(':');
    if (parts.length !== 3) throw new Error('Invalid wrapped key format');
    const [saltB64, ivB64, wrappedB64] = parts;

    const salt     = base64ToArrayBuffer(saltB64);
    const iv       = base64ToArrayBuffer(ivB64);
    const wrapped  = base64ToArrayBuffer(wrappedB64);
    const wrapKey  = await deriveWrapKey(password, salt);

    return crypto.subtle.unwrapKey(
      'pkcs8', wrapped, wrapKey,
      { name: 'AES-GCM', iv },
      { name: 'ECDH', namedCurve: 'P-256' },
      true, ['deriveKey', 'deriveBits']
    );
  }

  // ─── ECDH Shared Secret ───────────────────────────────────────────

  async function deriveSharedKey(myPrivateKey, theirPublicKey) {
    return crypto.subtle.deriveKey(
      { name: 'ECDH', public: theirPublicKey },
      myPrivateKey,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt', 'decrypt']
    );
  }

  // ─── AES-256-GCM Encrypt ─────────────────────────────────────────

  async function encrypt(plaintext, sharedKey) {
    const iv      = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      sharedKey, encoded
    );

    const cipherBytes = new Uint8Array(cipherBuffer);
    const tag    = cipherBytes.slice(-16);
    const cipher = cipherBytes.slice(0, -16);

    return {
      encryptedPayload: arrayBufferToBase64(cipher),
      iv:  arrayBufferToBase64(iv),
      tag: arrayBufferToBase64(tag)
    };
  }

  // ─── AES-256-GCM Decrypt ─────────────────────────────────────────

  async function decrypt(encryptedPayload, iv, tag, sharedKey) {
    const cipherBytes = base64ToArrayBuffer(encryptedPayload);
    const tagBytes    = base64ToArrayBuffer(tag);
    const ivBytes     = base64ToArrayBuffer(iv);

    const combined = new Uint8Array(cipherBytes.byteLength + tagBytes.byteLength);
    combined.set(new Uint8Array(cipherBytes));
    combined.set(new Uint8Array(tagBytes), cipherBytes.byteLength);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes, tagLength: 128 },
      sharedKey, combined
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  // ─── Key Storage: cookie + localStorage mirror ────────────────────
  // Private key B64 is stored in BOTH places.
  // Cookie survives localStorage clears; localStorage is fast to read.
  // Cookie expiry: 10 years.

  function savePrivateKey(privateKeyB64) {
    localStorage.setItem('cryptalk_private_key', privateKeyB64);
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 10);
    document.cookie = `cryptalk_pk=${encodeURIComponent(privateKeyB64)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  }

  function loadPrivateKey() {
    // localStorage first (fast)
    const ls = localStorage.getItem('cryptalk_private_key');
    if (ls) return ls;
    // Cookie fallback
    const match = document.cookie.split('; ').find(r => r.startsWith('cryptalk_pk='));
    if (match) {
      const val = decodeURIComponent(match.split('=').slice(1).join('='));
      localStorage.setItem('cryptalk_private_key', val); // re-mirror
      return val;
    }
    return null;
  }

  function clearKeys() {
    localStorage.removeItem('cryptalk_private_key');
    document.cookie = 'cryptalk_pk=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict';
  }

  // ─── Utility ──────────────────────────────────────────────────────

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function generateFingerprint(publicKeyB64) {
    let hash = 0;
    for (let i = 0; i < publicKeyB64.length; i++) {
      hash = ((hash << 5) - hash) + publicKeyB64.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    return hex.match(/.{1,4}/g).join(' ');
  }

  return {
    generateKeyPair,
    importPublicKey,
    importPrivateKey,
    deriveSharedKey,
    encrypt,
    decrypt,
    wrapPrivateKey,
    unwrapPrivateKey,
    savePrivateKey,
    loadPrivateKey,
    clearKeys,
    arrayBufferToBase64,
    base64ToArrayBuffer,
    generateFingerprint
  };
})();

window.CryptoEngine = CryptoEngine;
