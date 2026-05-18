import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getMonthlySummary } from '../utils/gas';
import { formatWorkDurationJa } from '../utils/time';
import '../styles/Monthly.css';

export const Monthly: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  const monthKey = format(selectedMonth, 'yyyy-MM');

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      const total = await getMonthlySummary(monthKey);
      setTotalMinutes(total);
    } catch (error) {
      console.error('月間データ取得失敗:', error);
      setTotalMinutes(0);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

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
