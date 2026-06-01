/**
 * =====================================================
 * プッチョン 統合スタッフ管理システム
 * =====================================================
 * 機能:
 *   1. タスク管理（フロア別・ポジション別）+ マニュアル紐付け
 *   2. チェック記録（実施時間・担当者の自動記録）
 *   3. スキルチェック＆給与査定
 *   4. スタッフ管理
 *   5. シフト集計（既存機能）
 * =====================================================
 */

// ---- シート名定数 ----
var SHEET_STAFF        = 'スタッフ管理';
var SHEET_TASKS        = 'タスクマスタ';
var SHEET_CHECK_LOG    = 'チェック記録';
var SHEET_SKILL        = 'スキル評価';
var SHEET_SETTINGS     = '設定';
var SHEET_OUTPUT       = 'シフト集計';
var TIMEZONE           = 'Asia/Tokyo';

// =====================================================
// Web App エントリポイント
// =====================================================
function doGet(e) {
  return HtmlService.createTemplateFromFile('WebApp')
    .evaluate()
    .setTitle('スタッフ管理システム')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =====================================================
// メニュー（スプレッドシート画面から操作）
// =====================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏪 スタッフ管理')
    .addItem('管理画面を開く', 'openWebApp')
    .addSeparator()
    .addItem('シフトを集計する', 'runShiftExport')
    .addSeparator()
    .addItem('初期セットアップ', 'setupAllSheets')
    .addToUi();
}

function openWebApp() {
  var url = ScriptApp.getService().getUrl();
  var html = HtmlService.createHtmlOutput(
    '<script>window.open("' + url + '"); google.script.host.close();</script>'
  );
  SpreadsheetApp.getUi().showModalDialog(html, '管理画面を開いています...');
}

// =====================================================
// 初期セットアップ
// =====================================================
function setupAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  _setupStaffSheet(ss);
  _setupTaskSheet(ss);
  _setupCheckLogSheet(ss);
  _setupSkillSheet(ss);
  _setupSettingsSheet(ss);
  if (!ss.getSheetByName(SHEET_OUTPUT)) ss.insertSheet(SHEET_OUTPUT);

  SpreadsheetApp.getUi().alert(
    '✅ セットアップ完了',
    '全シートを作成・確認しました。\nWebアプリURLからスタッフ管理画面にアクセスできます。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function _setupStaffSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_STAFF);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_STAFF);
    var headers = ['スタッフID', 'スタッフ名', '役職', 'フロア', 'ポジション', '時給', '入社日', 'カレンダーID', 'ステータス'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');
    // サンプル
    sheet.getRange(2, 1, 1, 9).setValues([['S001', '山田 太郎', 'アルバイト', '2F', 'ホール', 1100, '2025/04/01', 'yamada@gmail.com', '在籍']]);
    sheet.autoResizeColumns(1, headers.length);
  }
}

function _setupTaskSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TASKS);
    var headers = ['タスクID', 'タスク名', 'カテゴリ', 'フロア', 'ポジション', '実施タイミング', '目安時間(分)', 'マニュアルURL', '手順メモ', '重要度', '有効'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#34a853').setFontColor('#ffffff').setFontWeight('bold');
    // サンプルタスク
    var samples = [
      ['T001', '開店前テーブル拭き', '開店準備', '2F', 'ホール', '開店前', 10, '', 'テーブル面・椅子脚・メニュー立てを拭く。汚れが落ちない場合は中性洗剤を使用', '高', 'TRUE'],
      ['T002', 'ドリンクバー補充確認', '開店準備', '2F', 'ドリンク', '開店前', 5, '', 'シロップ残量・氷・コップの補充。各ドリンク少量試飲で味確認', '高', 'TRUE'],
      ['T003', 'トイレ清掃チェック', '清掃', '共通', '共通', '1時間毎', 5, '', '便器・床・手洗い・ペーパー補充・消臭スプレー', '高', 'TRUE'],
      ['T004', '3F窓拭き', '清掃', '3F', 'ホール', '週1回(月)', 15, '', 'ガラスクリーナーで内側→外側の順で拭く', '中', 'TRUE'],
      ['T005', 'レジ締め', '閉店作業', '共通', 'レジ', '閉店後', 15, '', 'レジ金額確認→売上記録→釣り銭補充→鍵締め', '高', 'TRUE'],
    ];
    sheet.getRange(2, 1, samples.length, headers.length).setValues(samples);
    sheet.autoResizeColumns(1, headers.length);
  }
}

