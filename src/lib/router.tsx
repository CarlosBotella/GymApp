import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

/** Router mínimo con hash (#/ruta): funciona en GitHub Pages sin configurar nada. */

function currentPath(): string {
  const h = location.hash.replace(/^#/, '');
  return h || '/';
}

export function useLocation(): { path: string; query: URLSearchParams } {
  const [hash, setHash] = useState(currentPath());
  useEffect(() => {
    const on = () => setHash(currentPath());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [path, qs = ''] = hash.split('?');
  return { path, query: new URLSearchParams(qs) };
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const url = '#' + to;
  if (opts.replace) {
    history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = to;
  }
  window.scrollTo(0, 0);
}

export function back(fallback = '/') {
  if (history.length > 1) history.back();
  else navigate(fallback, { replace: true });
}

export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

export function Link({ to, children, ...rest }: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={'#' + to} {...rest}>
      {children}
    </a>
  );
}
