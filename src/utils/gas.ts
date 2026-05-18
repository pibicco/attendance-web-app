import { calcWorkMinutes, normalizeTime } from './time';
import type { TimeRecord } from '../types';

const GAS_URL =
  import.meta.env.VITE_GAS_URL || 'https://flat-poetry-984a.ex24-kpp.workers.dev/';

type ApiRecord = {
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakDuration: number;
  onBreak: boolean;
  breakStartTime: string | null;
};

const normalizeRecord = (record: ApiRecord | null): TimeRecord | null => {
  if (!record) return null;

  return {
    ...record,
    startTime: normalizeTime(record.startTime),
    endTime: normalizeTime(record.endTime),
    breakStartTime: normalizeTime(record.breakStartTime),
    breakDuration: Number(record.breakDuration) || 0,
    onBreak: record.onBreak === true || String(record.onBreak).toUpperCase() === 'TRUE',
  };
};

const TODAY_REQUEST_TTL_MS = 60 * 1000;
const MONTHLY_SUMMARY_TTL_MS = 10 * 60 * 1000;
const SLOW_REQUEST_THRESHOLD_MS = 1000;
const TODAY_FETCH_TIMEOUT_MS = 3000;

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

type TodayRecordFetchOptions = {
  timeoutMs?: number;
  useCache?: boolean;
  forceRefresh?: boolean;
};

type MonthlySummaryFetchOptions = {
  useCache?: boolean;
  forceRefresh?: boolean;
};

const responseCache = new Map<string, CacheEntry<unknown>>();

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs?: number
) => {
  if (!timeoutMs) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`通信が ${timeoutMs}ms を超えたため中断しました`);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const parseJsonResponse = async <T>(res: Response): Promise<T> => {
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text || '通信失敗'}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`JSONじゃない返答: ${text}`);
  }
};

const cachedRequest = <T>(key: string, fetcher: () => Promise<T>, ttlMs: number) => {
  const now = Date.now();
  const cached = responseCache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetcher().catch((error) => {
    responseCache.delete(key);
    throw error;
  });

  responseCache.set(key, {
    expiresAt: now + ttlMs,
    promise,
  });

  return promise;
};

const setCachedValue = <T>(key: string, value: T, ttlMs: number) => {
  responseCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    promise: Promise.resolve(value),
  });
};

const invalidateCache = (keyPrefix: string) => {
  for (const key of responseCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      responseCache.delete(key);
    }
  }
};

const logRequestDuration = (label: string, startedAt: number) => {
  const duration = Math.round(performance.now() - startedAt);
  const message = `[api] ${label}: ${duration}ms`;

  if (duration >= SLOW_REQUEST_THRESHOLD_MS) {
    console.warn(`${message} (slow)`);
    return;
  }

  console.info(message);
};

const buildApiUrl = (params: Record<string, string>, forceRefresh = false) => {
  const url = new URL(GAS_URL);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  if (forceRefresh) {
    url.searchParams.set('_refresh', String(Date.now()));
  }

  return url;
};

const fetchTodayRecord = async (
  date: string,
  timeoutMs?: number,
  forceRefresh = false
) => {
  const startedAt = performance.now();
  const label = `GET today ${date}${forceRefresh ? ' fresh' : ''}`;

  try {
    const res = await fetchWithTimeout(
      buildApiUrl({ date }, forceRefresh),
      {
        method: 'GET',
        cache: 'no-store',
      },
      timeoutMs
    );

    const result = await parseJsonResponse<{
      success: boolean;
      error?: string;
      record: ApiRecord | null;
    }>(res);

    if (!result.success) {
      throw new Error(result.error || '取得失敗');
    }

    return normalizeRecord(result.record);
  } finally {
    logRequestDuration(label, startedAt);
  }
};

export const sendToSheet = async (data: {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  breakDuration?: number;
  onBreak?: boolean;
  breakStartTime?: string | null;
}): Promise<TimeRecord | null> => {
  const startedAt = performance.now();
  const label = `POST attendance ${data.date}`;

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await parseJsonResponse<{
      success: boolean;
      error?: string;
      record?: ApiRecord | null;
    }>(res);

    if (!result.success) {
      throw new Error(result.error || '送信失敗');
    }

    const record = normalizeRecord(result.record ?? null);
    const month = data.date.slice(0, 7);

    if (record) {
      setCachedValue(`today:${data.date}`, record, TODAY_REQUEST_TTL_MS);
    } else {
      invalidateCache(`today:${data.date}`);
    }
    invalidateCache(`month-summary:${month}`);

    return record;
  } finally {
    logRequestDuration(label, startedAt);
  }
};

export const getTodayRecord = async (
  date: string,
  options: TodayRecordFetchOptions = {}
) => {
  const {
    timeoutMs = TODAY_FETCH_TIMEOUT_MS,
    useCache = true,
    forceRefresh = false,
  } = options;

  if (!useCache || forceRefresh) {
    invalidateCache(`today:${date}`);
    return fetchTodayRecord(date, timeoutMs, forceRefresh);
  }

  return cachedRequest(
    `today:${date}`,
    async () => fetchTodayRecord(date, timeoutMs),
    TODAY_REQUEST_TTL_MS
  );
};

const fetchMonthlySummary = async (month: string, forceRefresh = false) => {
  const startedAt = performance.now();
  const label = `GET monthly-summary ${month}${forceRefresh ? ' fresh' : ''}`;

  try {
    const res = await fetch(buildApiUrl({ month, summary: '1' }, forceRefresh), {
      method: 'GET',
      cache: 'no-store',
    });

    const result = await parseJsonResponse<{
      success: boolean;
      error?: string;
      totalMinutes?: number;
      records?: ApiRecord[];
    }>(res);

    if (!result.success) {
      throw new Error(result.error || '月間合計の取得失敗');
    }

    if (typeof result.totalMinutes === 'number') {
      return result.totalMinutes;
    }

    // 旧API（全行返却）へのフォールバック
    if (result.records) {
      let total = 0;
      for (const row of result.records) {
        const record = normalizeRecord(row);
        if (!record) continue;
        const minutes = calcWorkMinutes(
          record.startTime,
          record.endTime,
          record.breakDuration
        );
        if (minutes != null) total += minutes;
      }
      return total;
    }

    return 0;
  } finally {
    logRequestDuration(label, startedAt);
  }
};

export const getMonthlySummary = async (
  month: string,
  options: MonthlySummaryFetchOptions = {}
) => {
  const { useCache = true, forceRefresh = false } = options;

  if (!useCache || forceRefresh) {
    invalidateCache(`month-summary:${month}`);
    return fetchMonthlySummary(month, forceRefresh);
  }

  return cachedRequest(
    `month-summary:${month}`,
    async () => fetchMonthlySummary(month),
    MONTHLY_SUMMARY_TTL_MS
  );
};
