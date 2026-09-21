export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Hora (0-23) desde la que se puede agregar la canción de cada momento del día.
// Mañana: 12:00 a. m. – 11:59 a. m. · Tarde: 12:00 p. m. – 6:59 p. m. · Noche: 7:00 p. m. – 11:59 p. m.
// Un momento que ya pasó sigue abierto (en la noche se pueden poner las 3).
export const SLOT_START_HOUR = { morning: 0, afternoon: 12, night: 19 };

export function isSlotOpen(slot, date = new Date()) {
  return date.getHours() >= (SLOT_START_HOUR[slot] ?? 0);
}

export function slotStartLabel(slot) {
  const h = SLOT_START_HOUR[slot] ?? 0;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`;
}
