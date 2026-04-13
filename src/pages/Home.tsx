import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { TimeRecord } from '../store/attendanceStore';
import { getTodayRecord, sendToSheet } from '../utils/gas';
import '../styles/Home.css';

type SyncedTimeRecord = TimeRecord & {
  breakStartTime?: string | null;
};

const TODAY_CACHE_STORAGE_KEY = 'attendance:today-record-cache';

type StoredTodayRecord = {
  date: string;
  record: SyncedTimeRecord | null;
};

type StartupMetrics = {
  cacheReadyMs: number | null;
  latestSyncMs: number | null;
  cacheHit: boolean;
};

type SyncState = 'idle' | 'syncing' | 'success' | 'stale' | 'error';

const getTodayString = () => new Date().toLocaleDateString('sv-SE');

const readStoredTodayRecord = (date: string) => {
  try {
    const raw = window.localStorage.getItem(TODAY_CACHE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredTodayRecord;
    if (parsed.date !== date) return null;

    return parsed.record;
  } catch (error) {
    console.warn('ローカルキャッシュの読み込みに失敗:', error);
    return null;
  }
};

const writeStoredTodayRecord = (date: string, record: SyncedTimeRecord | null) => {
  try {
    const payload: StoredTodayRecord = { date, record };
    window.localStorage.setItem(TODAY_CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('ローカルキャッシュの保存に失敗:', error);
  }
};

export const Home: React.FC = () => {
  const [initialState] = useState(() => {
    const today = getTodayString();
    return {
      today,
      record: readStoredTodayRecord(today),
    };
  });
  const mountStartedAtRef = useRef(performance.now());

  const [today, setToday] = useState<string>(initialState.today);
  const [todayRecord, setTodayRecord] = useState<SyncedTimeRecord | null>(initialState.record);
  const [loading, setLoading] = useState<boolean>(!initialState.record);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [startupMetrics, setStartupMetrics] = useState<StartupMetrics>({
    cacheReadyMs: null,
    latestSyncMs: null,
    cacheHit: !!initialState.record,
  });

  const refreshData = useCallback(async () => {
    const refreshStartedAt = performance.now();
    const dateStr = getTodayString();
    setToday(dateStr);
    const cachedRecord = readStoredTodayRecord(dateStr);
    setSyncState('syncing');
    setSyncMessage(cachedRecord ? '保存済みデータを表示しながら同期中です' : '最新データを取得中です');

    if (cachedRecord) {
      setTodayRecord(cachedRecord);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const record = await getTodayRecord(dateStr);
      const nextRecord = record || null;
      setTodayRecord(nextRecord);
      writeStoredTodayRecord(dateStr, nextRecord);
      const latestSyncMs = Math.round(performance.now() - refreshStartedAt);
      setStartupMetrics((prev) => ({
        ...prev,
        latestSyncMs,
        cacheHit: !!cachedRecord,
      }));
      setSyncState('success');
      setSyncMessage(`最新データに同期しました (${latestSyncMs}ms)`);
      console.info(`[startup] latest sync: ${latestSyncMs}ms`);
    } catch (error) {
      console.error('データ取得失敗:', error);
      const message = error instanceof Error ? error.message : '同期に失敗しました';
      if (!cachedRecord) {
        setTodayRecord(null);
        setSyncState('error');
        setSyncMessage(message);
      } else {
        setSyncState('stale');
        setSyncMessage(`最新同期は保留中です: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cacheReadyMs = Math.round(performance.now() - mountStartedAtRef.current);
    setStartupMetrics((prev) => ({
      ...prev,
      cacheReadyMs,
      cacheHit: !!initialState.record,
    }));
    console.info(
      `[startup] initial paint: ${cacheReadyMs}ms (${initialState.record ? 'cache hit' : 'cache miss'})`
    );
  }, [initialState.record]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

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
        {syncState !== 'idle' && (
          <p className={`sync-status sync-status-${syncState}`}>{syncMessage}</p>
        )}
        {import.meta.env.DEV && (
          <p className="startup-metrics">
            初回表示 {startupMetrics.cacheReadyMs ?? '--'}ms
            {' / '}
            最新同期 {startupMetrics.latestSyncMs ?? '--'}ms
            {' / '}
            {startupMetrics.cacheHit ? 'cache hit' : 'cache miss'}
          </p>
        )}
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
