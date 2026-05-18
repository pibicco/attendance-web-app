import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { TimeRecord } from '../types';
import { getTodayRecord, sendToSheet } from '../utils/gas';
import '../styles/Home.css';

type TodayRecord = TimeRecord;

const getTodayString = () => new Date().toLocaleDateString('sv-SE');

export const Home: React.FC = () => {
  const [today, setToday] = useState(getTodayString);
  const [record, setRecord] = useState<TodayRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadToday = useCallback(async (forceRefresh = false) => {
    const dateStr = getTodayString();
    setToday(dateStr);
    setLoading(true);
    try {
      const data = await getTodayRecord(dateStr, {
        forceRefresh,
        useCache: !forceRefresh,
      });
      setRecord(data ?? null);
    } catch (error) {
      console.error('データ取得失敗:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const submit = async (next: TodayRecord, errorMessage: string) => {
    const previous = record;
    setRecord(next);
    setSubmitting(true);
    try {
      const saved = await sendToSheet({
        date: next.date,
        startTime: next.startTime ?? '',
        endTime: next.endTime ?? '',
        breakDuration: next.breakDuration,
        onBreak: next.onBreak,
        breakStartTime: next.breakStartTime ?? '',
      });
      setRecord(saved ?? next);
    } catch (error) {
      console.error(errorMessage, error);
      setRecord(previous);
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockIn = () => {
    const date = getTodayString();
    const now = format(new Date(), 'HH:mm');
    void submit(
      {
        date,
        startTime: now,
        endTime: null,
        breakDuration: 0,
        onBreak: false,
        breakStartTime: null,
      },
      '出勤の送信に失敗しました'
    );
  };

  const handleBreakStart = () => {
    if (!record) return;
    const now = format(new Date(), 'HH:mm');
    void submit(
      { ...record, onBreak: true, breakStartTime: now },
      '休憩開始の送信に失敗しました'
    );
  };

  const handleBreakEnd = () => {
    if (!record?.breakStartTime) return;
    const now = format(new Date(), 'HH:mm');
    const [startH, startM] = record.breakStartTime.split(':').map(Number);
    const [endH, endM] = now.split(':').map(Number);
    let breakMinutes = endH * 60 + endM - (startH * 60 + startM);
    if (breakMinutes < 0) breakMinutes += 24 * 60;
    void submit(
      {
        ...record,
        breakDuration: record.breakDuration + breakMinutes,
        onBreak: false,
        breakStartTime: null,
      },
      '休憩終了の送信に失敗しました'
    );
  };

  const handleClockOut = () => {
    if (!record) return;
    const now = format(new Date(), 'HH:mm');
    void submit(
      {
        ...record,
        endTime: now,
        onBreak: false,
        breakStartTime: null,
      },
      '退勤の送信に失敗しました'
    );
  };

  const todayLabel = format(new Date(today + 'T00:00:00'), 'M月d日（EEEE）', { locale: ja });
  const isWorking = !!record?.startTime && !record?.endTime;
  const onBreak = !!record?.onBreak;
  const busy = loading || submitting;

  return (
    <div className="home-container">
      <p className="date-display">{todayLabel}</p>

      <div className="status-row">
        <span>出勤 {loading ? '…' : record?.startTime || '—'}</span>
        <span>退勤 {loading ? '…' : record?.endTime || '—'}</span>
        {onBreak && <span className="on-break">休憩中</span>}
      </div>

      <div className="button-group">
        {!isWorking ? (
          <button
            className="btn btn-primary"
            onClick={handleClockIn}
            disabled={busy || !!record?.startTime}
          >
            {submitting ? '送信中…' : '出勤'}
          </button>
        ) : (
          <>
            {!onBreak ? (
              <button className="btn btn-secondary" onClick={handleBreakStart} disabled={busy}>
                {submitting ? '送信中…' : '休憩開始'}
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={handleBreakEnd} disabled={busy}>
                {submitting ? '送信中…' : '休憩終了'}
              </button>
            )}
            <button
              className="btn btn-danger"
              onClick={handleClockOut}
              disabled={busy || !!record?.endTime}
            >
              {submitting ? '送信中…' : '退勤'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
