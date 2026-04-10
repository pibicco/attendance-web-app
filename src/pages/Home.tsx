import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { TimeRecord } from '../store/attendanceStore';
import { getTodayRecord, prefetchMonthlyRecords, sendToSheet } from '../utils/gas';
import '../styles/Home.css';

type SyncedTimeRecord = TimeRecord & {
  breakStartTime?: string | null;
};

export const Home: React.FC = () => {
  const [today, setToday] = useState<string>('');
  const [todayRecord, setTodayRecord] = useState<SyncedTimeRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const getTodayString = () => {
    return new Date().toLocaleDateString('sv-SE');
  };

  const refreshData = useCallback(async () => {
    const dateStr = getTodayString();
    setToday(dateStr);

    try {
      setLoading(true);
      const record = await getTodayRecord(dateStr);
      setTodayRecord(record || null);
    } catch (error) {
      console.error('データ取得失敗:', error);
      setTodayRecord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!today) return;
    prefetchMonthlyRecords(today.slice(0, 7));
  }, [today]);

  const handleClockIn = async () => {
    try {
      setSubmitting(true);

      const todayStr = getTodayString();
      const now = format(new Date(), 'HH:mm');

      await sendToSheet({
        date: todayStr,
        startTime: now,
        endTime: '',
        breakDuration: 0,
        onBreak: false,
        breakStartTime: '',
      });

      await refreshData();
    } catch (error) {
      console.error('出勤の送信に失敗:', error);
      alert('出勤データの送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBreakStart = async () => {
    if (!todayRecord) return;

    try {
      setSubmitting(true);

      const todayStr = getTodayString();
      const now = format(new Date(), 'HH:mm');

      await sendToSheet({
        date: todayStr,
        startTime: todayRecord.startTime,
        endTime: todayRecord.endTime,
        breakDuration: todayRecord.breakDuration,
        onBreak: true,
        breakStartTime: now,
      });

      await refreshData();
    } catch (error) {
      console.error('休憩開始の送信に失敗:', error);
      alert('休憩開始データの送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBreakEnd = async () => {
    if (!todayRecord || !todayRecord.breakStartTime) return;

    try {
      setSubmitting(true);

      const todayStr = getTodayString();
      const now = format(new Date(), 'HH:mm');

      const [startH, startM] = todayRecord.breakStartTime.split(':').map(Number);
      const [endH, endM] = now.split(':').map(Number);

      let breakMinutes = endH * 60 + endM - (startH * 60 + startM);
      if (breakMinutes < 0) breakMinutes += 24 * 60;

      const nextBreakDuration = todayRecord.breakDuration + breakMinutes;

      await sendToSheet({
        date: todayStr,
        startTime: todayRecord.startTime,
        endTime: todayRecord.endTime,
        breakDuration: nextBreakDuration,
        onBreak: false,
        breakStartTime: '',
      });

      await refreshData();
    } catch (error) {
      console.error('休憩終了の送信に失敗:', error);
      alert('休憩終了データの送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    if (!todayRecord) return;

    try {
      setSubmitting(true);

      const todayStr = getTodayString();
      const now = format(new Date(), 'HH:mm');

      await sendToSheet({
        date: todayStr,
        startTime: todayRecord.startTime,
        endTime: now,
        breakDuration: todayRecord.breakDuration,
        onBreak: false,
        breakStartTime: '',
      });

      await refreshData();
    } catch (error) {
      console.error('退勤の送信に失敗:', error);
      alert('退勤データの送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateWorkingHours = () => {
    if (!todayRecord?.startTime || !todayRecord?.endTime) return '計算中...';

    const [startH, startM] = todayRecord.startTime.split(':').map(Number);
    const [endH, endM] = todayRecord.endTime.split(':').map(Number);

    let workingMinutes =
      endH * 60 + endM - (startH * 60 + startM) - todayRecord.breakDuration;

    if (workingMinutes < 0) workingMinutes += 24 * 60;

    const hours = Math.floor(workingMinutes / 60);
    const minutes = workingMinutes % 60;

    return `${hours}時間${minutes}分`;
  };

  const todayFormatted = today
    ? format(new Date(today + 'T00:00:00'), 'M月d日（EEEE）', { locale: ja })
    : '読み込み中...';

  const isWorking = !!todayRecord?.startTime && !todayRecord?.endTime;
  const onBreak = !!todayRecord?.onBreak;

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>本日の勤務状況</h1>
        <p className="date-display">{todayFormatted}</p>
      </div>

      <div className="status-card">
        <div className="status-info">
          <div className="status-item">
            <label>出勤時刻</label>
            <p className="status-value">
              {loading ? '読み込み中...' : todayRecord?.startTime || '未出勤'}
            </p>
          </div>
          <div className="status-item">
            <label>退勤時刻</label>
            <p className="status-value">
              {loading ? '読み込み中...' : todayRecord?.endTime || '未退勤'}
            </p>
          </div>
          <div className="status-item">
            <label>実働時間</label>
            <p className="status-value highlight">{calculateWorkingHours()}</p>
          </div>
        </div>
      </div>

      <div className="button-group">
        {!isWorking ? (
          <button
            className="btn btn-primary"
            onClick={handleClockIn}
            disabled={submitting || loading || !!todayRecord?.startTime}
          >
            {submitting ? '送信中...' : '出勤'}
          </button>
        ) : (
          <>
            {!onBreak ? (
              <button
                className="btn btn-secondary"
                onClick={handleBreakStart}
                disabled={submitting || loading}
              >
                {submitting ? '送信中...' : '休憩開始'}
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={handleBreakEnd}
                disabled={submitting || loading}
              >
                {submitting ? '送信中...' : '休憩終了'}
              </button>
            )}
            <button
              className="btn btn-danger"
              onClick={handleClockOut}
              disabled={submitting || loading || !!todayRecord?.endTime}
            >
              {submitting ? '送信中...' : '退勤'}
            </button>
          </>
        )}
      </div>

      {todayRecord && (
        <div className="recent-records">
          <h3>本日の打刻履歴</h3>
          <div className="record-item">
            <span>出勤: {todayRecord.startTime || '-'}</span>
            <span>退勤: {todayRecord.endTime || '-'}</span>
            <span>休憩: {todayRecord.breakDuration}分</span>
            {onBreak && (
              <span style={{ color: '#ff9800', fontWeight: 'bold' }}>
                （休憩中: {todayRecord.breakStartTime || '--:--'}開始）
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
