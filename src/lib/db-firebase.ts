import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where as fwhere,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig } from '../firebaseConfig';
import type { AuthUser, Store, Where } from './db';
import { clean } from './db';

function toUser(u: User): AuthUser {
  return { uid: u.uid, email: u.email, name: u.displayName };
}

// Con la caché offline, una escritura sin conexión no se confirma hasta volver a tener red.
// La guardamos en local al momento y no bloqueamos la pantalla esperando al servidor.
function soon(p: Promise<unknown>): Promise<void> {
  p.catch((e) => console.error('Firestore:', e));
  return Promise.race([p.then(() => undefined), new Promise<void>((r) => setTimeout(r, 1200))]);
}

export function createFirebaseStore(): Store {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  let db: Firestore;
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = initializeFirestore(app, {});
  }

  const q = (col: string, where: Where) => query(collection(db, col), ...where.map(([f, v]) => fwhere(f, '==', v)));

  return {
    mode: 'firebase',
    onAuth(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null));
    },
    async signUp(email, password, name) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name }).catch(() => undefined);
      return { uid: cred.user.uid, email: cred.user.email, name };
    },
    async signIn(email, password) {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return toUser(cred.user);
    },
    async signInGoogle() {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      return toUser(cred.user);
    },
    async resetPassword(email) {
      await sendPasswordResetEmail(auth, email);
    },
    async signOut() {
      await signOut(auth);
    },
    async deleteAuthUser() {
      if (auth.currentUser) await deleteUser(auth.currentUser);
    },
    async get<T>(col: string, id: string) {
      const s = await getDoc(doc(db, col, id));
      return s.exists() ? ({ ...s.data(), id: s.id } as T) : null;
    },
    set(col, id, data) {
      return soon(setDoc(doc(db, col, id), clean({ ...data, id })));
    },
    update(col, id, patch) {
      return soon(updateDoc(doc(db, col, id), clean(patch) as Record<string, unknown>));
    },
    remove(col, id) {
      return soon(deleteDoc(doc(db, col, id)));
    },
    async query<T>(col: string, where: Where) {
      const s = await getDocs(q(col, where));
      return s.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
    },
    watch<T>(col: string, where: Where, cb: (rows: T[]) => void) {
      return onSnapshot(
        q(col, where),
        (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }) as T)),
        (e) => {
          console.error('Firestore watch', col, e);
          cb([]);
        },
      );
    },
    watchDoc<T>(col: string, id: string, cb: (row: T | null) => void) {
      return onSnapshot(
        doc(db, col, id),
        (s) => cb(s.exists() ? ({ ...s.data(), id: s.id } as T) : null),
        (e) => {
          console.error('Firestore watchDoc', col, e);
          cb(null);
        },
      );
    },
  };
}
