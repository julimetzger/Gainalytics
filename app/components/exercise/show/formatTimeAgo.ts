// Compact relative-time formatter used across the Exercises tab UI for "last done"
// labels and detail-screen header cards.
export const formatTimeAgo = (date: Date | undefined, now: number = Date.now()): string => {
  if (!date) return '—';
  const diffDays = Math.floor((now - date.getTime()) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
};
