/**
 * CrypTalk Toast Notifications
 */
const Toast = (() => {
  let container;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type = 'info', duration = 3500) {
    const c = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    c.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toast-in 0.3s ease reverse';
      setTimeout(() => toast.remove(), 280);
    }, duration);
  }

  return {
    success: (msg) => show(msg, 'success'),
    error:   (msg) => show(msg, 'error'),
    info:    (msg) => show(msg, 'info')
  };
})();

window.Toast = Toast;
