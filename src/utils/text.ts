// Muestra solo los primeros `max` caracteres y "..." si el texto es más largo (el valor guardado no se toca).
export function truncateLabel(value: string, max = 20): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
