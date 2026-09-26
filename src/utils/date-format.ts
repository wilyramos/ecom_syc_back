/* File: backend/src/utils/date-format.ts (o frontend/src/utils/date-format.ts) */

/**
 * Formatea una fecha en formato peruano (DD/MM/YYYY, hh:mm:ss a.m./p.m.)
 * Forzado a zona horaria 'America/Lima' (UTC-5)
 */
export function formatPeruDateTime(date: Date | string | number | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Formatea solo la fecha (DD/MM/YYYY) forzada a 'America/Lima'
 */
export function formatPeruDate(date: Date | string | number | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}