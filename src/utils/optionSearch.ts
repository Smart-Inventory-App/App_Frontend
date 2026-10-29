const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Opciones existentes que se parecen a lo que el usuario va escribiendo (sin distinguir mayúsculas ni acentos).
export function findSimilarOptions(query: string, options: string[], limit = 5): string[] {
  const q = normalize(query);
  if (!q) return [];
  return options.filter((option) => normalize(option).includes(q)).slice(0, limit);
}

/** Las opciones en orden alfabético, sin distinguir mayúsculas ni acentos («Álamo» va con la A). No modifica la lista original. */
export function sortAlphabetically(options: string[]): string[] {
  return [...options].sort((a, b) => {
    const x = normalize(a);
    const y = normalize(b);
    if (x === y) return a < b ? -1 : a > b ? 1 : 0;
    return x < y ? -1 : 1;
  });
}
