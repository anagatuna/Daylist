import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';

const MIGRATION_KEY = 'display_name_lower_migration_v1';

export async function migrateDisplayNameLower() {
  const done = await AsyncStorage.getItem(MIGRATION_KEY);
  if (done) return;

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    await Promise.all(usersSnap.docs.map(userDoc => {
      const data = userDoc.data();
      if (!data.displayName || data.displayNameLower) return null;
      return updateDoc(doc(db, 'users', userDoc.id), {
        displayNameLower: data.displayName.toLowerCase(),
      });
    }));

    await AsyncStorage.setItem(MIGRATION_KEY, '1');
  } catch {}
}
