import { collection, query, where, getDocs, doc, getDoc, updateDoc, writeBatch, deleteField } from 'firebase/firestore';
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
//
// `carry` ({ date, count }) permite restaurar una racha a mano desde Firestore:
// significa "al cierre de `date` la racha valía `count`". Al recorrer hacia
// atrás, si se llega a ese día se suma `count` y se deja de contar.
function computeStreakWithFreezes(completeDates, frozenDates, freezesAvailable, carry) {
  const covered = new Set([...completeDates, ...frozenDates]);
  if (carry) covered.add(carry.date);
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

  if (completeDates.size === 0 && !carry) {
    return { current: 0, longest: 0, freezesLeft, newlyFrozen };
  }

  const today = localDateStr();
  let checkDate = isCovered(today) ? today : dateBefore(today, 1);

  if (!isCovered(checkDate) && (checkDate === today || !tryFreeze(checkDate))) {
    return { current: 0, longest: computeLongest(completeDates), freezesLeft, newlyFrozen };
  }

  let streak = 0;
  while (isCovered(checkDate)) {
    if (carry && checkDate === carry.date) {
      streak += carry.count;
      break;
    }
    streak++;
    const prev = dateBefore(checkDate, 1);
    if (!isCovered(prev) && !tryFreeze(prev)) break;
    checkDate = prev;
  }

  if (carry) covered.delete(carry.date);
  const longest = Math.max(streak, computeLongest(covered));
  return { current: streak, longest, freezesLeft, newlyFrozen };
}

// Los posts viejos traen una copia del avatar (base64) que pesa en cada lectura.
// Se quita en segundo plano aprovechando que aquí ya se leyeron todos los posts
// del usuario; no toca updatedAt para no alterar el orden de la actividad.
async function stripPostAvatars(postDocs) {
  const heavy = postDocs.filter(d => d.data().avatar !== undefined);
  for (let i = 0; i < heavy.length; i += 400) {
    const batch = writeBatch(db);
    heavy.slice(i, i + 400).forEach(d => batch.update(d.ref, { avatar: deleteField() }));
    await batch.commit();
  }
}

export async function calculateStreak(uid) {
  const [postsSnap, userSnap] = await Promise.all([
    getDocs(query(collection(db, 'posts'), where('uid', '==', uid))),
    getDoc(doc(db, 'users', uid)),
  ]);

  stripPostAvatars(postsSnap.docs).catch(() => {});

  const completeDates = new Set();
  postsSnap.docs.forEach(d => {
    const data = d.data();
    if (isComplete(data)) completeDates.add(data.date);
  });

  const userData = userSnap.data() ?? {};
  const frozenDates = new Set(userData.frozenDates ?? []);
  const freezesAvailable = userData.streakFreezes ?? 0;
  const freezeMilestone = userData.freezeMilestone ?? 0;
  const rawCarry = userData.streakCarry;
  const carry = rawCarry?.date && rawCarry?.count > 0
    ? { date: String(rawCarry.date), count: Number(rawCarry.count) }
    : null;

  const { current, longest, freezesLeft, newlyFrozen } = computeStreakWithFreezes(completeDates, frozenDates, freezesAvailable, carry);

  return {
    current,
    // La mejor racha nunca baja (p. ej. si se restauró a mano).
    longest: Math.max(longest, userData.longestStreak ?? 0),
    frozenDates: [...frozenDates, ...newlyFrozen],
    freezesAvailable: freezesLeft,
    freezesUsed: newlyFrozen.length,
    freezeMilestone,
    userData,
  };
}

export async function syncStreakToProfile(uid) {
  const { current, longest, frozenDates, freezesAvailable, freezesUsed, freezeMilestone, userData } = await calculateStreak(uid);

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

  // userData: el perfil ya leído, para que quien llama no lo vuelva a descargar
  return { current, longest, streakFreezes, freezeAwarded, freezesUsed, userData };
}
