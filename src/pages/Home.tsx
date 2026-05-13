import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { TimeRecord } from '../store/attendanceStore';
import { getMonthlyRecords, getTodayRecord, sendToSheet } from '../utils/gas';
import '../styles/Home.css';

type SyncedTimeRecord = TimeRecord & {
  breakStartTime?: string | null;
};

type StartupMetrics = {
  cacheReadyMs: number | null;
  latestSyncMs: number | null;
  cacheHit: boolean;
};

type SyncState = 'idle' | 'syncing' | 'success' | 'stale' | 'error';

const getTodayString = () => new Date().toLocaleDateString('sv-SE');

const fetchSyncedTodayRecord = async (date: string, forceRefresh = false) => {
  const monthlyRecords = await getMonthlyRecords(date.slice(0, 7), {
    forceRefresh,
    useCache: !forceRefresh,
  });
  const monthlyRecord = monthlyRecords.find((record) => record.date === date);

  if (monthlyRecord) {
    return monthlyRecord;
  }

  return getTodayRecord(date, {
    forceRefresh,
    useCache: !forceRefresh,
  });
};

export const Home: React.FC = () => {
  const [initialState] = useState(() => {
    const today = getTodayString();
    return {
      today,
      record: null,
    };
  });
  const mountStartedAtRef = useRef(performance.now());

  const [today, setToday] = useState<string>(initialState.today);
  const [todayRecord, setTodayRecord] = useState<SyncedTimeRecord | null>(initialState.record);
  const [loading, setLoading] = useState<boolean>(!initialState.record);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [startupMetrics, setStartupMetrics] = useState<StartupMetrics>({
    cacheReadyMs: null,
    latestSyncMs: null,
    cacheHit: !!initialState.record,
  });
  const refreshRequestIdRef = useRef(0);
  const todayRecordRef = useRef<SyncedTimeRecord | null>(initialState.record);

  const applySyncedRecord = useCallback(
    (record: SyncedTimeRecord | null, elapsedMs: number, cacheHit: boolean) => {
      todayRecordRef.current = record;
      setTodayRecord(record);
      setStartupMetrics((prev) => ({
        ...prev,
        latestSyncMs: elapsedMs,
        cacheHit,
      }));
      setSyncState('success');
      console.info(`[startup] latest sync: ${elapsedMs}ms`);
    },
    []
  );

  const refreshData = useCallback(async (forceRefresh = false) => {
    const refreshStartedAt = performance.now();
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;
    const dateStr = getTodayString();
    setToday(dateStr);
    const cachedRecord = todayRecordRef.current;
    setSyncState('syncing');

    if (!forceRefresh && cachedRecord) {
      setTodayRecord(cachedRecord);
      setLoading(false);
    } else {
      setLoading(!cachedRecord);
    }

    try {
      const record = await fetchSyncedTodayRecord(dateStr, forceRefresh);
      if (refreshRequestIdRef.current !== requestId) return;

      const nextRecord = record || null;
      const latestSyncMs = Math.round(performance.now() - refreshStartedAt);
      applySyncedRecord(nextRecord, latestSyncMs, !!cachedRecord && !forceRefresh);
    } catch (error) {
      console.error('データ取得失敗:', error);
      const message = error instanceof Error ? error.message : '同期に失敗しました';
      if (refreshRequestIdRef.current !== requestId) return;

      if (message.includes('3000ms')) {
        setLoading(false);
        setSyncState(cachedRecord ? 'stale' : 'syncing');

        void fetchSyncedTodayRecord(dateStr, forceRefresh)
          .then((record) => {
            if (refreshRequestIdRef.current !== requestId) return;

            const nextRecord = record || null;
            const latestSyncMs = Math.round(performance.now() - refreshStartedAt);
            applySyncedRecord(nextRecord, latestSyncMs, !!cachedRecord);
          })
          .catch((backgroundError) => {
            if (refreshRequestIdRef.current !== requestId) return;

            console.error('バックグラウンド再取得失敗:', backgroundError);

            if (!cachedRecord) {
              setTodayRecord(null);
              setSyncState('error');
            } else {
              setSyncState('stale');
            }
          });
      } else if (!cachedRecord) {
        setTodayRecord(null);
        setSyncState('error');
      } else {
        setSyncState('stale');
      }
    } finally {
      if (refreshRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [applySyncedRecord]);

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

  const handleManualRefresh = () => {
    void refreshData(true);
  };

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

      await refreshData(true);
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

      await refreshData(true);
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

      await refreshData(true);
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

      await refreshData(true);
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
        <button
          className="refresh-button"
          onClick={handleManualRefresh}
          disabled={loading || submitting || syncState === 'syncing'}
        >
          最新に更新
        </button>
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
