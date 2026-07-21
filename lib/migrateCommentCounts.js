import { collectionGroup, getDocs, doc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';

const MIGRATION_KEY = 'comment_counts_migration_v1';

export async function migrateCommentCounts() {
  const done = await AsyncStorage.getItem(MIGRATION_KEY);
  if (done) return;

  try {
    const commentsSnap = await getDocs(collectionGroup(db, 'comments'));
    const countsByPost = {};
    commentsSnap.docs.forEach(d => {
      const slot = d.data().slot;
      if (!slot) return;
      const postId = d.ref.parent.parent.id;
      if (!countsByPost[postId]) countsByPost[postId] = {};
      countsByPost[postId][slot] = (countsByPost[postId][slot] ?? 0) + 1;
    });

    await Promise.all(Object.entries(countsByPost).map(([postId, commentCounts]) =>
      updateDoc(doc(db, 'posts', postId), { commentCounts })
    ));

    await AsyncStorage.setItem(MIGRATION_KEY, '1');
  } catch {}
}
