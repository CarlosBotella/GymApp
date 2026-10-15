import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut as fbSignOut, type User,
} from 'firebase/auth';
import {
  collection, deleteDoc, doc, getDoc, getDocs, initializeFirestore, persistentLocalCache,
  persistentMultipleTabManager, query, setDoc, updateDoc, where, writeBatch, type Firestore,
} from 'firebase/firestore';
import { firebaseConfig } from '../../firebaseConfig';
import type { Profile, Routine, Workout } from '../types';
import type { ProfilePatch, Repo } from './types';
import { shortCode } from '../util';

/**
 * Firebase (plan Spark, gratuito): Auth con email + contraseña y Firestore.
 *
 * Colecciones:
 *   users/{uid}          perfil (rol, entrenador, centro, ajustes de máquina)
 *   trainerCodes/{code}  { trainerId } para que un cliente se vincule con un código
 *   routines/{id}        rutina completa con sus días (clientId, trainerId)
 *   workouts/{id}        entreno registrado con todas sus series (clientId, trainerId)
 *
 * trainerId se copia en rutinas y entrenos para que las reglas de seguridad
 * puedan dejar leer al entrenador sin consultas extra. Ver firestore.rules.
 */

const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Firestore no resuelve las escrituras hasta que llegan al servidor. Sin cobertura
 *  las deja en cola y las sube solo; no bloqueamos la pantalla esperando. */
async function commit(p: Promise<unknown>) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    p.catch((e) => console.error('Escritura pendiente fallida', e));
    return;
  }
  await Promise.race([p, new Promise((r) => setTimeout(r, 6000))]);
}

function toProfile(id: string, d: Record<string, any>): Profile {
  return {
    id,
    name: d.name ?? '',
    role: d.role === 'trainer' ? 'trainer' : 'client',
    trainerId: d.trainerId ?? null,
    center: d.center ?? 'ruzafa',
    code: d.code ?? null,
    exerciseNotes: d.exerciseNotes ?? {},
    email: d.email,
  };
}

function authError(e: any): Error {
  const code: string = e?.code ?? '';
  const msg: Record<string, string> = {
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/wrong-password': 'Email o contraseña incorrectos.',
    'auth/user-not-found': 'No hay ninguna cuenta con ese email.',
    'auth/email-already-in-use': 'Ya hay una cuenta con ese email. Inicia sesión.',
    'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
    'auth/invalid-email': 'El email no es válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/network-request-failed': 'Sin conexión. Inténtalo cuando tengas cobertura.',
    'auth/operation-not-allowed': 'Activa "Correo electrónico/contraseña" en Firebase › Authentication.',
    'permission-denied': 'Permiso denegado. ¿Has publicado las reglas de firestore.rules?',
  };
  return new Error(msg[code] ?? e?.message ?? 'Algo ha fallado.');
}

