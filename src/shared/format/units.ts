// Metric units for display (FR-075): km, h:mm:ss, kg, metres of elevation, percentages.

/** "1,234.5": UK style, to `decimals` places (or up to `maxDecimals`, e.g. "93" and "52.5"). */
export function formatNumber(value: number, decimals = 0, maxDecimals = decimals): string {
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

/** A chart axis label in km: "5 km", "2.5 km" (km in). */
export function formatAxisKm(km: number): string {
  return formatKm(km * 1000, Number.isInteger(km) ? 0 : 1);
}

/** "8.2 km" (metres in). */
export function formatKm(metres: number, decimals = 1): string {
  return `${formatNumber(metres / 1000, decimals)} km`;
}

/** "44:41" under an hour, "3:28:40" from an hour (seconds in, rounded to the second). */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "100.7 kg" */
export function formatKg(kg: number, decimals = 1): string {
  return `${formatNumber(kg, decimals)} kg`;
}

/** "123 m" (elevation). */
export function formatMetres(metres: number): string {
  return `${formatNumber(metres, 0)} m`;
}

/** "17.5%" */
export function formatPercent(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)}%`;
}
