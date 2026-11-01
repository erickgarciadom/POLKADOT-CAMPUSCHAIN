const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** 3500n → «$35.00». */
export function formatMxn(cents: bigint | number): string {
  return MXN.format(Number(cents) / 100);
}

/**
 * Lo que escribe el vendedor → centavos. Acepta «35», «35.5», «35.50» y «1,200.00».
 * null si no es un precio válido (más de 2 decimales, negativo, vacío).
 */
export function parsePriceCents(text: string): bigint | null {
  const clean = text.trim().replace(/^\$/, '').replace(/,/g, '');
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return null;
  const cents = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  return cents > 0n ? cents : null;
}

const DATE = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/** Segundos de block.timestamp → fecha y hora locales. */
export function formatTimestamp(seconds: number): string {
  return seconds > 0 ? DATE.format(new Date(seconds * 1000)) : '—';
}