export function createFirebaseRepo(): Repo {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  }

  let current: Profile | null = null;
  let signingUp = false;
  const listeners = new Set<(p: Profile | null) => void>();
  const emit = (p: Profile | null) => {
    current = p;
    listeners.forEach((l) => l(p));
  };

  async function loadProfile(user: User): Promise<Profile> {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return toProfile(user.uid, snap.data());
    // Cuenta sin perfil (registro a medias): se crea como cliente.
    const data = { name: user.email?.split('@')[0] ?? '', role: 'client', trainerId: null, center: 'ruzafa', code: null, exerciseNotes: {}, email: user.email, createdAt: new Date().toISOString() };
    await setDoc(ref, data);
    return toProfile(user.uid, data);
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) return emit(null);
    if (signingUp) return; // signUp emite cuando el perfil ya existe
    try {
      emit(await loadProfile(user));
    } catch (e) {
      console.error(e);
      emit(null);
    }
  });

  const me = () => {
    if (!current) throw new Error('No has iniciado sesión.');
    return current;
  };

  const mine = (clientId: string) => {
    const p = me();
    const col = (name: string) => collection(db, name);
    return (name: 'routines' | 'workouts') =>
      p.role === 'trainer' && clientId !== p.id
        ? query(col(name), where('clientId', '==', clientId), where('trainerId', '==', p.id))
        : query(col(name), where('clientId', '==', clientId));
  };

  /** Al cambiar de entrenador, el historial pasa a ser visible para el nuevo. */
  async function relinkData(uid: string, trainerId: string | null) {
    const q = (name: string) => getDocs(query(collection(db, name), where('clientId', '==', uid)));
    const [r, w] = await Promise.all([q('routines'), q('workouts')]);
    const refs = [...r.docs, ...w.docs].map((d) => d.ref);
    for (let i = 0; i < refs.length; i += 400) {
      const b = writeBatch(db);
      refs.slice(i, i + 400).forEach((ref) => b.update(ref, { trainerId }));
      await commit(b.commit());
    }
  }

  return {
    mode: 'firebase',
    onAuth(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signIn(email, password) {
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } catch (e) {
        throw authError(e);
      }
    },
    async signUp({ email, password, name, role, center }) {
      signingUp = true;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const uid = cred.user.uid;
        const code = role === 'trainer' ? shortCode() : null;
        const b = writeBatch(db);
        b.set(doc(db, 'users', uid), { name: name.trim(), role, trainerId: null, center, code, exerciseNotes: {}, email: email.trim(), createdAt: new Date().toISOString() });
        if (code) b.set(doc(db, 'trainerCodes', code), { trainerId: uid });
        await b.commit();
        emit(toProfile(uid, { name: name.trim(), role, trainerId: null, center, code, exerciseNotes: {}, email }));
      } catch (e) {
        throw authError(e);
      } finally {
        signingUp = false;
      }
    },
    async resetPassword(email) {
      try {
        await sendPasswordResetEmail(auth, email.trim());
      } catch (e) {
        throw authError(e);
      }
    },
    async signOut() {
      await fbSignOut(auth);
    },
    async updateMe(patch: ProfilePatch) {
      const p = me();
      await commit(updateDoc(doc(db, 'users', p.id), clean(patch) as Record<string, unknown>));
      const next = { ...p, ...patch };
      emit(next);
      return next;
    },
    async joinTrainer(code) {
      const p = me();
      try {
        const snap = await getDoc(doc(db, 'trainerCodes', code.trim().toUpperCase()));
        if (!snap.exists()) throw new Error('No hay ningún entrenador con ese código.');
        const trainerId = snap.data().trainerId as string;
        await updateDoc(doc(db, 'users', p.id), { trainerId });
        await relinkData(p.id, trainerId);
        const next = { ...p, trainerId };
        emit(next);
        return next;
      } catch (e) {
        throw authError(e);
      }
    },
    async leaveTrainer() {
      const p = me();
      await updateDoc(doc(db, 'users', p.id), { trainerId: null });
      await relinkData(p.id, null);
      const next = { ...p, trainerId: null };
      emit(next);
      return next;
    },
    async getProfile(id) {
      const snap = await getDoc(doc(db, 'users', id));
      return snap.exists() ? toProfile(id, snap.data()) : null;
    },
    async listClients() {
      const snap = await getDocs(query(collection(db, 'users'), where('trainerId', '==', me().id)));
      return snap.docs.map((d) => toProfile(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
    },
    async listRoutines(clientId) {
      const snap = await getDocs(mine(clientId)('routines'));
      return snap.docs.map((d) => ({ ...(d.data() as Routine), id: d.id }));
    },
    async saveRoutine(r) {
      const p = me();
      // El trainerId de la rutina es siempre el entrenador actual del cliente.
      const trainerId = p.role === 'trainer' && r.clientId !== p.id ? p.id : p.trainerId;
      try {
        await commit(setDoc(doc(db, 'routines', r.id), clean({ ...r, trainerId })));
      } catch (e) {
        throw authError(e);
      }
    },
    async deleteRoutine(r) {
      await commit(deleteDoc(doc(db, 'routines', r.id)));
    },
    async listWorkouts(clientId) {
      const snap = await getDocs(mine(clientId)('workouts'));
      return snap.docs.map((d) => ({ ...(d.data() as Workout), id: d.id }));
    },
    async saveWorkout(w) {
      const p = me();
      try {
        await commit(setDoc(doc(db, 'workouts', w.id), clean({ ...w, trainerId: p.trainerId ?? null })));
      } catch (e) {
        throw authError(e);
      }
    },
    async deleteWorkout(w) {
      await commit(deleteDoc(doc(db, 'workouts', w.id)));
    },
    async commentWorkout(w, comment) {
      try {
        await commit(updateDoc(doc(db, 'workouts', w.id), { trainerComment: comment || null }));
      } catch (e) {
        throw authError(e);
      }
    },
  };
}
