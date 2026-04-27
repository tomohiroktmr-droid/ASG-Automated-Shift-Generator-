/**
 * =====================================================
 * プッチョン シフト自動集計スクリプト
 * =====================================================
 * Googleカレンダーのシフト希望イベントを取得し、
 * スプレッドシートの「シフト集計」シートに出力します。
 *
 * 【シート構成】
 *   スタッフ管理 シート:
 *     A列: スタッフ名
 *     B列: カレンダーID（Gmailアドレス）
 *
 *   設定 シート:
 *     B1: 取得開始日（例: 2026/04/01）
 *     B2: 取得終了日（例: 2026/04/30）
 *
 *   シフト集計 シート:
 *     A列: スタッフ名
 *     B列: 日付
 *     C列: 開始時間
 *     D列: 終了時間
 * =====================================================
 */

// ---- 定数 ----
var SHEET_STAFF    = 'スタッフ管理';
var SHEET_SETTINGS = '設定';
var SHEET_OUTPUT   = 'シフト集計';
var TIMEZONE       = 'Asia/Tokyo';

// =====================================================
// メニュー追加（スプレッドシートを開いたときに自動実行）
// =====================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🗓 シフト管理')
    .addItem('シフトを集計する', 'runShiftExport')
    .addSeparator()
    .addItem('シートの初期設定', 'setupSheets')
    .addSeparator()
    .addItem('🤖 シフト最適化を実行', 'runShiftOptimizer')
    .addItem('最適化シートの初期設定', 'setupOptimizerSheets')
    .addSeparator()
    .addItem('📊 過去データ分析 & テンプレート生成', 'runHistoricalAnalysis')
    .addToUi();
}

// =====================================================
// メイン処理: シフト集計を実行する
// =====================================================
function runShiftExport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // --- 1. 取得期間を「設定」シートから読み込む ---
  var period = getDatePeriod(ss);
  if (!period) {
    ui.alert(
      '⚠ 設定エラー',
      '「設定」シートのB1に開始日、B2に終了日を入力してください。\n例: B1 → 2026/04/01　B2 → 2026/04/30',
      ui.ButtonSet.OK
    );
    return;
  }

  // --- 2. スタッフ一覧を取得 ---
  var staffList = getStaffList(ss);
  if (staffList.length === 0) {
    ui.alert(
      '⚠ スタッフ未登録',
      '「スタッフ管理」シートのA列にスタッフ名、B列にカレンダーIDを入力してください。',
      ui.ButtonSet.OK
    );
    return;
  }

  // --- 3. 各スタッフのイベントを収集 ---
  var allRows = [];
  var errors  = [];

  staffList.forEach(function(staff) {
    try {
      var rows = getEventsForStaff(staff, period.startDate, period.endDate);
      allRows = allRows.concat(rows);
    } catch (e) {
      errors.push(staff.name + '（' + staff.calendarId + '）: ' + e.message);
    }
  });

  // 日付→スタッフ名 の順でソート
  allRows.sort(function(a, b) {
    if (a[1] === b[1]) return a[0].localeCompare(b[0], 'ja');
    return a[1] < b[1] ? -1 : 1;
  });

  // --- 4. シフト集計シートへ出力 ---
  outputToSheet(ss, allRows);

  // --- 5. 完了メッセージ ---
  var msg = '✅ 集計が完了しました。\n\n'
    + '期間: ' + Utilities.formatDate(period.startDate, TIMEZONE, 'yyyy/MM/dd')
    + ' ～ ' + Utilities.formatDate(period.endDate,   TIMEZONE, 'yyyy/MM/dd') + '\n'
    + '件数: ' + allRows.length + ' 件';

  if (errors.length > 0) {
    msg += '\n\n⚠ 以下のカレンダーは取得できませんでした:\n' + errors.join('\n');
  }

  ui.alert('集計完了', msg, ui.ButtonSet.OK);
}

// =====================================================
// 「設定」シートから開始日・終了日を取得する
// @return {startDate: Date, endDate: Date} or null
// =====================================================
function getDatePeriod(ss) {
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return null;

  var startVal = sheet.getRange('B1').getValue();
  var endVal   = sheet.getRange('B2').getValue();

  if (!startVal || !endVal) return null;

  var startDate = new Date(startVal);
  var endDate   = new Date(endVal);

  // 終了日はその日の23:59:59まで含める
  endDate.setHours(23, 59, 59, 999);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
  if (startDate > endDate) return null;

  return { startDate: startDate, endDate: endDate };
}

