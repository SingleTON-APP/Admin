export function resolutionDuration(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return '—';
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} мин`;
  if (rounded < 1440)
    return `${Math.floor(rounded / 60)} ч ${rounded % 60} мин`;
  return `${Math.floor(rounded / 1440)} д ${Math.floor((rounded % 1440) / 60)} ч`;
}
