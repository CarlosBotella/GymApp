import { useEffect, useState } from 'react';

// Router mínimo por hash (#/ruta?x=1). Funciona en GitHub Pages sin configuración.
//
// Solo se navega con los botones de la app: cada cambio de pantalla sustituye la
// entrada actual del historial (no se apilan), y una entrada «guardia» hace que el
// botón atrás del móvil, el gesto de volver o las flechas del navegador no hagan nada.
// El «atrás» de la app usa su propia pila.
export interface Route {
  path: string;
  parts: string[];
  params: URLSearchParams;
}

function parse(): Route {
  const h = location.hash.replace(/^#/, '') || '/';
  const [p, q] = h.split('?');
  const path = p.startsWith('/') ? p : '/' + p;
  return { path, parts: path.split('/').filter(Boolean), params: new URLSearchParams(q || '') };
}

let current = location.hash || '#/';
const stack: string[] = [];

function show(h: string) {
  current = h;
  history.replaceState({ gym: 1 }, '', h);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

if (typeof window !== 'undefined') {
  history.replaceState({ gym: 0 }, '', current);
  history.pushState({ gym: 1 }, '', current);
  // atrás del sistema: se vuelve a poner la pantalla actual
  window.addEventListener('popstate', () => {
    history.pushState({ gym: 1 }, '', current);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  // enlaces internos (<a href="#/…">) pasan por go() para no crear historial
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href^="#/"]') as HTMLAnchorElement | null;
    if (!a || a.target || a.hasAttribute('download')) return;
    e.preventDefault();
    go(a.getAttribute('href')!.slice(1));
  });
}

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => {
      if (location.hash && location.hash !== current) current = location.hash;
      setR(parse());
      document.getElementById('root')?.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(to: string, replace = false) {
  const h = '#' + (to.startsWith('/') ? to : '/' + to);
  if (h === current) return;
  if (!replace) {
    stack.push(current);
    if (stack.length > 50) stack.shift();
  }
  show(h);
}

/** Vuelve a la pantalla anterior de la app; si no hay, va a la ruta indicada. */
export function back(fallback = '/') {
  const prev = stack.pop();
  show(prev || '#' + (fallback.startsWith('/') ? fallback : '/' + fallback));
}

export function href(to: string): string {
  return '#' + (to.startsWith('/') ? to : '/' + to);
}