function _setupCheckLogSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_CHECK_LOG);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CHECK_LOG);
    var headers = ['記録ID', '日付', '実施時刻', 'タスクID', 'タスク名', 'スタッフID', 'スタッフ名', 'フロア', 'ステータス', '所要時間(分)', 'メモ'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#ea4335').setFontColor('#ffffff').setFontWeight('bold');
    sheet.autoResizeColumns(1, headers.length);
  }
}

function _setupSkillSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_SKILL);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SKILL);
    var headers = ['スタッフID', 'スタッフ名', 'スキル項目', 'カテゴリ', 'レベル(1-5)', '評価者', '評価日', 'コメント'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#9334e6').setFontColor('#ffffff').setFontWeight('bold');
    var skillItems = [
      ['S001', '山田 太郎', '接客マナー', '接客', 3, 'オーナー', '2025/04/01', ''],
      ['S001', '山田 太郎', 'ドリンク提供速度', 'ドリンク', 2, 'オーナー', '2025/04/01', '練習中'],
      ['S001', '山田 太郎', 'レジ操作', 'レジ', 4, 'オーナー', '2025/04/01', ''],
    ];
    sheet.getRange(2, 1, skillItems.length, headers.length).setValues(skillItems);
    sheet.autoResizeColumns(1, headers.length);
  }
}

function _setupSettingsSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SETTINGS);
    var today = new Date();
    var nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    var lastDay = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    var settings = [
      ['取得開始日', Utilities.formatDate(nextMonth, TIMEZONE, 'yyyy/MM/dd')],
      ['取得終了日', Utilities.formatDate(lastDay, TIMEZONE, 'yyyy/MM/dd')],
      ['店舗名', 'プッチョン'],
      ['フロア一覧', '2F,3F,共通'],
      ['ポジション一覧', 'ホール,ドリンク,レジ,キッチン,共通'],
    ];
    sheet.getRange(1, 1, settings.length, 2).setValues(settings);
    sheet.getRange(1, 1, settings.length, 1).setFontWeight('bold');
    sheet.autoResizeColumns(1, 2);
  }
}

// =====================================================
// API: スタッフ一覧取得
// =====================================================
function getStaffList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_STAFF);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  return data
    .filter(function(r) { return r[0] && r[8] !== '退職'; })
    .map(function(r) {
      return {
        id: r[0], name: r[1], role: r[2], floor: r[3],
        position: r[4], wage: r[5], hireDate: r[6] ? Utilities.formatDate(new Date(r[6]), TIMEZONE, 'yyyy/MM/dd') : '',
        calendarId: r[7], status: r[8]
      };
    });
}

// =====================================================
// API: タスク一覧取得
// =====================================================
function getTaskList(floor, position) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
  return data
    .filter(function(r) {
      if (!r[0] || String(r[10]).toUpperCase() !== 'TRUE') return false;
      if (floor && r[3] !== floor && r[3] !== '共通') return false;
      if (position && r[4] !== position && r[4] !== '共通') return false;
      return true;
    })
    .map(function(r) {
      return {
        id: r[0], name: r[1], category: r[2], floor: r[3],
        position: r[4], timing: r[5], estimatedMin: r[6],
        manualUrl: r[7], memo: r[8], priority: r[9]
      };
    });
}

