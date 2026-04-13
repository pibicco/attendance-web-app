const GAS_URL =
  'https://flat-poetry-984a.ex24-kpp.workers.dev/';

const TODAY_REQUEST_TTL_MS = 60 * 1000;
const MONTHLY_REQUEST_TTL_MS = 10 * 60 * 1000;
const SLOW_REQUEST_THRESHOLD_MS = 1000;
const TODAY_FETCH_TIMEOUT_MS = 3000;

type ApiRecord = {
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakDuration: number;
  onBreak: boolean;
  breakStartTime: string | null;
};

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

type TodayRecordFetchOptions = {
  timeoutMs?: number;
  useCache?: boolean;
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

const fetchTodayRecord = async (date: string, timeoutMs?: number) => {
  const startedAt = performance.now();
  const label = `GET today ${date}`;

  try {
    const res = await fetchWithTimeout(
      `${GAS_URL}?date=${encodeURIComponent(date)}`,
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

    return result.record;
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
}) => {
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

    const result = await parseJsonResponse<{ success: boolean; error?: string }>(res);

    if (!result.success) {
      throw new Error(result.error || '送信失敗');
    }

    invalidateCache('today:');
    invalidateCache(`today:${data.date}`);
    invalidateCache('month:');
    invalidateCache(`month:${data.date.slice(0, 7)}`);

    return result;
  } finally {
    logRequestDuration(label, startedAt);
  }
};

export const getTodayRecord = async (
  date: string,
  options: TodayRecordFetchOptions = {}
) => {
  const { timeoutMs = TODAY_FETCH_TIMEOUT_MS, useCache = true } = options;

  if (!useCache) {
    return fetchTodayRecord(date, timeoutMs);
  }

  return cachedRequest(
    `today:${date}`,
    async () => fetchTodayRecord(date, timeoutMs),
    TODAY_REQUEST_TTL_MS
  );
};

export const getMonthlyRecords = async (month: string) => {
  return cachedRequest(`month:${month}`, async () => {
    const startedAt = performance.now();
    const label = `GET monthly ${month}`;

    try {
      const res = await fetch(`${GAS_URL}?month=${encodeURIComponent(month)}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const result = await parseJsonResponse<{
        success: boolean;
        error?: string;
        records: ApiRecord[];
      }>(res);

      if (!result.success) {
        throw new Error(result.error || '月間取得失敗');
      }

      return result.records;
    } finally {
      logRequestDuration(label, startedAt);
    }
  }, MONTHLY_REQUEST_TTL_MS);
};

export const prefetchTodayRecord = async (date: string) => {
  try {
    await getTodayRecord(date);
  } catch (error) {
    console.warn('[api] prefetch today failed', error);
  }
};

export const prefetchMonthlyRecords = async (month: string) => {
  try {
    await getMonthlyRecords(month);
  } catch (error) {
    console.warn('[api] prefetch monthly failed', error);
  }
};
