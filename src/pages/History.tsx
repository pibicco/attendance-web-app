import { useState, useMemo } from 'react';
import { useAttendanceStore } from '../store/attendanceStore';
import { format, parse, startOfMonth, endOfMonth, isBefore, isAfter } from 'date-fns';
import { ja } from 'date-fns/locale';
import '../styles/History.css';

export const History: React.FC = () => {
  const { records } = useAttendanceStore();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const filteredRecords = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    return records
      .filter((record) => {
        const recordDate = parse(record.date, 'yyyy-MM-dd', new Date());
        return !isBefore(recordDate, monthStart) && !isAfter(recordDate, monthEnd);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, selectedMonth]);

  const handlePrevMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1));
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
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => {
            const recordDate = parse(record.date, 'yyyy-MM-dd', new Date());
            const dateLabel = format(recordDate, 'M月d日（EEEE）', { locale: ja });

            const workingMinutes =
              record.startTime && record.endTime
                ? (() => {
                    const [startH, startM] = record.startTime.split(':').map(Number);
                    const [endH, endM] = record.endTime.split(':').map(Number);
                    return (endH * 60 + endM) - (startH * 60 + startM) - record.breakDuration;
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
                      {hours}h{minutes}m
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
