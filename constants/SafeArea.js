// En web, react-native-safe-area-context trata como activos los bordes que no
// aparecen en un arreglo de `edges` (edges={[]} termina aplicando los cuatro).
// La forma de objeto con 'off' explícito se comporta igual en todas las plataformas.
export const NO_EDGES = { top: 'off', right: 'off', bottom: 'off', left: 'off' };
export const TOP_EDGE = { ...NO_EDGES, top: 'additive' };
