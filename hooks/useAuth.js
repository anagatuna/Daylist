import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

async function ensureUserDocument(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Usuario',
      email: user.email,
      avatar: null,
      createdAt: serverTimestamp(),
      friends: [],
      friendRequests: [],
    });
  }
}

export function useAuth() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) await ensureUserDocument(u).catch(() => {});
      setUser(u);
    });
    return unsub;
  }, []);

  return { user, loading: user === undefined };
}
