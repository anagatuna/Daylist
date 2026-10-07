import { useSyncExternalStore } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { mark } from '@/lib/bootLog';

async function ensureUserDocument(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const displayName = user.displayName ?? user.email?.split('@')[0] ?? 'Usuario';
    await setDoc(ref, {
      displayName,
      displayNameLower: displayName.toLowerCase(),
      email: user.email,
      avatar: null,
      createdAt: serverTimestamp(),
      friends: [],
      friendRequests: [],
    });
  }
}

// Una sola suscripción compartida: antes cada componente que usaba el hook
// (pantallas, cada tarjeta de canción…) abría la suya y releía el documento del
// usuario, y al remontar una pantalla el usuario volvía a "cargando".
let currentUser; // undefined hasta que Firebase resuelve la sesión
let ensuredUid = null;
let started = false;
const listeners = new Set();

function start() {
  if (started) return;
  started = true;
  onAuthStateChanged(auth, async (u) => {
    mark(u ? 'sesión resuelta' : 'sin sesión');
    if (u && u.uid !== ensuredUid) {
      await ensureUserDocument(u).catch(() => {});
      ensuredUid = u.uid;
      mark('perfil verificado');
    }
    currentUser = u;
    listeners.forEach(notify => notify());
  });
}

function subscribe(notify) {
  start();
  listeners.add(notify);
  return () => listeners.delete(notify);
}

const getUser = () => currentUser;
const getServerUser = () => undefined;

export function useAuth() {
  const user = useSyncExternalStore(subscribe, getUser, getServerUser);
  return { user, loading: user === undefined };
}
