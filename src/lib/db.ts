// Capa de datos común. Hay dos implementaciones con la misma interfaz:
// - db-firebase.ts: Firebase Auth + Firestore (con caché offline).
// - db-local.ts: modo demo, todo en este navegador (localStorage).
// Las pantallas solo hablan con esta interfaz.

export type Where = [field: string, value: unknown][];

export interface AuthUser {
  uid: string;
  email: string | null;
  name: string | null;
}

export interface Store {
  mode: 'firebase' | 'local';
  onAuth(cb: (u: AuthUser | null) => void): () => void;
  signUp(email: string, password: string, name: string): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signInGoogle(): Promise<AuthUser>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAuthUser(): Promise<void>;

  get<T>(col: string, id: string): Promise<T | null>;
  set(col: string, id: string, data: object): Promise<void>;
  update(col: string, id: string, patch: object): Promise<void>;
  remove(col: string, id: string): Promise<void>;
  query<T>(col: string, where: Where): Promise<T[]>;
  watch<T>(col: string, where: Where, cb: (rows: T[]) => void): () => void;
  watchDoc<T>(col: string, id: string, cb: (row: T | null) => void): () => void;
}

const MODE_KEY = 'gym:mode';

export function savedMode(): 'firebase' | 'local' {
  try {
    return localStorage.getItem(MODE_KEY) === 'local' ? 'local' : 'firebase';
  } catch {
    return 'firebase';
  }
}

export function setSavedMode(m: 'firebase' | 'local') {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* sin almacenamiento */
  }
}

export async function createStore(mode: 'firebase' | 'local'): Promise<Store> {
  if (mode === 'local') {
    const m = await import('./db-local');
    return m.createLocalStore();
  }
  const m = await import('./db-firebase');
  return m.createFirebaseStore();
}

/** Quita undefined (Firestore no los acepta) */
export function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'El correo no es válido.',
    'auth/missing-password': 'Escribe la contraseña.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/email-already-in-use': 'Ya hay una cuenta con ese correo. Entra en lugar de registrarte.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No hay ninguna cuenta con ese correo.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/network-request-failed': 'Sin conexión. Inténtalo cuando tengas cobertura.',
    'auth/popup-closed-by-user': 'Se cerró la ventana antes de terminar.',
    'auth/requires-recent-login': 'Por seguridad, sal y vuelve a entrar antes de borrar la cuenta.',
    'auth/operation-not-allowed': 'Este método de acceso no está activado en Firebase.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication › Settings).',
  };
  return map[code] || (e instanceof Error ? e.message : 'Algo ha fallado. Inténtalo de nuevo.');
}
