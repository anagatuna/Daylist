import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { localDateStr } from './date';

function dateBefore(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isComplete(post) {
  const s = post?.songs;
  return !!(s?.morning && s?.afternoon && s?.night);
}

export async function calculateStreak(uid) {
  const postsSnap = await getDocs(query(
    collection(db, 'posts'),
    where('uid', '==', uid)
  ));

  const completeDates = new Set();
  postsSnap.docs.forEach(d => {
    const data = d.data();
    if (isComplete(data)) completeDates.add(data.date);
  });

  if (completeDates.size === 0) return { current: 0, longest: 0 };

  const today = localDateStr();
  let streak = 0;
  let checkDate = completeDates.has(today) ? today : dateBefore(today, 1);

  if (!completeDates.has(checkDate)) return { current: 0, longest: computeLongest(completeDates) };

  while (completeDates.has(checkDate)) {
    streak++;
    checkDate = dateBefore(checkDate, 1);
  }

  return { current: streak, longest: Math.max(streak, computeLongest(completeDates)) };
}

function computeLongest(dates) {
  const sorted = [...dates].sort().reverse();
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
  return Math.max(longest, run);
}

export async function syncStreakToProfile(uid) {
  const { current, longest } = await calculateStreak(uid);
  await updateDoc(doc(db, 'users', uid), {
    streak: current,
    longestStreak: longest,
  });
  return { current, longest };
}