// =====================================================
// API: チェック記録の保存
// =====================================================
function saveCheckLog(logData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_CHECK_LOG);
  if (!sheet) { _setupCheckLogSheet(ss); sheet = ss.getSheetByName(SHEET_CHECK_LOG); }

  var now = new Date();
  var recordId = 'C' + Utilities.formatDate(now, TIMEZONE, 'yyyyMMddHHmmss');
  var dateStr  = Utilities.formatDate(now, TIMEZONE, 'yyyy/MM/dd');
  var timeStr  = Utilities.formatDate(now, TIMEZONE, 'HH:mm:ss');

  var row = [
    recordId, dateStr, timeStr,
    logData.taskId, logData.taskName,
    logData.staffId, logData.staffName,
    logData.floor, logData.status,
    logData.elapsedMin || '', logData.memo || ''
  ];

  sheet.appendRow(row);
  return { success: true, recordId: recordId };
}

// =====================================================
// API: 今日のチェック記録取得
// =====================================================
function getTodayCheckLogs(floor) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_CHECK_LOG);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd');
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();

  return data
    .filter(function(r) {
      if (r[1] !== today) return false;
      if (floor && r[7] !== floor && r[7] !== '共通') return false;
      return r[0] !== '';
    })
    .map(function(r) {
      return {
        recordId: r[0], date: r[1], time: r[2],
        taskId: r[3], taskName: r[4],
        staffId: r[5], staffName: r[6],
        floor: r[7], status: r[8],
        elapsedMin: r[9], memo: r[10]
      };
    });
}

// =====================================================
// API: 統計データ取得（個人別実施率・時間内実施率）
// =====================================================
function getStatsData(startDate, endDate) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_CHECK_LOG);
  if (!sheet || sheet.getLastRow() < 2) return { staffStats: [], taskStats: [] };

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();

  var start = startDate ? new Date(startDate) : new Date(new Date() - 30 * 24 * 60 * 60 * 1000);
  var end   = endDate   ? new Date(endDate)   : new Date();
  end.setHours(23, 59, 59);

  var filtered = data.filter(function(r) {
    if (!r[0]) return false;
    var d = new Date(r[1]);
    return d >= start && d <= end;
  });

  // スタッフ別集計
  var staffMap = {};
  filtered.forEach(function(r) {
    var key = r[5] + '|' + r[6];
    if (!staffMap[key]) staffMap[key] = { staffId: r[5], staffName: r[6], total: 0, done: 0 };
    staffMap[key].total++;
    if (r[8] === '完了') staffMap[key].done++;
  });

  // タスク別集計
  var taskMap = {};
  filtered.forEach(function(r) {
    var key = r[3];
    if (!taskMap[key]) taskMap[key] = { taskId: r[3], taskName: r[4], total: 0, done: 0, times: [] };
    taskMap[key].total++;
    if (r[8] === '完了') taskMap[key].done++;
    if (r[9]) taskMap[key].times.push(Number(r[9]));
  });

  var staffStats = Object.values(staffMap).map(function(s) {
    s.rate = s.total > 0 ? Math.round(s.done / s.total * 100) : 0;
    return s;
  });
  var taskStats = Object.values(taskMap).map(function(t) {
    t.rate = t.total > 0 ? Math.round(t.done / t.total * 100) : 0;
    t.avgTime = t.times.length > 0 ? Math.round(t.times.reduce(function(a, b) { return a + b; }, 0) / t.times.length * 10) / 10 : null;
    return t;
  });

  return { staffStats: staffStats, taskStats: taskStats };
}

// =====================================================
// API: スキル評価取得
// =====================================================
function getSkillData(staffId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_SKILL);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  return data
    .filter(function(r) { return r[0] && (!staffId || r[0] === staffId); })
    .map(function(r) {
      return {
        staffId: r[0], staffName: r[1], skillItem: r[2],
        category: r[3], level: r[4], evaluator: r[5],
        evalDate: r[6] ? Utilities.formatDate(new Date(r[6]), TIMEZONE, 'yyyy/MM/dd') : '',
        comment: r[7]
      };
    });
}

