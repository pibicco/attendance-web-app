export const normalizeTime = (value: string | null | undefined): string | null => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '0') return null;
  return trimmed;
};

export const calcWorkMinutes = (
  startTime: string | null,
  endTime: string | null,
  breakMinutes: number
): number | null => {
  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);
  if (!start || !end) return null;

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  let minutes = endH * 60 + endM - (startH * 60 + startM) - breakMinutes;
  if (minutes < 0) minutes += 24 * 60;

  return minutes;
};

export const formatWorkDurationJa = (minutes: number | null): string => {
  if (minutes == null) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}時間${mins}分`;
};
