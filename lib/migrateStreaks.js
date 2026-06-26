import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import { localDateStr } from './date';

const MIGRATION_KEY = 'streak_migration_v1';

function dateBefore(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isComplete(post) {
  const s = post?.songs;
  return !!(s?.morning && s?.afternoon && s?.night);
}

function computeStreaks(completeDates) {
  if (completeDates.size === 0) return { current: 0, longest: 0 };

  const today = localDateStr();
  let current = 0;
  let checkDate = completeDates.has(today) ? today : dateBefore(today, 1);

  if (completeDates.has(checkDate)) {
    while (completeDates.has(checkDate)) {
      current++;
      checkDate = dateBefore(checkDate, 1);
    }
  }

  const sorted = [...completeDates].sort().reverse();
  let longest = 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (dateBefore(sorted[i - 1], 1) === sorted[i]) {
      run++;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run);

  return { current, longest: Math.max(current, longest) };
}

export async function runStreakMigration() {
  const done = await AsyncStorage.getItem(MIGRATION_KEY);
  if (done) return;

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const postsSnap = await getDocs(collection(db, 'posts'));

    const postsByUid = {};
    postsSnap.docs.forEach(d => {
      const data = d.data();
      if (!postsByUid[data.uid]) postsByUid[data.uid] = [];
      postsByUid[data.uid].push(data);
    });

    await Promise.all(usersSnap.docs.map(async userDoc => {
      const uid = userDoc.id;
      const posts = postsByUid[uid] ?? [];
      const completeDates = new Set();
      posts.forEach(p => { if (isComplete(p)) completeDates.add(p.date); });
      const { current, longest } = computeStreaks(completeDates);
      await updateDoc(doc(db, 'users', uid), { streak: current, longestStreak: longest });
    }));

    await AsyncStorage.setItem(MIGRATION_KEY, '1');
  } catch {}
}
