// Configuración web de Firebase. No es secreta: la seguridad la dan las reglas
// de firestore.rules, no ocultar estas claves.
// Las variables VITE_FIREBASE_* (si existen) tienen prioridad.
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyAte5biRJPyHLHWCq3pF08GF-ONh4vbtIw',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'gymapp-cc19c.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'gymapp-cc19c',
  storageBucket: 'gymapp-cc19c.firebasestorage.app',
  messagingSenderId: '63292339938',
  appId: env.VITE_FIREBASE_APP_ID || '1:63292339938:web:eb2948ffa1568153e150bb',
};

export const hasFirebase = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
