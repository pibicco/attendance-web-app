const GAS_URL =
  'https://script.google.com/macros/s/AKfycbwl5vg1OMG5ZG7yo6DjXdmdSFgFX57x9_QkECt4Otm9pTICpifPBn-vVmL6egMGeySb/exec';

export const sendToSheet = async (data: {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  breakDuration?: number;
  onBreak?: boolean;
}) => {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
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
  const res = await fetch(`${GAS_URL}?date=${encodeURIComponent(date)}`);
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
  } | null;
};
