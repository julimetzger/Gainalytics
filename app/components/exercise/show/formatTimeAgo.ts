// Compact relative-time formatter used across the Exercises tab UI for "last done"
// labels and detail-screen header cards. Diffs by calendar day, not raw ms,
// so a workout at 23:30 viewed at 08:00 next morning correctly reads "yesterday".
export const formatTimeAgo = (date: Date | undefined, now: number = Date.now()): string => {
  if (!date) return '—';
  const t = date.getTime();
  if (!Number.isFinite(t)) return '—';
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const diffDays = Math.round((startOfDay(now) - startOfDay(t)) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
};
