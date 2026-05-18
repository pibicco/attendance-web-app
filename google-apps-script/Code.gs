/**
 * 勤怠管理アプリ — Google Apps Script
 *
 * 対象スプレッドシート:
 * https://docs.google.com/spreadsheets/d/1QajsUci9L_a4HABS5c4qZ6Mu0-9zoBV9I8zxqGYllhk
 *
 * デプロイ: デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 * - 実行ユーザー: 自分
 * - アクセス: 全員
 * 発行された URL を .env の VITE_GAS_URL に設定
 */

const SPREADSHEET_ID = '1QajsUci9L_a4HABS5c4qZ6Mu0-9zoBV9I8zxqGYllhk';

const HEADERS = ['日付', '出勤', '退勤', '休憩分', '勤務時間', '休憩中', '休憩開始'];

function doGet(e) {
  return withCors(handleGet_(e));
}

function doPost(e) {
  return withCors(handlePost_(e));
}

function doOptions() {
  return withCors(ContentService.createTextOutput(''));
}

function withCors(output) {
  if (output && typeof output.setMimeType === 'function') {
    return output;
  }
  return output;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function handleGet_(e) {
  const params = e && e.parameter ? e.parameter : {};

  try {
    if (params.date) {
      const record = getRecordByDate_(params.date);
      return jsonResponse({ success: true, record });
    }

    if (params.month) {
      if (params.summary === '1' || params.summary === 'true') {
        const totalMinutes = getMonthTotalMinutes_(params.month);
        return jsonResponse({ success: true, totalMinutes });
      }
      const records = getRecordsByMonth_(params.month);
      return jsonResponse({ success: true, records });
    }

    return jsonResponse({ success: false, error: 'date または month パラメータが必要です' });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  }
}

function handlePost_(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const record = upsertRecord_(body);
    return jsonResponse({ success: true, record });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  }
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateMonthSheet_(month) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(month);

  if (!sheet) {
    sheet = ss.insertSheet(month);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange('E2:E').setFormula(
      '=ARRAYFORMULA(IF(ROW(A2:A)=0,"",IF(A2:A="","",IF(AND(B2:B<>"",C2:C<>""),TEXT(MAX(0,(C2:C-B2:B)*24*60-D2:D)/1440),"[h]:mm"),""))))'
    );
  }

  return sheet;
}

function formatDateCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}

function formatTimeCell_(value) {
  if (value === 0 || value === '0' || value === '' || value === null) return null;
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  const text = String(value).trim();
  if (!text || text === '0') return null;
  return text;
}

function rowToRecord_(row) {
  const date = formatDateCell_(row[0]);
  if (!date) return null;

  return {
    date,
    startTime: formatTimeCell_(row[1]),
    endTime: formatTimeCell_(row[2]),
    breakDuration: Number(row[3]) || 0,
    onBreak: row[5] === true || String(row[5]).toUpperCase() === 'TRUE',
    breakStartTime: formatTimeCell_(row[6]),
  };
}

function findRowIndexByDate_(sheet, dateStr) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < dates.length; i++) {
    if (formatDateCell_(dates[i][0]) === dateStr) {
      return i + 2;
    }
  }
  return -1;
}

function getRecordByDate_(dateStr) {
  const month = dateStr.slice(0, 7);
  const sheet = getSpreadsheet_().getSheetByName(month);
  if (!sheet) return null;

  const rowIndex = findRowIndexByDate_(sheet, dateStr);
  if (rowIndex < 0) return null;

  const row = sheet.getRange(rowIndex, 1, 1, 7).getValues()[0];
  return rowToRecord_(row);
}

function getRecordsByMonth_(month) {
  const sheet = getSpreadsheet_().getSheetByName(month);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  return rows.map(rowToRecord_).filter(Boolean);
}

function calcWorkMinutes_(startTime, endTime, breakMinutes) {
  const start = formatTimeCell_(startTime);
  const end = formatTimeCell_(endTime);
  if (!start || !end) return null;

  const startParts = start.split(':').map(Number);
  const endParts = end.split(':').map(Number);
  let minutes = endParts[0] * 60 + endParts[1] - (startParts[0] * 60 + startParts[1]) - (Number(breakMinutes) || 0);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

function getMonthTotalMinutes_(month) {
  const records = getRecordsByMonth_(month);
  let total = 0;
  records.forEach(function (record) {
    const minutes = calcWorkMinutes_(record.startTime, record.endTime, record.breakDuration);
    if (minutes != null) total += minutes;
  });
  return total;
}

function upsertRecord_(data) {
  const dateStr = data.date;
  if (!dateStr) throw new Error('date は必須です');

  const month = dateStr.slice(0, 7);
  const sheet = getOrCreateMonthSheet_(month);
  const rowIndex = findRowIndexByDate_(sheet, dateStr);
  const targetRow = rowIndex > 0 ? rowIndex : sheet.getLastRow() + 1;

  const existing =
    rowIndex > 0 ? sheet.getRange(rowIndex, 1, 1, 7).getValues()[0] : [dateStr, '', '', 0, '', false, ''];

  const startTime =
    data.startTime !== undefined && data.startTime !== null
      ? data.startTime
      : formatTimeCell_(existing[1]) || '';
  const endTime =
    data.endTime !== undefined && data.endTime !== null
      ? data.endTime
      : formatTimeCell_(existing[2]) || '';
  const breakDuration =
    data.breakDuration !== undefined ? Number(data.breakDuration) || 0 : Number(existing[3]) || 0;
  const onBreak =
    data.onBreak !== undefined
      ? data.onBreak === true || String(data.onBreak).toUpperCase() === 'TRUE'
      : existing[5] === true || String(existing[5]).toUpperCase() === 'TRUE';
  const breakStartTime =
    data.breakStartTime !== undefined && data.breakStartTime !== null
      ? data.breakStartTime
      : formatTimeCell_(existing[6]) || '';

  sheet.getRange(targetRow, 1, 1, 7).setValues([
    [
      dateStr,
      startTime || '',
      endTime || '',
      breakDuration,
      '',
      onBreak,
      breakStartTime || '',
    ],
  ]);

  return {
    date: dateStr,
    startTime: formatTimeCell_(startTime) || null,
    endTime: formatTimeCell_(endTime) || null,
    breakDuration: breakDuration,
    onBreak: onBreak,
    breakStartTime: formatTimeCell_(breakStartTime) || null,
  };
}
