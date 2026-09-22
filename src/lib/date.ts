/** Indonesian relative time, e.g. "Hari ini", "3 hari lalu", "2 minggu lalu". */
export function relativeTimeId(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;

  if (diff < min) return "Baru saja";
  if (diff < hour) return `${Math.floor(diff / min)} menit lalu`;
  if (diff < day) return `${Math.floor(diff / hour)} jam lalu`;

  const days = Math.floor(diff / day);
  if (days === 1) return "Kemarin";
  if (days < 7) return `${days} hari lalu`;
  if (days < 30) return `${Math.floor(days / 7)} minggu lalu`;
  if (days < 365) return `${Math.floor(days / 30)} bulan lalu`;
  return `${Math.floor(days / 365)} tahun lalu`;
}