// =====================================================
// 「スタッフ管理」シートからスタッフ一覧を取得する
// @return [{name, calendarId}]
// =====================================================
function getStaffList(ss) {
  var sheet = ss.getSheetByName(SHEET_STAFF);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];   // ヘッダー行のみの場合

  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

  var staffList = [];
  data.forEach(function(row) {
    var name       = String(row[0]).trim();
    var calendarId = String(row[1]).trim();
    if (name && calendarId) {
      staffList.push({ name: name, calendarId: calendarId });
    }
  });

  return staffList;
}

// =====================================================
// スタッフ1人分のカレンダーイベントを取得する
// @param  staff     {name, calendarId}
// @param  startDate Date
// @param  endDate   Date
// @return 行データの配列 [[スタッフ名, 日付, 開始時間, 終了時間], ...]
// =====================================================
function getEventsForStaff(staff, startDate, endDate) {
  var calendar = CalendarApp.getCalendarById(staff.calendarId);

  if (!calendar) {
    throw new Error('カレンダーが見つかりません。共有設定を確認してください。');
  }

  var events = calendar.getEvents(startDate, endDate);
  var rows   = [];

  events.forEach(function(event) {
    var title     = event.getTitle();
    var dateStr   = Utilities.formatDate(event.getStartTime(), TIMEZONE, 'yyyy/MM/dd');
    var startTime, endTime;

    if (event.isAllDayEvent()) {
      startTime = '終日';
      endTime   = '終日';
    } else {
      startTime = Utilities.formatDate(event.getStartTime(), TIMEZONE, 'HH:mm');
      endTime   = Utilities.formatDate(event.getEndTime(),   TIMEZONE, 'HH:mm');
    }

    rows.push([staff.name, dateStr, startTime, endTime, title]);
  });

  return rows;
}

// =====================================================
// 「シフト集計」シートにデータを出力する（全クリア→全出し）
// @param ss   Spreadsheet
// @param rows [[スタッフ名, 日付, 開始時間, 終了時間, イベント名], ...]
// =====================================================
function outputToSheet(ss, rows) {
  var sheet = ss.getSheetByName(SHEET_OUTPUT);

  // シートがなければ作成
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_OUTPUT);
  }

  // --- 既存データを全クリア ---
  sheet.clearContents();

  // --- ヘッダー行 ---
  var headers = ['スタッフ名', '日付', '開始時間', '終了時間', 'イベント名（備考）'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ヘッダーの書式設定
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4a86e8');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');

  // --- データ行 ---
  if (rows.length === 0) return;

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  // 列幅の自動調整
  sheet.autoResizeColumns(1, headers.length);
}

// =====================================================
// 初期設定: 必要なシートをまとめて作成する
// =====================================================
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // スタッフ管理シート
  var staffSheet = ss.getSheetByName(SHEET_STAFF);
  if (!staffSheet) {
    staffSheet = ss.insertSheet(SHEET_STAFF);
    staffSheet.getRange('A1').setValue('スタッフ名');
    staffSheet.getRange('B1').setValue('カレンダーID（メールアドレス）');
    staffSheet.getRange(1, 1, 1, 2).setBackground('#e8f0fe').setFontWeight('bold');
    // サンプル行
    staffSheet.getRange('A2').setValue('山田 太郎（サンプル）');
    staffSheet.getRange('B2').setValue('yamada@gmail.com（ここをカレンダーIDに変更）');
    staffSheet.autoResizeColumns(1, 2);
  }

  // 設定シート
  var settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SHEET_SETTINGS);
    settingsSheet.getRange('A1').setValue('取得開始日');
    settingsSheet.getRange('A2').setValue('取得終了日');
    settingsSheet.getRange('A1:A2').setFontWeight('bold');

    // 来月の1日〜末日をデフォルト値として設定
    var today     = new Date();
    var nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    var lastDay   = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    settingsSheet.getRange('B1').setValue(Utilities.formatDate(nextMonth, TIMEZONE, 'yyyy/MM/dd'));
    settingsSheet.getRange('B2').setValue(Utilities.formatDate(lastDay,   TIMEZONE, 'yyyy/MM/dd'));
    settingsSheet.autoResizeColumns(1, 2);
  }

  // シフト集計シート
  var outputSheet = ss.getSheetByName(SHEET_OUTPUT);
  if (!outputSheet) {
    outputSheet = ss.insertSheet(SHEET_OUTPUT);
  }

  ui.alert(
    '✅ 初期設定完了',
    '以下のシートを作成（または確認）しました:\n\n'
      + '・スタッフ管理 — スタッフ名とカレンダーIDを入力してください\n'
      + '・設定 — 取得したい期間を入力してください\n'
      + '・シフト集計 — 集計結果の出力先です',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
