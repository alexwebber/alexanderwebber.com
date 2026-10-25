// Metric units for display (FR-075): km, h:mm:ss, kg, metres of elevation, percentages.

function number(value: number, decimals: number): string {
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** "8.2 km" (metres in). */
export function formatKm(metres: number, decimals = 1): string {
  return `${number(metres / 1000, decimals)} km`;
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
  return `${number(kg, decimals)} kg`;
}

/** "123 m" (elevation). */
export function formatMetres(metres: number): string {
  return `${number(metres, 0)} m`;
}

/** "17.5%" */
export function formatPercent(value: number, decimals = 1): string {
  return `${number(value, decimals)}%`;
}
