const GAS_URL =
  'https://flat-poetry-984a.ex24-kpp.workers.dev/';

export const sendToSheet = async (data: {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  breakDuration?: number;
  onBreak?: boolean;
  breakStartTime?: string | null;
}) => {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await res.json();

  if (!result.success) {
    throw new Error(result.error || '送信失敗');
  }

  return result;
};

export const getTodayRecord = async (date: string) => {
  const res = await fetch(`${GAS_URL}?date=${encodeURIComponent(date)}&_=${Date.now()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const result = await res.json();

  if (!result.success) {
    throw new Error(result.error || '取得失敗');
  }

  return result.record as {
    date: string;
    startTime: string | null;
    endTime: string | null;
    breakDuration: number;
    onBreak: boolean;
    breakStartTime: string | null;
  } | null;
};
