import React, { useEffect, useMemo, useState } from 'react';
import { format, parse } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getMonthlyRecords } from '../utils/gas';
import '../styles/Monthly.css';

type MonthlyRecord = {
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakDuration: number;
  onBreak: boolean;
  breakStartTime: string | null;
};

export const Monthly: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const monthKey = format(selectedMonth, 'yyyy-MM');

  useEffect(() => {
    const refreshMonthlyData = async () => {
      try {
        setLoading(true);
        const result = await getMonthlyRecords(monthKey);
        setRecords(result || []);
      } catch (error) {
        console.error('月間データ取得失敗:', error);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    refreshMonthlyData();
  }, [monthKey]);

  const monthlyStats = useMemo(() => {
    let totalWorkingMinutes = 0;
    let workingDays = 0;

    const chartData = records
      .filter((record) => record.startTime && record.endTime)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((record) => {
        const [startH, startM] = (record.startTime || '00:00').split(':').map(Number);
        const [endH, endM] = (record.endTime || '00:00').split(':').map(Number);

        let workingMinutes =
          endH * 60 + endM - (startH * 60 + startM) - record.breakDuration;

        if (workingMinutes < 0) workingMinutes += 24 * 60;

        totalWorkingMinutes += workingMinutes;
        workingDays += 1;

        const recordDate = parse(record.date, 'yyyy-MM-dd', new Date());
        const dayLabel = format(recordDate, 'd日');

        return {
          date: dayLabel,
          hours: Math.round((workingMinutes / 60) * 10) / 10,
        };
      });

    const avgHours = workingDays > 0 ? totalWorkingMinutes / 60 / workingDays : 0;

    return {
      workingDays,
      totalHours: Math.round((totalWorkingMinutes / 60) * 10) / 10,
      avgHours: Math.round(avgHours * 10) / 10,
      chartData,
    };
  }, [records]);

  const handlePrevMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));
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
          <div className="stat-value">
            {loading ? '...' : `${monthlyStats.workingDays}日`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">総労働時間</div>
          <div className="stat-value">
            {loading ? '...' : `${monthlyStats.totalHours}時間`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">平均勤務時間</div>
          <div className="stat-value">
            {loading ? '...' : `${monthlyStats.avgHours}時間`}
          </div>
        </div>
      </div>

      <div className="chart-container">
        <h3>日別労働時間</h3>
        {loading ? (
          <div className="no-data">
            <p>読み込み中...</p>
          </div>
        ) : monthlyStats.chartData.length > 0 ? (
          <div className="no-data">
            <p>グラフデータ {monthlyStats.chartData.length}件</p>
          </div>
        ) : (
          <div className="no-data">
            <p>この月の勤務記録がありません</p>
          </div>
        )}
      </div>
    </div>
  );
};
