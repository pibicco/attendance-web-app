import { useEffect, useMemo, useState } from 'react';
import { format, parse } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getMonthlyRecords } from '../utils/gas';
import '../styles/History.css';

type HistoryRecord = {
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakDuration: number;
  onBreak: boolean;
  breakStartTime: string | null;
};

export const History: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const monthKey = format(selectedMonth, 'yyyy-MM');

  useEffect(() => {
    const refreshHistory = async () => {
      try {
        setLoading(true);
        const result = await getMonthlyRecords(monthKey);
        setRecords(result || []);
      } catch (error) {
        console.error('履歴取得失敗:', error);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    refreshHistory();
  }, [monthKey]);

  const filteredRecords = useMemo(() => {
    return [...records].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [records]);

  const handlePrevMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));
  };

  const monthLabel = format(selectedMonth, 'yyyy年M月', { locale: ja });

  return (
    <div className="history-container">
      <div className="history-header">
        <h1>勤務履歴</h1>
      </div>

      <div className="month-selector">
        <button onClick={handlePrevMonth}>← 前月</button>
        <span className="month-label">{monthLabel}</span>
        <button onClick={handleNextMonth}>次月 →</button>
      </div>

      <div className="records-list">
        {loading ? (
          <div className="no-records">
            <p>読み込み中...</p>
          </div>
        ) : filteredRecords.length > 0 ? (
          filteredRecords.map((record) => {
            const recordDate = parse(record.date, 'yyyy-MM-dd', new Date());
            const dateLabel = format(recordDate, 'M月d日（EEEE）', { locale: ja });

            const workingMinutes =
              record.startTime && record.endTime
                ? (() => {
                    const [startH, startM] = record.startTime.split(':').map(Number);
                    const [endH, endM] = record.endTime.split(':').map(Number);
                    let minutes =
                      endH * 60 + endM - (startH * 60 + startM) - record.breakDuration;
                    if (minutes < 0) minutes += 24 * 60;
                    return minutes;
                  })()
                : 0;

            const hours = Math.floor(workingMinutes / 60);
            const minutes = workingMinutes % 60;

            return (
              <div key={record.date} className="record-card">
                <div className="record-date">{dateLabel}</div>
                <div className="record-details">
                  <div className="detail-item">
                    <span className="label">出勤</span>
                    <span className="value">{record.startTime || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">退勤</span>
                    <span className="value">{record.endTime || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">休憩</span>
                    <span className="value">{record.breakDuration}分</span>
                  </div>
                  <div className="detail-item highlight">
                    <span className="label">実働</span>
                    <span className="value">
                      {record.startTime && record.endTime ? `${hours}h${minutes}m` : '-'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="no-records">
            <p>この月の勤務記録がありません</p>
          </div>
        )}
      </div>
    </div>
  );
};
