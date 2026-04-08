import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { TimeRecord } from '../store/attendanceStore';
import { getTodayRecord, sendToSheet } from '../utils/gas';
import '../styles/Home.css';

export const Home: React.FC = () => {
  const [today, setToday] = useState<string>('');
  const [todayRecord, setTodayRecord] = useState<TimeRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const getTodayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  };

  const refreshData = async () => {
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
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleClockIn = async () => {
    try {
      setSubmitting(true);

      const now = format(new Date(), 'HH:mm');

      await sendToSheet({
        date: today,
        startTime: now,
        endTime: '',
        breakDuration: 0,
        onBreak: false,
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

      await sendToSheet({
        date: today,
        startTime: todayRecord.startTime,
        endTime: todayRecord.endTime,
        breakDuration: todayRecord.breakDuration,
        onBreak: true,
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
    if (!todayRecord) return;

    try {
      setSubmitting(true);

      const breakMinutes = 30;
      const nextBreakDuration = todayRecord.breakDuration + breakMinutes;

      await sendToSheet({
        date: today,
        startTime: todayRecord.startTime,
        endTime: todayRecord.endTime,
        breakDuration: nextBreakDuration,
        onBreak: false,
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

      const now = format(new Date(), 'HH:mm');

      await sendToSheet({
        date: today,
        startTime: todayRecord.startTime,
        endTime: now,
        breakDuration: todayRecord.breakDuration,
        onBreak: false,
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

    const workingMinutes =
      endH * 60 + endM - (startH * 60 + startM) - todayRecord.breakDuration;

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
              <span style={{ color: '#ff9800', fontWeight: 'bold' }}>（休憩中）</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
