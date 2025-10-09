const oldError = console.error;
const oldWarn = console.warn;

console.error = function (...args) {
  showErrorOverlay(args.join(' '));
  oldError.apply(console, args);
};

console.warn = function (...args) {
  showErrorOverlay(args.join(' '));
  oldWarn.apply(console, args);
};

function showErrorOverlay(message) {
  // Prevent duplicate overlays
  if (document.getElementById('error-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'error-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.background = 'rgba(255, 0, 0, 0.95)';
  overlay.style.color = '#fff';
  overlay.style.padding = '20px';
  overlay.style.fontFamily = 'monospace';
  overlay.style.fontSize = '14px';
  overlay.style.zIndex = '999999';
  overlay.style.whiteSpace = 'pre-wrap';
  overlay.textContent = message;
  document.body.appendChild(overlay);
}

window.addEventListener('error', (event) => {
  showErrorOverlay(`Global Error: ${event.message}\n${event.error?.stack ?? ''}`);
});

window.addEventListener('unhandledrejection', (event) => {
  showErrorOverlay(`Unhandled Promise Rejection: ${event.reason}`);
});

function showErrorOverlay(message) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.background = 'rgba(255, 0, 0, 0.9)';
  overlay.style.color = '#fff';
  overlay.style.padding = '16px';
  overlay.style.zIndex = '99999';
  overlay.style.whiteSpace = 'pre-wrap';
  overlay.style.fontFamily = 'monospace';
  overlay.innerText = message;
  document.body.appendChild(overlay);
}