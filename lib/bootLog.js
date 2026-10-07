// Diagnóstico temporal de arranque: registra a los cuántos ms (desde que abrió
// la página) ocurre cada paso, para ver en el teléfono dónde se va el tiempo.
// Se consulta tocando 5 veces el logo del feed.
const KEY = 'daylist_boot_log';
const MAX_MARKS = 60;

function readStored() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

const previous = readStored();
const marks = [];

export function mark(name) {
  if (marks.length >= MAX_MARKS) return;
  marks.push(`${name}: ${Math.round(globalThis.performance?.now?.() ?? 0)} ms`);
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(marks));
  } catch {}
}

export function bootReport() {
  const nav = globalThis.navigator;
  const standalone = nav?.standalone ?? globalThis.matchMedia?.('(display-mode: standalone)').matches;
  return [
    `App instalada: ${standalone ? 'sí' : 'no'} · Red: ${nav?.connection?.effectiveType ?? '?'}`,
    '— Esta apertura —',
    ...marks,
    '— Apertura anterior —',
    ...(previous.length ? previous : ['(sin datos)']),
  ].join('\n');
}

mark('js cargado');