// =====================================================
// API: スキル評価保存
// =====================================================
function saveSkillEval(evalData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_SKILL);
  if (!sheet) { _setupSkillSheet(ss); sheet = ss.getSheetByName(SHEET_SKILL); }

  var today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd');

  // 既存行を更新 or 新規追加
  if (sheet.getLastRow() >= 2) {
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === evalData.staffId && data[i][2] === evalData.skillItem) {
        sheet.getRange(i + 2, 1, 1, 8).setValues([[
          evalData.staffId, evalData.staffName, evalData.skillItem,
          evalData.category, evalData.level, evalData.evaluator, today, evalData.comment || ''
        ]]);
        return { success: true, action: 'updated' };
      }
    }
  }

  sheet.appendRow([
    evalData.staffId, evalData.staffName, evalData.skillItem,
    evalData.category, evalData.level, evalData.evaluator, today, evalData.comment || ''
  ]);
  return { success: true, action: 'created' };
}

// =====================================================
// API: スタッフ登録・更新
// =====================================================
function saveStaff(staffData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_STAFF);
  if (!sheet) { _setupStaffSheet(ss); sheet = ss.getSheetByName(SHEET_STAFF); }

  var row = [
    staffData.id, staffData.name, staffData.role, staffData.floor,
    staffData.position, staffData.wage, staffData.hireDate,
    staffData.calendarId, staffData.status || '在籍'
  ];

  if (sheet.getLastRow() >= 2) {
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === staffData.id) {
        sheet.getRange(i + 2, 1, 1, 9).setValues([row]);
        return { success: true, action: 'updated' };
      }
    }
  }

  sheet.appendRow(row);
  return { success: true, action: 'created' };
}

// =====================================================
// API: タスク登録・更新
// =====================================================
function saveTask(taskData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) { _setupTaskSheet(ss); sheet = ss.getSheetByName(SHEET_TASKS); }

  var row = [
    taskData.id, taskData.name, taskData.category, taskData.floor,
    taskData.position, taskData.timing, taskData.estimatedMin,
    taskData.manualUrl || '', taskData.memo || '', taskData.priority || '中', 'TRUE'
  ];

  if (sheet.getLastRow() >= 2) {
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === taskData.id) {
        sheet.getRange(i + 2, 1, 1, 11).setValues([row]);
        return { success: true, action: 'updated' };
      }
    }
  }

  // 新規IDを採番
  if (!taskData.id) {
    var lastRow = sheet.getLastRow();
    row[0] = 'T' + String(lastRow).padStart(3, '0');
  }
  sheet.appendRow(row);
  return { success: true, action: 'created' };
}

// =====================================================
// API: 設定取得
// =====================================================
function getSettings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return { storeName: 'プッチョン', floors: ['2F', '3F', '共通'], positions: ['ホール', 'ドリンク', 'レジ', 'キッチン', '共通'] };

  var data = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
  var settings = {};
  data.forEach(function(r) { settings[r[0]] = r[1]; });

  return {
    storeName: settings['店舗名'] || 'プッチョン',
    floors: settings['フロア一覧'] ? String(settings['フロア一覧']).split(',') : ['2F', '3F', '共通'],
    positions: settings['ポジション一覧'] ? String(settings['ポジション一覧']).split(',') : ['ホール', 'ドリンク', 'レジ', 'キッチン', '共通']
  };
}

