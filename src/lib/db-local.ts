import type { AuthUser, Store, Where } from './db';
import { clean } from './db';

// Modo demo: todos los datos en localStorage de este navegador.
const KEY = 'gym:local-db';
const AUTH_KEY = 'gym:local-auth';

type Tables = Record<string, Record<string, Record<string, unknown>>>;

function load(): Tables {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function matches(row: Record<string, unknown>, where: Where): boolean {
  return where.every(([f, v]) => row[f] === v);
}

export function createLocalStore(): Store {
  let db = load();
  const listeners = new Set<() => void>();
  const authListeners = new Set<(u: AuthUser | null) => void>();

  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* lleno */
    }
    queueMicrotask(() => listeners.forEach((l) => l()));
  };

  const currentAuth = (): AuthUser | null => {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    } catch {
      return null;
    }
  };
  const setAuth = (u: AuthUser | null) => {
    if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
    else localStorage.removeItem(AUTH_KEY);
    authListeners.forEach((l) => l(u));
  };

  const table = (col: string) => (db[col] ||= {});

  const store: Store = {
    mode: 'local',
    onAuth(cb) {
      authListeners.add(cb);
      queueMicrotask(() => cb(currentAuth()));
      return () => authListeners.delete(cb);
    },
    async signUp(email, _password, name) {
      const u = { uid: 'u_' + Math.random().toString(36).slice(2, 10), email, name };
      setAuth(u);
      return u;
    },
    async signIn(email) {
      const users = Object.values(table('users')) as { id: string; email?: string; name: string }[];
      const found = users.find((x) => x.email === email);
      if (!found) throw Object.assign(new Error('No hay ninguna cuenta con ese correo.'), { code: 'auth/user-not-found' });
      const u = { uid: found.id, email, name: found.name };
      setAuth(u);
      return u;
    },
    async signInGoogle() {
      throw new Error('En el modo demo no hay acceso con Google.');
    },
    async resetPassword() {
      /* nada que hacer en demo */
    },
    async signOut() {
      setAuth(null);
    },
    async deleteAuthUser() {
      setAuth(null);
    },
    async get<T>(col: string, id: string) {
      const r = table(col)[id];
      return r ? (clean(r) as T) : null;
    },
    async set(col, id, data) {
      table(col)[id] = clean({ ...data, id }) as Record<string, unknown>;
      persist();
    },
    async update(col, id, patch) {
      const cur = table(col)[id] || { id };
      table(col)[id] = clean({ ...cur, ...patch }) as Record<string, unknown>;
      persist();
    },
    async remove(col, id) {
      delete table(col)[id];
      persist();
    },
    async query<T>(col: string, where: Where) {
      return Object.values(table(col)).filter((r) => matches(r, where)).map((r) => clean(r) as T);
    },
    watch<T>(col: string, where: Where, cb: (rows: T[]) => void) {
      const run = () => cb(Object.values(table(col)).filter((r) => matches(r, where)).map((r) => clean(r) as T));
      listeners.add(run);
      queueMicrotask(run);
      return () => listeners.delete(run);
    },
    watchDoc<T>(col: string, id: string, cb: (row: T | null) => void) {
      const run = () => {
        const r = table(col)[id];
        cb(r ? (clean(r) as T) : null);
      };
      listeners.add(run);
      queueMicrotask(run);
      return () => listeners.delete(run);
    },
  };

  // Permite a demo.ts sembrar datos sin pasar por la API
  (store as Store & { _reset: (t: Tables) => void })._reset = (t: Tables) => {
    db = t;
    persist();
  };
  return store;
}

export function localLogin(u: AuthUser) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(u));
}

export function resetLocal(t: Tables) {
  localStorage.setItem(KEY, JSON.stringify(t));
}
