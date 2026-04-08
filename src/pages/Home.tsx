import { useState, useEffect } from 'react';
import { useAttendanceStore, type TimeRecord } from '../store/attendanceStore';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { sendToSheet } from '../utils/gas';
import '../styles/Home.css';

export const Home: React.FC = () => {
  const { addRecord, getRecordByDate } = useAttendanceStore();
  const [today, setToday] = useState<string>('');
  const [todayRecord, setTodayRecord] = useState<TimeRecord | null>(null);

  const refreshData = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setToday(dateStr);
    const record = getRecordByDate(dateStr);
    setTodayRecord(record || null);
  };

  useEffect(() => {
    refreshData();
  }, [getRecordByDate]);

  const handleClockIn = async () => {
    try {
      const now = format(new Date(), 'HH:mm');

      const record: TimeRecord = {
        date: today,
        startTime: now,
        endTime: null,
        breakDuration: 0,
        onBreak: false,
      };

      addRecord(record);

      await sendToSheet({
        date: today,
        type: '出勤',
        startTime: now,
        endTime: '',
        breakDuration: 0,
      });

      refreshData();
    } catch (error) {
      console.error('出勤の送信に失敗:', error);
      alert('出勤データの送信に失敗しました');
    }
  };

  const handleBreakStart = () => {
    if (todayRecord) {
      addRecord({ ...todayRecord, onBreak: true });
      refreshData();
    }
  };

  const handleBreakEnd = () => {
    if (todayRecord) {
      const breakMinutes = 30;
      addRecord({
        ...todayRecord,
        breakDuration: todayRecord.breakDuration + breakMinutes,
        onBreak: false,
      });
      refreshData();
    }
  };

  const handleClockOut = async () => {
    if (todayRecord) {
      try {
        const now = format(new Date(), 'HH:mm');

        const updatedRecord = {
          ...todayRecord,
          endTime: now,
          onBreak: false,
        };

        addRecord(updatedRecord);

        await sendToSheet({
          date: today,
          type: '退勤',
          startTime: todayRecord.startTime,
          endTime: now,
          breakDuration: todayRecord.breakDuration,
        });

        refreshData();
      } catch (error) {
        console.error('退勤の送信に失敗:', error);
        alert('退勤データの送信に失敗しました');
      }
    }
  };

  const calculateWorkingHours = () => {
    if (!todayRecord?.startTime || !todayRecord?.endTime) return '計算中...';
    const [startH, startM] = todayRecord.startTime.split(':').map(Number);
    const [endH, endM] = todayRecord.endTime.split(':').map(Number);
    const workingMinutes =
      (endH * 60 + endM) - (startH * 60 + startM) - todayRecord.breakDuration;
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
            <p className="status-value">{todayRecord?.startTime || '未出勤'}</p>
          </div>
          <div className="status-item">
            <label>退勤時刻</label>
            <p className="status-value">{todayRecord?.endTime || '未退勤'}</p>
          </div>
          <div className="status-item">
            <label>実働時間</label>
            <p className="status-value highlight">{calculateWorkingHours()}</p>
          </div>
        </div>
      </div>

      <div className="button-group">
        {!isWorking ? (
          <button className="btn btn-primary" onClick={handleClockIn} disabled={!!todayRecord?.endTime}>
            出勤
          </button>
        ) : (
          <>
            {!onBreak ? (
              <button className="btn btn-secondary" onClick={handleBreakStart}>
                休憩開始
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={handleBreakEnd}>
                休憩終了
              </button>
            )}
            <button className="btn btn-danger" onClick={handleClockOut}>
              退勤
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
