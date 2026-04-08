// Google Sheets API 連携ユーティリティ
const CLIENT_ID = '863837242674-t9hhg00tdtr4vgatald1goej7tt1d70f.apps.googleusercontent.com';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let tokenClient: any = null;
let accessToken: string | null = null;

// Google API クライアントライブラリを動的にロード
export const loadGoogleAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        resolve();
      } else {
        reject(new Error('Google API failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Google API'));
    document.head.appendChild(script);
  });
};

// Google OAuth トークンを取得
export const getGoogleToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (accessToken) {
      resolve(accessToken);
      return;
    }

    if (!window.google) {
      reject(new Error('Google API not loaded'));
      return;
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES.join(' '),
      callback: (response: any) => {
        if (response.access_token) {
          accessToken = response.access_token;
          resolve(response.access_token);
        } else {
          reject(new Error('Failed to get access token'));
        }
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

// スプレッドシートにデータを追加
export const appendToGoogleSheet = async (
  spreadsheetId: string,
  values: (string | number | null)[][]
): Promise<void> => {
  try {
    const token = await getGoogleToken();

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:E:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: values,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to append to sheet: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error appending to Google Sheet:', error);
    throw error;
  }
};

// ローカルストレージにトークンを保存
export const saveGoogleToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('google_access_token', token);
  }
  accessToken = token;
};

// ローカルストレージからトークンを取得
export const loadGoogleToken = (): string | null => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('google_access_token');
    if (token) {
      accessToken = token;
    }
    return token;
  }
  return null;
};

// トークンをクリア
export const clearGoogleToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('google_access_token');
  }
  accessToken = null;
};

// Google ウィンドウ型定義を追加
declare global {
  interface Window {
    google: any;
  }
}
