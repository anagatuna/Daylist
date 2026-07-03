import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { localDateStr } from './date';

export const MAX_STREAK_FREEZES = 2;
export const FREEZE_AWARD_INTERVAL = 7;

function dateBefore(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isComplete(post) {
  const s = post?.songs;
  return !!(s?.morning && s?.afternoon && s?.night);
}

function computeLongest(dates) {
  const sorted = [...dates].sort().reverse();
  if (sorted.length === 0) return 0;
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

// Un protector solo puede cubrir un día aislado que esté pegado a actividad
// real del día anterior — así nunca "resucita" una racha ya abandonada hace
// tiempo, solo salva un tropiezo puntual dentro de una racha activa.
function computeStreakWithFreezes(completeDates, frozenDates, freezesAvailable) {
  const covered = new Set([...completeDates, ...frozenDates]);
  const newlyFrozen = [];
  let freezesLeft = freezesAvailable;

  const isCovered = (d) => covered.has(d);
  const tryFreeze = (d) => {
    if (freezesLeft <= 0) return false;
    if (!completeDates.has(dateBefore(d, 1))) return false;
    covered.add(d);
    newlyFrozen.push(d);
    freezesLeft--;
    return true;
  };

  if (completeDates.size === 0) {
    return { current: 0, longest: 0, freezesLeft, newlyFrozen };
  }

  const today = localDateStr();
  let checkDate = isCovered(today) ? today : dateBefore(today, 1);

  if (!isCovered(checkDate) && (checkDate === today || !tryFreeze(checkDate))) {
    return { current: 0, longest: computeLongest(completeDates), freezesLeft, newlyFrozen };
  }

  let streak = 0;
  while (isCovered(checkDate)) {
    streak++;
    const prev = dateBefore(checkDate, 1);
    if (!isCovered(prev) && !tryFreeze(prev)) break;
    checkDate = prev;
  }

  return { current: streak, longest: Math.max(streak, computeLongest(covered)), freezesLeft, newlyFrozen };
}

export async function calculateStreak(uid) {
  const [postsSnap, userSnap] = await Promise.all([
    getDocs(query(collection(db, 'posts'), where('uid', '==', uid))),
    getDoc(doc(db, 'users', uid)),
  ]);

  const completeDates = new Set();
  postsSnap.docs.forEach(d => {
    const data = d.data();
    if (isComplete(data)) completeDates.add(data.date);
  });

  const userData = userSnap.data() ?? {};
  const frozenDates = new Set(userData.frozenDates ?? []);
  const freezesAvailable = userData.streakFreezes ?? 0;
  const freezeMilestone = userData.freezeMilestone ?? 0;

  const { current, longest, freezesLeft, newlyFrozen } = computeStreakWithFreezes(completeDates, frozenDates, freezesAvailable);

  return {
    current,
    longest,
    frozenDates: [...frozenDates, ...newlyFrozen],
    freezesAvailable: freezesLeft,
    freezesUsed: newlyFrozen.length,
    freezeMilestone,
  };
}

export async function syncStreakToProfile(uid) {
  const { current, longest, frozenDates, freezesAvailable, freezesUsed, freezeMilestone } = await calculateStreak(uid);

  let streakFreezes = freezesAvailable;
  let freezeAwarded = false;
  let newMilestone = freezeMilestone;

  if (current > 0 && current > freezeMilestone && current % FREEZE_AWARD_INTERVAL === 0) {
    newMilestone = current;
    if (streakFreezes < MAX_STREAK_FREEZES) {
      streakFreezes++;
      freezeAwarded = true;
    }
  }

  await updateDoc(doc(db, 'users', uid), {
    streak: current,
    longestStreak: longest,
    frozenDates,
    streakFreezes,
    freezeMilestone: newMilestone,
  });

  return { current, longest, streakFreezes, freezeAwarded, freezesUsed };
}
