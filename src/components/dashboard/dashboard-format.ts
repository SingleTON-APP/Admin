export function resolutionDuration(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return '—';
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} мин`;
  if (rounded < 1440)
    return `${Math.floor(rounded / 60)} ч ${rounded % 60} мин`;
  return `${Math.floor(rounded / 1440)} д ${Math.floor((rounded % 1440) / 60)} ч`;
}

export function formatBytes(bytes: number | null) {
  if (bytes === null) return '—';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1;
  return `${value.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[unit]}`;
}
