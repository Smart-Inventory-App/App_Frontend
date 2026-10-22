/**
 * Pone primero lo que está seleccionado y deja el resto en su orden original.
 * Como el orden se calcula a partir de la lista original, al deseleccionar cada
 * elemento vuelve solo a su lugar de siempre.
 */
export function selectedFirst<T>(items: T[], isSelected: (item: T) => boolean): T[] {
  const selected = items.filter(isSelected);
  if (selected.length === 0) return items;
  return [...selected, ...items.filter(item => !isSelected(item))];
}
