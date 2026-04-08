import React, { useState, useMemo } from 'react';
import { useAttendanceStore } from '../store/attendanceStore';
import { format, parse, startOfMonth, endOfMonth, isBefore, isAfter } from 'date-fns';
import { ja } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/Monthly.css';

export const Monthly: React.FC = () => {
  const { records } = useAttendanceStore();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const monthlyStats = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    const monthRecords = records.filter((record) => {
      const recordDate = parse(record.date, 'yyyy-MM-dd', new Date());
      return !isBefore(recordDate, monthStart) && !isAfter(recordDate, monthEnd);
    });

    let totalWorkingMinutes = 0;
    let workingDays = 0;

    const chartData = monthRecords
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((record) => {
        if (record.startTime && record.endTime) {
          const [startH, startM] = record.startTime.split(':').map(Number);
          const [endH, endM] = record.endTime.split(':').map(Number);
          const workingMinutes =
            (endH * 60 + endM) - (startH * 60 + startM) - record.breakDuration;
          totalWorkingMinutes += workingMinutes;
          workingDays += 1;

          const recordDate = parse(record.date, 'yyyy-MM-dd', new Date());
          const dayLabel = format(recordDate, 'd日');

          return {
            date: dayLabel,
            hours: Math.round((workingMinutes / 60) * 10) / 10,
          };
        }
        return null;
      })
      .filter((item) => item !== null);

    const avgHours = workingDays > 0 ? totalWorkingMinutes / 60 / workingDays : 0;

    return {
      workingDays,
      totalHours: Math.round((totalWorkingMinutes / 60) * 10) / 10,
      avgHours: Math.round(avgHours * 10) / 10,
      chartData,
    };
  }, [records, selectedMonth]);

  const handlePrevMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1));
  };

  const monthLabel = format(selectedMonth, 'yyyy年M月', { locale: ja });

  return (
    <div className="monthly-container">
      <div className="monthly-header">
        <h1>月間集計</h1>
      </div>

      <div className="month-selector">
        <button onClick={handlePrevMonth}>← 前月</button>
        <span className="month-label">{monthLabel}</span>
        <button onClick={handleNextMonth}>次月 →</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">勤務日数</div>
          <div className="stat-value">{monthlyStats.workingDays}日</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">総労働時間</div>
          <div className="stat-value">{monthlyStats.totalHours}時間</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">平均勤務時間</div>
          <div className="stat-value">{monthlyStats.avgHours}時間</div>
        </div>
      </div>

      <div className="chart-container">
        <h3>日別労働時間</h3>
        {monthlyStats.chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyStats.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="hours" fill="#0a7ea4" name="労働時間（時間）" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="no-data">
            <p>この月の勤務記録がありません</p>
          </div>
        )}
      </div>

      <div className="export-section">
        <h3>Googleスプレッドシートへエクスポート</h3>
        <button className="btn btn-primary">
          スプレッドシートに送信
        </button>
        <p className="export-note">※ 機能は準備中です</p>
      </div>
    </div>
  );
};
