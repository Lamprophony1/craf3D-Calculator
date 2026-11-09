export const formatPyg = (value: number) => new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0
}).format(value);

export const formatDecimal = (value: number, maximumFractionDigits = 3) => new Intl.NumberFormat('es-PY', {
  maximumFractionDigits
}).format(value);

export function formatPrintDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export const formatLocalDate = (value: string) => new Intl.DateTimeFormat('es-PY', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Asuncion'
}).format(new Date(value));

