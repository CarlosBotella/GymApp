import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Sin zoom: ni pellizcar (iOS ignora user-scalable=no), ni Ctrl + rueda / Ctrl + +/− en ordenador.
// El doble toque ya lo quita «touch-action: manipulation» en styles.css.
const stop = (e: Event) => e.preventDefault();
document.addEventListener('gesturestart', stop);
document.addEventListener('gesturechange', stop);
document.addEventListener('touchmove', (e) => e.touches.length > 1 && e.preventDefault(), { passive: false });
window.addEventListener('wheel', (e) => e.ctrlKey && e.preventDefault(), { passive: false });
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => undefined);
  });
}
