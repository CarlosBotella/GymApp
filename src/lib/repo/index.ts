import { hasFirebase } from '../../firebaseConfig';
import type { Repo } from './types';
import { createDemoRepo } from './demo';

const MODE_KEY = 'gymapp.mode';

export type Mode = 'demo' | 'firebase';

export function currentMode(): Mode {
  const saved = localStorage.getItem(MODE_KEY);
  if (saved === 'demo') return 'demo';
  return hasFirebase ? 'firebase' : 'demo';
}

export function setMode(mode: Mode) {
  localStorage.setItem(MODE_KEY, mode);
  location.reload();
}

let instance: Promise<Repo> | null = null;

/** Una sola instancia por carga de la app. */
export function createRepo(): Promise<Repo> {
  if (!instance) {
    instance = currentMode() === 'firebase'
      ? import('./firebase').then((m) => m.createFirebaseRepo())
      : Promise.resolve(createDemoRepo());
  }
  return instance;
}

export type { Repo } from './types';
