/** Short number suffixes so values never feel "ridiculous" (GDD 05): 950, 1.2K, 3.4M. */
export function formatNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.round(n));
  if (abs < 1_000_000) return `${(n / 1000).toFixed(abs < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(abs < 10_000_000 ? 1 : 0)}M`;
}
