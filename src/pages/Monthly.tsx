import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getMonthlyRecords } from '../utils/gas';
import { calcWorkMinutes, formatWorkDurationJa } from '../utils/time';
import '../styles/Monthly.css';

export const Monthly: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [records, setRecords] = useState<
    Awaited<ReturnType<typeof getMonthlyRecords>>
  >([]);
  const [loading, setLoading] = useState(true);

  const monthKey = format(selectedMonth, 'yyyy-MM');

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMonthlyRecords(monthKey);
      setRecords(result ?? []);
    } catch (error) {
      console.error('月間データ取得失敗:', error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const totalMinutes = useMemo(() => {
    let sum = 0;
    for (const record of records) {
      const minutes = calcWorkMinutes(
        record.startTime,
        record.endTime,
        record.breakDuration
      );
      if (minutes != null) sum += minutes;
    }
    return sum;
  }, [records]);

  const monthLabel = format(selectedMonth, 'yyyy年M月', { locale: ja });

  const handlePrevMonth = () => {
    setSelectedMonth(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setSelectedMonth(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1)
    );
  };

  return (
    <div className="monthly-container">
      <div className="month-selector">
        <button type="button" onClick={handlePrevMonth}>
          ←
        </button>
        <span className="month-label">{monthLabel}</span>
        <button type="button" onClick={handleNextMonth}>
          →
        </button>
      </div>

      <div className="month-total">
        <p className="month-total-label">合計勤務時間</p>
        <p className="month-total-value">
          {loading ? '読み込み中…' : formatWorkDurationJa(totalMinutes)}
        </p>
      </div>
    </div>
  );
};
