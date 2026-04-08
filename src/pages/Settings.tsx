import React, { useState, useEffect } from 'react';
import { useAttendanceStore } from '../store/attendanceStore';
import '../styles/Settings.css';

const SPREADSHEET_ID = '1QajsUci9L_a4HABS5c4qZ6Mu0-9zoBV9I8zxqGYllhk';
const CLIENT_ID = '863837242674-t9hhg00tdtr4vgatald1goej7tt1d70f.apps.googleusercontent.com';
// GitHub Pages デプロイ URL
const REDIRECT_URI = 'https://pibicco.github.io/attendance-web-app/';
// ローカル開発用フォールバック
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const ACTUAL_REDIRECT_URI = isDevelopment ? window.location.origin + window.location.pathname : REDIRECT_URI;

export const Settings: React.FC = () => {
  const { records, leaveRequests } = useAttendanceStore();
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notificationTime, setNotificationTime] = useState('18:00');
  const [authStatus, setAuthStatus] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // OAuth コールバック URL からアクセストークンを抽出
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const error = params.get('error');

    if (error) {
      setAuthStatus(`認証エラー: ${error}`);
      console.error('OAuth error:', error, params.get('error_description'));
    } else if (token) {
      localStorage.setItem('google_access_token', token);
      setAuthStatus('認証成功！');
      setIsAuthenticated(true);
      // URL からハッシュを削除
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setAuthStatus(''), 3000);
    } else if (localStorage.getItem('google_access_token')) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleExportToCSV = () => {
    const csvHeader = '日付,出勤時刻,退勤時刻,休憩時間,実働時間\n';
    const csvRows = records
      .map((record) => {
        const workingHours = record.startTime && record.endTime
          ? calculateWorkingHours(record.startTime, record.endTime, record.breakDuration)
          : '';
        return `${record.date},${record.startTime || ''},${record.endTime || ''},${record.breakDuration},${workingHours}`;
      })
      .join('\n');

    const csv = csvHeader + csvRows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alert('CSVファイルをダウンロードしました\n\nGoogleスプレッドシートで「ファイルを開く。インポート」を使用して貼り付けてください');
  };

  const handleGoogleAuth = () => {
    const scope = 'https://www.googleapis.com/auth/spreadsheets';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(ACTUAL_REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
  };

  const handleExportToSheets = async () => {
    const token = localStorage.getItem('google_access_token');
    if (!token) {
      alert('Google認証が必要です。先に「Google認証」ボタンをクリックしてください。');
      return;
    }

    try {
      const values = [
        ['日付', '出勤時刻', '退勤時刻', '休憩時間', '実働時間'],
        ...records.map((record) => {
          const workingHours = record.startTime && record.endTime
            ? calculateWorkingHours(record.startTime, record.endTime, record.breakDuration)
            : '';
          return [
            record.date,
            record.startTime || '',
            record.endTime || '',
            record.breakDuration,
            workingHours,
          ];
        }),
      ];

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values }),
        }
      );

      if (response.ok) {
        alert('スプレッドシートにデータを記録しました！');
      } else {
        const errorData = await response.json();
        console.error('Sheets API error:', errorData);
        alert('スプレッドシートへの記録に失敗しました。もう一度お試しください。');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('エラーが発生しました。');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('google_access_token');
    setIsAuthenticated(false);
    setAuthStatus('ログアウトしました');
    setTimeout(() => setAuthStatus(''), 2000);
  };

  const handleClearData = () => {
    if (confirm('すべてのデータを削除してもよろしいですか？')) {
      localStorage.removeItem('attendance-storage');
      alert('データを削除しました。ページを再読み込みしてください');
    }
  };

  const handleExportJSON = () => {
    const data = {
      records,
      leaveRequests,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>設定</h1>
      </div>

      {authStatus && (
        <div className={`auth-status ${authStatus.includes('エラー') ? 'error' : 'success'}`}>
          {authStatus}
        </div>
      )}

      <div className="settings-section">
        <h2>Googleスプレッドシート連携</h2>
        <p className="help-text">
          Googleアカウントで認証して、勤務記録を直接スプレッドシートに記録できます。
        </p>
        {!isAuthenticated ? (
          <button className="btn btn-primary" onClick={handleGoogleAuth}>
            Google認証
          </button>
        ) : (
          <>
            <div className="auth-info">✓ Google認証済み</div>
            <button className="btn btn-primary" onClick={handleExportToSheets}>
              スプレッドシートにエクスポート
            </button>
            <button className="btn btn-secondary" onClick={handleLogout}>
              ログアウト
            </button>
          </>
        )}
        <p className="help-text">
          または、CSVファイルをダウンロードして手動で貼り付けることもできます。
        </p>
        <button className="btn btn-secondary" onClick={handleExportToCSV}>
          CSVファイルをダウンロード
        </button>
      </div>

      <div className="settings-section">
        <h2>通知設定</h2>
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notificationEnabled}
              onChange={(e) => setNotificationEnabled(e.target.checked)}
            />
            退勤リマインダーを有効にする
          </label>
        </div>
        {notificationEnabled && (
          <div className="form-group">
            <label htmlFor="notificationTime">リマインダー時刻</label>
            <input
              type="time"
              id="notificationTime"
              value={notificationTime}
              onChange={(e) => setNotificationTime(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="settings-section">
        <h2>データ管理</h2>
        <div className="data-stats">
          <div className="stat-item">
            <span>勤務記録数</span>
            <span className="stat-value">{records.length}</span>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={handleExportJSON}>
          データをダウンロード（JSON）
        </button>
        <button className="btn btn-danger" onClick={handleClearData}>
          すべてのデータを削除
        </button>
      </div>

      <div className="settings-section">
        <h2>アプリについて</h2>
        <div className="about-info">
          <p>
            <strong>勤怠管理アプリ</strong>
          </p>
          <p>バージョン: 1.0.0</p>
          <p>
            このアプリはあなたの勤務時間を管理するために設計されています。
            すべてのデータはあなたのブラウザに保存されます。
          </p>
        </div>
      </div>
    </div>
  );
};

function format(date: Date, pattern: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return pattern.replace('yyyy', String(year)).replace('MM', month).replace('dd', day);
}

function calculateWorkingHours(startTime: string, endTime: string, breakDuration: number): string {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const workingMinutes = (endH * 60 + endM) - (startH * 60 + startM) - breakDuration;
  const hours = Math.floor(workingMinutes / 60);
  const minutes = workingMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}
