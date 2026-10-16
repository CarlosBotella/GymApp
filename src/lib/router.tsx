import { useEffect, useState } from 'react';

// Router mínimo por hash (#/ruta?x=1). Funciona en GitHub Pages sin configuración.
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

let depth = 0;

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(to: string, replace = false) {
  const h = '#' + (to.startsWith('/') ? to : '/' + to);
  if (replace) {
    history.replaceState(null, '', h);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    depth++;
    location.hash = h;
  }
}

/** Vuelve atrás si hemos navegado dentro de la app; si no, va a la ruta indicada. */
export function back(fallback = '/') {
  if (depth > 0) {
    depth--;
    history.back();
  } else go(fallback, true);
}

export function href(to: string): string {
  return '#' + (to.startsWith('/') ? to : '/' + to);
}
