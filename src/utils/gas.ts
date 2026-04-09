const GAS_URL =
  'https://flat-poetry-984a.ex24-kpp.workers.dev/';

type ApiRecord = {
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakDuration: number;
  onBreak: boolean;
  breakStartTime: string | null;
};

const parseJsonResponse = async <T>(res: Response): Promise<T> => {
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text || '通信失敗'}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`JSONじゃない返答: ${text}`);
  }
};

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

  const result = await parseJsonResponse<{ success: boolean; error?: string }>(res);

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

  const result = await parseJsonResponse<{
    success: boolean;
    error?: string;
    record: ApiRecord | null;
  }>(res);

  if (!result.success) {
    throw new Error(result.error || '取得失敗');
  }

  return result.record;
};

export const getMonthlyRecords = async (month: string) => {
  const res = await fetch(`${GAS_URL}?month=${encodeURIComponent(month)}&_=${Date.now()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const result = await parseJsonResponse<{
    success: boolean;
    error?: string;
    records: ApiRecord[];
  }>(res);

  if (!result.success) {
    throw new Error(result.error || '月間取得失敗');
  }

  return result.records;
};