// =====================================================
// API: 給与査定サマリー取得
// =====================================================
function getAssessmentSummary(month) {
  var staffList = getStaffList();
  var skillData = getSkillData(null);

  var targetMonth = month || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var checkSheet = ss.getSheetByName(SHEET_CHECK_LOG);
  var checkData = [];
  if (checkSheet && checkSheet.getLastRow() >= 2) {
    checkData = checkSheet.getRange(2, 1, checkSheet.getLastRow() - 1, 11).getValues()
      .filter(function(r) { return r[0] && String(r[1]).startsWith(targetMonth); });
  }

  return staffList.map(function(staff) {
    // チェック実施率
    var myChecks = checkData.filter(function(r) { return r[5] === staff.id; });
    var checkRate = myChecks.length > 0
      ? Math.round(myChecks.filter(function(r) { return r[8] === '完了'; }).length / myChecks.length * 100)
      : null;

    // スキル平均
    var mySkills = skillData.filter(function(s) { return s.staffId === staff.id; });
    var avgSkill = mySkills.length > 0
      ? Math.round(mySkills.reduce(function(sum, s) { return sum + Number(s.level); }, 0) / mySkills.length * 10) / 10
      : null;

    return {
      staffId: staff.id,
      staffName: staff.name,
      role: staff.role,
      wage: staff.wage,
      checkCount: myChecks.length,
      checkRate: checkRate,
      avgSkillLevel: avgSkill,
      skills: mySkills
    };
  });
}

// =====================================================
// シフト集計（既存機能）
// =====================================================
function runShiftExport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var period = _getDatePeriod(ss);
  if (!period) {
    ui.alert('⚠ 設定エラー', '「設定」シートのB1に開始日、B2に終了日を入力してください。', ui.ButtonSet.OK);
    return;
  }
  var staffList = _getShiftStaffList(ss);
  if (staffList.length === 0) {
    ui.alert('⚠ スタッフ未登録', '「スタッフ管理」シートを確認してください。', ui.ButtonSet.OK);
    return;
  }
  var allRows = [], errors = [];
  staffList.forEach(function(staff) {
    try {
      var rows = _getEventsForStaff(staff, period.startDate, period.endDate);
      allRows = allRows.concat(rows);
    } catch (e) { errors.push(staff.name + ': ' + e.message); }
  });
  allRows.sort(function(a, b) {
    if (a[1] === b[1]) return a[0].localeCompare(b[0], 'ja');
    return a[1] < b[1] ? -1 : 1;
  });
  _outputShiftToSheet(ss, allRows);
  var msg = '✅ 集計完了\n件数: ' + allRows.length + ' 件';
  if (errors.length > 0) msg += '\n\n⚠ エラー:\n' + errors.join('\n');
  ui.alert('集計完了', msg, ui.ButtonSet.OK);
}

function _getDatePeriod(ss) {
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return null;
  var startVal = sheet.getRange('B1').getValue();
  var endVal   = sheet.getRange('B2').getValue();
  if (!startVal || !endVal) return null;
  var startDate = new Date(startVal), endDate = new Date(endVal);
  endDate.setHours(23, 59, 59, 999);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) return null;
  return { startDate: startDate, endDate: endDate };
}

function _getShiftStaffList(ss) {
  var sheet = ss.getSheetByName(SHEET_STAFF);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  return data.filter(function(r) { return r[0] && r[7] && r[8] !== '退職'; })
             .map(function(r) { return { name: r[1], calendarId: r[7] }; });
}

function _getEventsForStaff(staff, startDate, endDate) {
  var calendar = CalendarApp.getCalendarById(staff.calendarId);
  if (!calendar) throw new Error('カレンダーが見つかりません');
  return calendar.getEvents(startDate, endDate).map(function(event) {
    var start = event.isAllDayEvent() ? '終日' : Utilities.formatDate(event.getStartTime(), TIMEZONE, 'HH:mm');
    var end   = event.isAllDayEvent() ? '終日' : Utilities.formatDate(event.getEndTime(),   TIMEZONE, 'HH:mm');
    return [staff.name, Utilities.formatDate(event.getStartTime(), TIMEZONE, 'yyyy/MM/dd'), start, end, event.getTitle()];
  });
}

function _outputShiftToSheet(ss, rows) {
  var sheet = ss.getSheetByName(SHEET_OUTPUT) || ss.insertSheet(SHEET_OUTPUT);
  sheet.clearContents();
  var headers = ['スタッフ名', '日付', '開始時間', '終了時間', 'イベント名'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground('#4a86e8').setFontColor('#ffffff').setFontWeight('bold');
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.autoResizeColumns(1, headers.length);
}
