// src/utils/date.ts
/** Convierte 'YYYY-MM-DD HH:mm:ss' (o 'YYYY-MM-DDTHH:mm:ss') a Date LOCAL. */
export function parseSqlDatetimeToLocal(input?: string | null): Date | null {
  if (!input) return null;
  const s = String(input).trim().replace('T', ' '); // por si viene con T
  const [d, t = '00:00:00'] = s.split(' ');
  const [Y, M, D] = d.split('-').map(n => Number(n));
  const [h = 0, m = 0, sec = 0] = t.split(':').map(n => Number(n));
  // Date(año, mes-1, día, hora, min, seg) crea fecha en zona local
  const dt = new Date(Y, (M || 1) - 1, D || 1, h, m, sec);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Formatea a MX corto, siempre en local. */
export function formatDateTimeMX(input?: string | Date | null): string {
  const d = typeof input === 'string' ? parseSqlDatetimeToLocal(input) : input;
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', hour12: true });
}
