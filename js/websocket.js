/**
 * CrypTalk WebSocket Client
 * Real-time delivery of encrypted message packets
 */

const WSClient = (() => {
  let ws = null;
  let reconnectTimer = null;
  const listeners = {};

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(fn => fn(data));
  }

  function connect() {
    const token = API.getToken();
    if (!token) return;

    const wsUrl = (window.CRYPTALK_API || 'http://localhost:3001')
      .replace('http', 'ws')
      .replace('https', 'wss');

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
      emit('connected');
      if (reconnectTimer) { clearInterval(reconnectTimer); reconnectTimer = null; }
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        emit(data.type, data);
        if (data.type === 'new_message') emit('message', data.message);
      } catch {}
    };

    ws.onclose = () => {
      emit('disconnected');
      reconnectTimer = setInterval(connect, 5000);
    };

    ws.onerror = () => ws.close();
  }

  function disconnect() {
    if (reconnectTimer) clearInterval(reconnectTimer);
    if (ws) ws.close();
  }

  function ping() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  setInterval(ping, 30000);

  return { connect, disconnect, on, emit };
})();

window.WSClient = WSClient;
