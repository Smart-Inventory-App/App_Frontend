const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Opciones existentes que se parecen a lo que el usuario va escribiendo (sin distinguir mayúsculas ni acentos).
export function findSimilarOptions(query: string, options: string[], limit = 5): string[] {
  const q = normalize(query);
  if (!q) return [];
  return options.filter((option) => normalize(option).includes(q)).slice(0, limit);
}
