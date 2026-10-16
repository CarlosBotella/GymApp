import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser, Store, Where } from './db';
import type { Profile, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  restSec: 120,
  alert: 'both',
  incMachine: 2.5,
  incDumbbell: 2,
  theme: 'auto',
  wakeLock: true,
};

interface Ctx {
  store: Store;
  auth: AuthUser | null;
  authReady: boolean;
  profile: Profile | null;
  profileReady: boolean;
  settings: Settings;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ store, children }: { store: Store; children: ReactNode }) {
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(
    () =>
      store.onAuth((u) => {
        setAuth(u);
        setAuthReady(true);
        if (!u) {
          setProfile(null);
          setProfileReady(true);
        } else setProfileReady(false);
      }),
    [store],
  );

  useEffect(() => {
    if (!auth) return;
    return store.watchDoc<Profile>('users', auth.uid, (p) => {
      setProfile(p);
      setProfileReady(true);
    });
  }, [store, auth]);

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(profile?.settings || {}) }), [profile]);

  useEffect(() => {
    const t = settings.theme;
    const root = document.documentElement;
    if (t === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);
  }, [settings.theme]);

  const value = useMemo(() => ({ store, auth, authReady, profile, profileReady, settings }), [store, auth, authReady, profile, profileReady, settings]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('Sin AppProvider');
  return c;
}

export function useMe(): Profile {
  const { profile } = useApp();
  if (!profile) throw new Error('Sin perfil');
  return profile;
}

/** Suscripción a una consulta. Devuelve null mientras carga. */
export function useQuery<T>(col: string, where: Where | null, deps: unknown[] = []): T[] | null {
  const { store } = useApp();
  const [rows, setRows] = useState<T[] | null>(null);
  const key = JSON.stringify([col, where]);
  useEffect(() => {
    if (!where) {
      setRows([]);
      return;
    }
    setRows(null);
    return store.watch<T>(col, where, setRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, key, ...deps]);
  return rows;
}

export function useDoc<T>(col: string, id: string | null | undefined): T | null | undefined {
  const { store } = useApp();
  const [row, setRow] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    if (!id) {
      setRow(null);
      return;
    }
    setRow(undefined);
    return store.watchDoc<T>(col, id, setRow);
  }, [store, col, id]);
  return row;
}
