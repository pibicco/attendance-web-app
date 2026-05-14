import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { TimeRecord } from '../store/attendanceStore';
import { getMonthlyRecords, getTodayRecord, sendToSheet } from '../utils/gas';
import '../styles/Home.css';

type SyncedTimeRecord = TimeRecord & {
  breakStartTime?: string | null;
};

type AttendancePayload = Parameters<typeof sendToSheet>[0];

type StartupMetrics = {
  cacheReadyMs: number | null;
  latestSyncMs: number | null;
  cacheHit: boolean;
};

type SyncState = 'idle' | 'syncing' | 'success' | 'stale' | 'error';

const getTodayString = () => new Date().toLocaleDateString('sv-SE');

const recordFetchOpts = (forceRefresh: boolean) => ({
  forceRefresh,
  useCache: !forceRefresh,
});

/** 月次を優先（タイムアウト後の再試行などで使用） */
const fetchSyncedTodayRecordLegacy = async (dateStr: string, forceRefresh: boolean) => {
  const opts = recordFetchOpts(forceRefresh);
  const monthlyRecords = await getMonthlyRecords(dateStr.slice(0, 7), opts);
  const monthlyRecord = monthlyRecords.find((record) => record.date === dateStr);

  if (monthlyRecord) {
    return monthlyRecord;
  }

  return getTodayRecord(dateStr, opts);
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

  const applyLocalRecord = useCallback((record: SyncedTimeRecord | null) => {
    todayRecordRef.current = record;
    setTodayRecord(record);
    setLoading(false);

    if (record?.date) {
      setToday(record.date);
    }
  }, []);

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
      const opts = recordFetchOpts(forceRefresh);

      try {
        const fromToday = await getTodayRecord(dateStr, opts);
        if (refreshRequestIdRef.current !== requestId) return;

        if (fromToday) {
          const fastMs = Math.round(performance.now() - refreshStartedAt);
          applySyncedRecord(fromToday, fastMs, !!cachedRecord && !forceRefresh);
          if (refreshRequestIdRef.current === requestId) {
            setLoading(false);
          }
        }

        let monthlyRecord: SyncedTimeRecord | undefined;
        try {
          const monthlyRecords = await getMonthlyRecords(dateStr.slice(0, 7), opts);
          if (refreshRequestIdRef.current !== requestId) return;
          monthlyRecord = monthlyRecords.find((r) => r.date === dateStr);
        } catch (monthlyErr) {
          console.warn('月次データの取得をスキップ:', monthlyErr);
        }

        if (!fromToday) {
          const resolved = monthlyRecord ?? null;
          const ms = Math.round(performance.now() - refreshStartedAt);
          if (refreshRequestIdRef.current !== requestId) return;
          applySyncedRecord(resolved, ms, !!cachedRecord && !forceRefresh);
        } else if (monthlyRecord) {
          const ms = Math.round(performance.now() - refreshStartedAt);
          if (refreshRequestIdRef.current !== requestId) return;
          applySyncedRecord(monthlyRecord, ms, !!cachedRecord && !forceRefresh);
        }
      } catch (innerError) {
        if (refreshRequestIdRef.current !== requestId) return;

        console.warn('今日の行の取得に失敗、月次優先で再試行:', innerError);
        const record = await fetchSyncedTodayRecordLegacy(dateStr, forceRefresh);
        if (refreshRequestIdRef.current !== requestId) return;

        const latestSyncMs = Math.round(performance.now() - refreshStartedAt);
        applySyncedRecord(record ?? null, latestSyncMs, !!cachedRecord && !forceRefresh);
      }
    } catch (error) {
      console.error('データ取得失敗:', error);
      const message = error instanceof Error ? error.message : '同期に失敗しました';
      if (refreshRequestIdRef.current !== requestId) return;

      if (message.includes('3000ms')) {
        setLoading(false);
        setSyncState(cachedRecord ? 'stale' : 'syncing');

        void fetchSyncedTodayRecordLegacy(dateStr, forceRefresh)
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

  const submitOptimisticRecord = useCallback(
    async (nextRecord: SyncedTimeRecord, errorMessage: string) => {
      const previousRecord = todayRecordRef.current;
      const nextPayload: AttendancePayload = {
        date: nextRecord.date,
        startTime: nextRecord.startTime ?? '',
        endTime: nextRecord.endTime ?? '',
        breakDuration: nextRecord.breakDuration,
        onBreak: nextRecord.onBreak,
        breakStartTime: nextRecord.breakStartTime ?? '',
      };

      refreshRequestIdRef.current += 1;
      applyLocalRecord(nextRecord);
      setSyncState('syncing');
      setSubmitting(true);

      try {
        await sendToSheet(nextPayload);
        setSubmitting(false);
        void refreshData(true);
      } catch (error) {
        console.error(errorMessage, error);
        refreshRequestIdRef.current += 1;
        applyLocalRecord(previousRecord);
        setSyncState(previousRecord ? 'stale' : 'error');
        alert(errorMessage);
        setSubmitting(false);
      }
    },
    [applyLocalRecord, refreshData]
  );

  const handleClockIn = async () => {
    const todayStr = getTodayString();
    const now = format(new Date(), 'HH:mm');

    await submitOptimisticRecord(
      {
        date: todayStr,
        startTime: now,
        endTime: null,
        breakDuration: 0,
        onBreak: false,
        breakStartTime: null,
      },
      '出勤データの送信に失敗しました'
    );
  };

  const handleBreakStart = async () => {
    if (!todayRecord) return;

    const todayStr = getTodayString();
    const now = format(new Date(), 'HH:mm');

    await submitOptimisticRecord(
      {
        ...todayRecord,
        date: todayStr,
        onBreak: true,
        breakStartTime: now,
      },
      '休憩開始データの送信に失敗しました'
    );
  };

  const handleBreakEnd = async () => {
    if (!todayRecord || !todayRecord.breakStartTime) return;

    const todayStr = getTodayString();
    const now = format(new Date(), 'HH:mm');

    const [startH, startM] = todayRecord.breakStartTime.split(':').map(Number);
    const [endH, endM] = now.split(':').map(Number);

    let breakMinutes = endH * 60 + endM - (startH * 60 + startM);
    if (breakMinutes < 0) breakMinutes += 24 * 60;

    await submitOptimisticRecord(
      {
        ...todayRecord,
        date: todayStr,
        breakDuration: todayRecord.breakDuration + breakMinutes,
        onBreak: false,
        breakStartTime: null,
      },
      '休憩終了データの送信に失敗しました'
    );
  };

  const handleClockOut = async () => {
    if (!todayRecord) return;

    const todayStr = getTodayString();
    const now = format(new Date(), 'HH:mm');

    await submitOptimisticRecord(
      {
        ...todayRecord,
        date: todayStr,
        endTime: now,
        onBreak: false,
        breakStartTime: null,
      },
      '退勤データの送信に失敗しました'
    );
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
